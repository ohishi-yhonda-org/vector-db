import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenAPIHono } from '@hono/zod-openapi'
import { listModelsRoute, listModelsHandler } from '../../../../src/routes/api/embeddings/models'

// Mock AI Embeddings Durable Object
const mockAIEmbeddings = {
  getAvailableModels: vi.fn()
}

// Mock Durable Object namespace
const mockAIEmbeddingsNamespace = {
  idFromName: vi.fn().mockReturnValue('mock-id'),
  get: vi.fn().mockReturnValue(mockAIEmbeddings)
}

describe('List Models Route', () => {
  let app: OpenAPIHono<{ Bindings: Env }>
  let mockEnv: Env

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockEnv = {
      AI: {} as any,
      VECTORIZE_INDEX: {} as any,
      VECTOR_MANAGER: {} as any,
      NOTION_MANAGER: {} as any,
      AI_EMBEDDINGS: mockAIEmbeddingsNamespace as any,
      DB: {} as any,
      NOTION_API_KEY: 'test-key'
    }

    app = new OpenAPIHono<{ Bindings: Env }>()
    app.openapi(listModelsRoute, listModelsHandler)
  })

  describe('GET /embeddings/models', () => {
    it('should list available models successfully', async () => {
      const mockModels = [
        {
          name: '@cf/baai/bge-base-en-v1.5',
          description: 'BAAI General Embedding Base EN v1.5',
          dimensions: 768,
          maxTokens: 512,
          recommended: true
        },
        {
          name: '@cf/baai/bge-small-en-v1.5',
          description: 'BAAI General Embedding Small EN v1.5',
          dimensions: 384,
          maxTokens: 512,
          recommended: false
        },
        {
          name: '@cf/baai/bge-large-en-v1.5',
          description: 'BAAI General Embedding Large EN v1.5',
          dimensions: 1024,
          maxTokens: 512,
          recommended: false
        }
      ]

      mockAIEmbeddings.getAvailableModels.mockResolvedValue(mockModels)

      const request = new Request('http://localhost/embeddings/models', {
        method: 'GET'
      })

      const response = await app.fetch(request, mockEnv)
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(mockAIEmbeddings.getAvailableModels).toHaveBeenCalled()
      expect(result).toEqual({
        success: true,
        data: mockModels
      })
    })

    it('should handle empty models list', async () => {
      mockAIEmbeddings.getAvailableModels.mockResolvedValue([])

      const request = new Request('http://localhost/embeddings/models', {
        method: 'GET'
      })

      const response = await app.fetch(request, mockEnv)
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result).toEqual({
        success: true,
        data: []
      })
    })

    it('should handle Durable Object errors', async () => {
      mockAIEmbeddings.getAvailableModels.mockRejectedValue(new Error('Failed to fetch models'))

      const request = new Request('http://localhost/embeddings/models', {
        method: 'GET'
      })

      const response = await app.fetch(request, mockEnv)
      const result = await response.json()

      expect(response.status).toBe(500)
      expect(result).toEqual({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch models'
      })
    })

    it('should handle non-Error exceptions', async () => {
      mockAIEmbeddings.getAvailableModels.mockRejectedValue('Unknown error')

      const request = new Request('http://localhost/embeddings/models', {
        method: 'GET'
      })

      const response = await app.fetch(request, mockEnv)
      const result = await response.json()

      expect(response.status).toBe(500)
      expect(result).toEqual({
        success: false,
        error: 'Internal Server Error',
        message: 'モデル一覧の取得中にエラーが発生しました'
      })
    })

    it('should handle network timeouts', async () => {
      mockAIEmbeddings.getAvailableModels.mockRejectedValue(new Error('Request timeout'))

      const request = new Request('http://localhost/embeddings/models', {
        method: 'GET'
      })

      const response = await app.fetch(request, mockEnv)
      const result = await response.json()

      expect(response.status).toBe(500)
      expect(result.message).toBe('Request timeout')
    })
  })
})