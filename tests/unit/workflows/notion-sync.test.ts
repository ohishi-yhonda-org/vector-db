import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock cloudflare:workers
vi.mock('cloudflare:workers', () => ({
  WorkflowEntrypoint: class {
    constructor(public ctx: any, public env: any) {}
  },
  WorkflowStep: {},
  WorkflowEvent: {}
}))

// Mock dependencies
vi.mock('../../../src/services/notion.service')
vi.mock('../../../src/db')
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    eq: vi.fn((field, value) => ({ field, value })),
    sql: vi.fn()
  }
})

// Import after mocking
import { NotionSyncWorkflow } from '../../../src/workflows/notion-sync'
import { NotionService } from '../../../src/services/notion.service'
import { getDb } from '../../../src/db'

// Mock WorkflowStep
const mockStep = {
  do: vi.fn()
}

// Mock WorkflowEvent
const createMockEvent = (payload: any) => ({
  payload,
  timestamp: new Date()
})

describe('NotionSyncWorkflow', () => {
  let workflow: NotionSyncWorkflow
  let mockEnv: any
  let mockCtx: any
  let mockNotionService: any
  let mockVectorManager: any
  let mockDb: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockVectorManager = {
      createVectorAsync: vi.fn().mockResolvedValue({ jobId: 'vec-job-123' })
    }
    
    mockEnv = {
      NOTION_API_KEY: 'test-notion-key',
      DEFAULT_EMBEDDING_MODEL: '@cf/baai/bge-base-en-v1.5',
      VECTOR_CACHE: {
        idFromName: vi.fn().mockReturnValue('vector-manager-id'),
        get: vi.fn().mockReturnValue(mockVectorManager)
      }
    }

    mockCtx = {}

    mockNotionService = {
      fetchPageFromNotion: vi.fn(),
      savePage: vi.fn(),
      saveVectorRelation: vi.fn(),
      savePageProperties: vi.fn(),
      fetchPageBlocks: vi.fn(),
      fetchBlocksFromNotion: vi.fn(),
      savePageBlocks: vi.fn(),
      saveBlocks: vi.fn()
    }
    
    mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue({})
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({})
        })
      })
    }
    
    vi.mocked(NotionService).mockImplementation(() => mockNotionService)
    vi.mocked(getDb).mockReturnValue(mockDb)

    workflow = new NotionSyncWorkflow(mockCtx, mockEnv)
  })

  describe('run', () => {
    it('should sync page successfully with title', async () => {
      const params = {
        pageId: 'page-123',
        notionToken: 'test-token',
        includeBlocks: true,
        includeProperties: true,
        namespace: 'notion-test'
      }

      const mockPage = {
        id: 'page-123',
        url: 'https://notion.so/page-123',
        properties: {
          Title: {
            type: 'title',
            title: [{ plain_text: 'Test Page' }]
          },
          Status: {
            type: 'select',
            select: { name: 'Active' }
          }
        }
      }

      const mockBlocks = [
        {
          id: 'block-1',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ plain_text: 'This is a paragraph' }]
          }
        },
        {
          id: 'block-2',
          type: 'heading_1',
          heading_1: {
            rich_text: [{ plain_text: 'Heading' }]
          }
        }
      ]

      mockNotionService.fetchPageFromNotion.mockResolvedValueOnce(mockPage)
      mockNotionService.fetchBlocksFromNotion.mockResolvedValueOnce(mockBlocks)
      
      // Mock the VectorManager to return expected job IDs
      mockVectorManager.createVectorAsync
        .mockResolvedValueOnce({ jobId: 'vec-job-title' })
        .mockResolvedValueOnce({ jobId: 'vec-job-prop-1' })
        .mockResolvedValueOnce({ jobId: 'vec-job-block-1' })
        .mockResolvedValueOnce({ jobId: 'vec-job-block-2' })

      // Mock the savePage and related methods to return success
      mockNotionService.savePage.mockResolvedValueOnce(undefined)
      mockNotionService.saveVectorRelation.mockResolvedValue(undefined)
      mockNotionService.savePageProperties.mockResolvedValueOnce(['prop-1'])
      mockNotionService.saveBlocks.mockResolvedValueOnce(undefined)

      mockStep.do
        .mockImplementationOnce(async (name, fn) => {
          if (name === 'fetch-and-save-page') {
            return await fn()
          }
        })
        .mockImplementationOnce(async (name, fn) => {
          if (name === 'vectorize-page-title') {
            return await fn()
          }
        })
        .mockImplementationOnce(async (name, fn) => {
          if (name === 'process-properties') {
            return await fn()
          }
        })
        .mockImplementationOnce(async (name, fn) => {
          if (name === 'process-blocks') {
            return await fn()
          }
        })
        .mockImplementationOnce(async (name, fn) => {
          if (name === 'complete-sync-job') {
            return await fn()
          }
        })

      const event = createMockEvent(params)
      const result = await workflow.run(event as any, mockStep as any)

      expect(result).toMatchObject({
        success: true,
        pageId: 'page-123',
        blocksProcessed: 2,
        propertiesProcessed: 2, // Title and Status
        vectorsCreated: 4, // 1 title + 1 property + 2 blocks
        completedAt: expect.any(String)
      })

      expect(mockNotionService.savePage).toHaveBeenCalledWith(mockPage)
      expect(mockVectorManager.createVectorAsync).toHaveBeenCalled()
      expect(mockNotionService.saveVectorRelation).toHaveBeenCalled()
    })

    it('should handle page without title', async () => {
      const params = {
        pageId: 'page-123',
        notionToken: 'test-token'
      }

      const mockPage = {
        id: 'page-123',
        url: 'https://notion.so/page-123',
        properties: {
          Name: {
            type: 'rich_text',
            rich_text: [{ plain_text: 'Not a title' }]
          }
        }
      }

      mockNotionService.fetchPageFromNotion.mockResolvedValueOnce(mockPage)
      
      mockStep.do
        .mockImplementationOnce(async (name, fn) => {
          if (name === 'fetch-and-save-page') {
            return await fn()
          }
        })
        .mockImplementationOnce(async (name, fn) => {
          if (name === 'vectorize-page-title') {
            return await fn()
          }
        })
        .mockImplementationOnce(async (name, fn) => {
          if (name === 'process-properties') {
            return await fn()
          }
        })
        .mockImplementationOnce(async (name, fn) => {
          if (name === 'process-blocks') {
            return await fn()
          }
        })

      const event = createMockEvent(params)
      const result = await workflow.run(event as any, mockStep as any)

      expect(result.vectorsCreated).toBe(1) // Only property vector
    })

    it('should handle empty title', async () => {
      const params = {
        pageId: 'page-123',
        notionToken: 'test-token'
      }

      const mockPage = {
        id: 'page-123',
        url: 'https://notion.so/page-123',
        properties: {
          Title: {
            type: 'title',
            title: []
          }
        }
      }

      mockNotionService.fetchPageFromNotion.mockResolvedValueOnce(mockPage)
      
      mockStep.do
        .mockImplementationOnce(async (name, fn) => {
          if (name === 'fetch-and-save-page') {
            return await fn()
          }
        })
        .mockImplementationOnce(async (name, fn) => {
          if (name === 'vectorize-page-title') {
            return await fn()
          }
        })
        .mockImplementationOnce(async (name, fn) => {
          if (name === 'process-properties') {
            return await fn()
          }
        })
        .mockImplementationOnce(async (name, fn) => {
          if (name === 'process-blocks') {
            return await fn()
          }
        })

      const event = createMockEvent(params)
      const result = await workflow.run(event as any, mockStep as any)

      expect(result.vectorsCreated).toBe(0)
    })

    it('should skip properties when includeProperties is false', async () => {
      const params = {
        pageId: 'page-123',
        notionToken: 'test-token',
        includeBlocks: false,
        includeProperties: false
      }

      const mockPage = {
        id: 'page-123',
        properties: {
          Title: {
            type: 'title',
            title: [{ plain_text: 'Test' }]
          }
        }
      }

      mockNotionService.fetchPageFromNotion.mockResolvedValueOnce(mockPage)
      
      mockStep.do
        .mockImplementationOnce(async (name, fn) => {
          if (name === 'fetch-and-save-page') {
            return await fn()
          }
        })
        .mockImplementationOnce(async (name, fn) => {
          if (name === 'vectorize-page-title') {
            return await fn()
          }
        })

      const event = createMockEvent(params)
      const result = await workflow.run(event as any, mockStep as any)

      expect(result.propertiesProcessed).toBe(0)
      expect(result.blocksProcessed).toBe(0)
      expect(result.vectorsCreated).toBe(1) // Only title
    })

    it('should handle page not found error', async () => {
      const params = {
        pageId: 'non-existent',
        notionToken: 'test-token'
      }

      mockNotionService.fetchPageFromNotion.mockResolvedValueOnce(null)
      
      mockStep.do.mockImplementationOnce(async (name, fn) => {
        if (name === 'fetch-and-save-page') {
          throw new Error('Page non-existent not found')
        }
      })

      const event = createMockEvent(params)
      const result = await workflow.run(event as any, mockStep as any)

      expect(result).toMatchObject({
        success: false,
        pageId: 'non-existent',
        error: 'Page non-existent not found',
        vectorsCreated: 0
      })
    })

    it('should handle API errors', async () => {
      const params = {
        pageId: 'page-123',
        notionToken: 'test-token'
      }

      mockNotionService.fetchPageFromNotion.mockRejectedValueOnce(new Error('API Error'))
      
      mockStep.do.mockImplementationOnce(async (name, fn) => {
        if (name === 'fetch-and-save-page') {
          throw new Error('API Error')
        }
      })

      const event = createMockEvent(params)
      const result = await workflow.run(event as any, mockStep as any)

      expect(result).toMatchObject({
        success: false,
        error: 'API Error'
      })
    })

    it('should vectorize properties correctly', async () => {
      const params = {
        pageId: 'page-123',
        notionToken: 'test-token',
        includeProperties: true,
        includeBlocks: false
      }

      const mockPage = {
        id: 'page-123',
        properties: {
          Title: {
            type: 'title',
            title: [{ plain_text: 'Test' }]
          },
          Status: {
            type: 'select',
            select: { name: 'Active' }
          },
          Tags: {
            type: 'multi_select',
            multi_select: [{ name: 'Tag1' }, { name: 'Tag2' }]
          },
          Checkbox: {
            type: 'checkbox',
            checkbox: true
          },
          Formula: {
            type: 'formula',
            formula: { type: 'string', string: 'Result' }
          }
        }
      }

      mockNotionService.fetchPageFromNotion.mockResolvedValueOnce(mockPage)
      
      mockStep.do
        .mockImplementationOnce(async (name, fn) => {
          if (name === 'fetch-and-save-page') {
            return await fn()
          }
        })
        .mockImplementationOnce(async (name, fn) => {
          if (name === 'vectorize-page-title') {
            return await fn()
          }
        })
        .mockImplementationOnce(async (name, fn) => {
          if (name === 'process-properties') {
            return await fn()
          }
        })

      const event = createMockEvent(params)
      const result = await workflow.run(event as any, mockStep as any)

      expect(result.propertiesProcessed).toBe(5) // Title, Status, Tags, Checkbox, Formula
      expect(mockNotionService.savePageProperties).toHaveBeenCalled()
    })

    it('should vectorize blocks correctly', async () => {
      const params = {
        pageId: 'page-123',
        notionToken: 'test-token',
        includeBlocks: true,
        includeProperties: false
      }

      const mockPage = {
        id: 'page-123',
        properties: {
          Title: {
            type: 'title',
            title: [{ plain_text: 'Test' }]
          }
        }
      }

      const mockBlocks = [
        {
          id: 'block-1',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ plain_text: 'Paragraph 1' }, { plain_text: ' continued' }]
          }
        },
        {
          id: 'block-2',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ plain_text: 'List item' }]
          }
        },
        {
          id: 'block-3',
          type: 'code',
          code: {
            rich_text: [{ plain_text: 'console.log("test")' }],
            language: 'javascript'
          }
        },
        {
          id: 'block-4',
          type: 'divider',
          divider: {}
        }
      ]

      mockNotionService.fetchPageFromNotion.mockResolvedValueOnce(mockPage)
      mockNotionService.fetchBlocksFromNotion.mockResolvedValueOnce(mockBlocks)
      
      mockStep.do
        .mockImplementationOnce(async (name, fn) => {
          if (name === 'fetch-and-save-page') {
            return await fn()
          }
        })
        .mockImplementationOnce(async (name, fn) => {
          if (name === 'vectorize-page-title') {
            return await fn()
          }
        })
        .mockImplementationOnce(async (name, fn) => {
          if (name === 'process-blocks') {
            return await fn()
          }
        })

      const event = createMockEvent(params)
      const result = await workflow.run(event as any, mockStep as any)

      expect(result.blocksProcessed).toBe(4) // all blocks are counted
      expect(mockNotionService.saveBlocks).toHaveBeenCalled()
    })

    it('should handle partial failures gracefully', async () => {
      const params = {
        pageId: 'page-123',
        notionToken: 'test-token',
        includeBlocks: true,
        includeProperties: true
      }

      const mockPage = {
        id: 'page-123',
        properties: {
          Title: {
            type: 'title',
            title: [{ plain_text: 'Test' }]
          }
        }
      }

      mockNotionService.fetchPageFromNotion.mockResolvedValueOnce(mockPage)
      mockNotionService.fetchBlocksFromNotion.mockRejectedValueOnce(new Error('Blocks fetch failed'))
      
      mockStep.do
        .mockImplementationOnce(async (name, fn) => {
          if (name === 'fetch-and-save-page') {
            return await fn()
          }
        })
        .mockImplementationOnce(async (name, fn) => {
          if (name === 'vectorize-page-title') {
            return await fn()
          }
        })
        .mockImplementationOnce(async (name, fn) => {
          if (name === 'process-properties') {
            return await fn()
          }
        })
        .mockImplementationOnce(async (name, fn) => {
          if (name === 'process-blocks') {
            throw new Error('Blocks fetch failed')
          }
        })
        .mockImplementationOnce(async (name, fn) => {
          if (name === 'record-error') {
            return await fn()
          }
        })

      const event = createMockEvent(params)
      const result = await workflow.run(event as any, mockStep as any)

      // Should fail when blocks fetch fails
      expect(result.success).toBe(false)
      expect(result.error).toBe('Blocks fetch failed')
      expect(result.blocksProcessed).toBe(0)
    })
  })
})