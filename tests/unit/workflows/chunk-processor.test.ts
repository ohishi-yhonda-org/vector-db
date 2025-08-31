import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setupWorkflowTest } from '../test-helpers'

// Mock cloudflare:workers
vi.mock('cloudflare:workers', () => ({
  WorkflowEntrypoint: class {
    constructor(public ctx: any, public env: any) {}
  },
  WorkflowStep: {},
  WorkflowEvent: {}
}))

// Import after mocking
import { ChunkProcessor } from '../../../src/workflows/chunk-processor'

describe('ChunkProcessor', () => {
  let workflow: ChunkProcessor
  let testSetup: ReturnType<typeof setupWorkflowTest>

  beforeEach(() => {
    vi.clearAllMocks()
    testSetup = setupWorkflowTest()
    
    // Mock step.do to actually execute the callback
    testSetup.mockStep.do = vi.fn().mockImplementation(async (name: string, callback: () => Promise<any>) => {
      return await callback()
    })
    
    workflow = new ChunkProcessor(testSetup.mockCtx, testSetup.mockEnv)
  })

  describe('processChunks', () => {
    it('should process text into chunks', async () => {
      const params = {
        text: 'This is a test text for chunking.',
        fileName: 'test.txt'
      }

      const result = await (workflow as any).processChunks(params, testSetup.mockStep)
      
      expect(result).toBeDefined()
      expect(result.chunks).toBeDefined()
      expect(result.chunks).toBeInstanceOf(Array)
      expect(result.totalChunks).toBe(result.chunks.length)
      expect(result.averageChunkSize).toBeGreaterThan(0)
    })

    it('should handle empty text', async () => {
      const params = {
        text: '',
        fileName: 'test.txt'
      }

      const result = await (workflow as any).processChunks(params, testSetup.mockStep)
      
      expect(result.chunks).toEqual([])
      expect(result.totalChunks).toBe(0)
      expect(result.averageChunkSize).toBe(0)
    })

    it('should apply custom chunk size', async () => {
      const params = {
        text: 'A'.repeat(2000), // 2000 characters
        fileName: 'test.txt',
        chunkSize: 500
      }

      const result = await (workflow as any).processChunks(params, testSetup.mockStep)
      
      expect(result.chunks.length).toBeGreaterThan(3)
      expect(result.chunks[0].text.length).toBeLessThanOrEqual(500)
    })

    it('should handle chunk overlap', async () => {
      const params = {
        text: '0123456789'.repeat(10), // 100 characters
        fileName: 'test.txt',
        chunkSize: 20,
        chunkOverlap: 5
      }

      const result = await (workflow as any).processChunks(params, testSetup.mockStep)
      
      // Check that chunks overlap
      if (result.chunks.length > 1) {
        for (let i = 1; i < result.chunks.length; i++) {
          const prevChunk = result.chunks[i - 1]
          const currChunk = result.chunks[i]
          const overlap = prevChunk.endOffset - currChunk.startOffset
          expect(overlap).toBeGreaterThanOrEqual(0)
        }
      }
    })

    it('should include metadata in chunks', async () => {
      const params = {
        text: 'Test text',
        fileName: 'test.txt',
        namespace: 'test-namespace',
        metadata: { author: 'test' }
      }

      const result = await (workflow as any).processChunks(params, testSetup.mockStep)
      
      expect(result.chunks[0].metadata).toBeDefined()
      expect(result.chunks[0].metadata.fileName).toBe('test.txt')
      expect(result.chunks[0].metadata.namespace).toBe('test-namespace')
      expect(result.chunks[0].metadata.author).toBe('test')
    })
  })
})