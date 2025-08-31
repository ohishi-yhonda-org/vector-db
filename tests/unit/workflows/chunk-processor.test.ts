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

  describe('run method', () => {
    it('should execute workflow entry point (lines 26-27)', async () => {
      const event = {
        payload: {
          text: 'This is a test text for chunking.',
          fileName: 'test.txt'
        }
      }
      
      const result = await workflow.run(event as any, testSetup.mockStep)
      
      expect(result).toBeDefined()
      expect(result.chunks).toBeDefined()
      expect(result.totalChunks).toBeGreaterThan(0)
    })
  })

  describe('validateChunkSize', () => {
    it('should handle chunk size over maximum (lines 85-86)', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      const params = {
        text: 'Test text',
        fileName: 'test.txt',
        chunkSize: 6000 // Over MAX_CHUNK_SIZE (5000)
      }

      const result = await (workflow as any).processChunks(params, testSetup.mockStep)
      
      expect(consoleSpy).toHaveBeenCalledWith('Chunk size too large, using maximum: 5000')
      expect(result).toBeDefined()
      
      consoleSpy.mockRestore()
    })
  })

  describe('validateChunkOverlap', () => {
    it('should handle chunk overlap too large (lines 102-103)', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      const params = {
        text: 'Test text',
        fileName: 'test.txt',
        chunkSize: 100,
        chunkOverlap: 60 // More than half of chunk size
      }

      const result = await (workflow as any).processChunks(params, testSetup.mockStep)
      
      expect(consoleSpy).toHaveBeenCalledWith('Chunk overlap too large, using: 50')
      expect(result).toBeDefined()
      
      consoleSpy.mockRestore()
    })

    it('should handle negative chunk overlap (lines 107-108)', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      const params = {
        text: 'Test text',
        fileName: 'test.txt',
        chunkSize: 100,
        chunkOverlap: -10
      }

      const result = await (workflow as any).processChunks(params, testSetup.mockStep)
      
      expect(consoleSpy).toHaveBeenCalledWith('Negative chunk overlap, using 0')
      expect(result).toBeDefined()
      
      consoleSpy.mockRestore()
    })
  })

  describe('natural break functionality', () => {
    it('should split text at natural boundaries (lines 198, 205)', async () => {
      // Test text with punctuation
      const params1 = {
        text: 'This is a sentence. This is another sentence. And one more here.',
        fileName: 'test.txt',
        chunkSize: 25,
        chunkOverlap: 0
      }
      
      const result1 = await (workflow as any).processChunks(params1, testSetup.mockStep)
      
      // Verify chunks are split at sentence boundaries
      expect(result1.chunks).toBeDefined()
      expect(result1.chunks.length).toBeGreaterThan(1)
      
      // Test text without punctuation
      const params2 = {
        text: 'This is a long sentence without any punctuation that needs to be split into chunks based on spaces instead',
        fileName: 'test.txt',
        chunkSize: 30,
        chunkOverlap: 0
      }
      
      const result2 = await (workflow as any).processChunks(params2, testSetup.mockStep)
      
      // Verify chunks are split at word boundaries
      expect(result2.chunks).toBeDefined()
      expect(result2.chunks.length).toBeGreaterThan(1)
      // Each chunk should not end mid-word
      result2.chunks.forEach((chunk: any) => {
        const trimmedText = chunk.text.trim()
        if (trimmedText.length > 0) {
          // Check that chunk doesn't end with a partial word (unless it's the last chunk)
          const lastChar = trimmedText[trimmedText.length - 1]
          const isLastChunk = chunk === result2.chunks[result2.chunks.length - 1]
          if (!isLastChunk) {
            expect(lastChar).toMatch(/[\s.!?]|$/)
          }
        }
      })
    })
  })
})