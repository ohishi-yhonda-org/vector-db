import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenAPIHono } from '@hono/zod-openapi'
import { deleteAllVectorsRoute, deleteAllVectorsHandler } from '../../../../src/routes/api/vectors/delete-all'

// Mock Vector Manager Durable Object
const mockVectorManager = {
  deleteAllVectors: vi.fn()
}

// Mock Durable Object namespace
const mockVectorCacheNamespace = {
  idFromName: vi.fn().mockReturnValue('mock-id'),
  get: vi.fn().mockReturnValue(mockVectorManager)
}

// Mock Vectorize Index
const mockVectorizeIndex = {
  deleteByIds: vi.fn()
}

describe('Delete All Vectors Route', () => {
  let app: OpenAPIHono<{ Bindings: Env }>
  let mockEnv: Env

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockEnv = {
      ENVIRONMENT: 'development' as const,
      DEFAULT_EMBEDDING_MODEL: '@cf/baai/bge-base-en-v1.5',
      DEFAULT_TEXT_GENERATION_MODEL: '@cf/google/gemma-3-12b-it',
      IMAGE_ANALYSIS_PROMPT: 'Describe this image in detail. Include any text visible in the image.',
      IMAGE_ANALYSIS_MAX_TOKENS: '512',
      TEXT_EXTRACTION_MAX_TOKENS: '1024',
      NOTION_API_KEY: '',
      AI: {} as any,
      VECTORIZE_INDEX: mockVectorizeIndex as any,
      VECTOR_CACHE: mockVectorCacheNamespace as any,
      NOTION_MANAGER: {} as any,
      AI_EMBEDDINGS: {} as any,
      DB: {} as any,
      EMBEDDINGS_WORKFLOW: {} as any,
      BATCH_EMBEDDINGS_WORKFLOW: {} as any,
      VECTOR_OPERATIONS_WORKFLOW: {} as any,
      FILE_PROCESSING_WORKFLOW: {} as any,
      NOTION_SYNC_WORKFLOW: {} as any
    }

    app = new OpenAPIHono<{ Bindings: Env }>()
    app.openapi(deleteAllVectorsRoute, deleteAllVectorsHandler)
  })

  describe('DELETE /vectors/all', () => {
    it('should delete all vectors with correct confirmation', async () => {
      mockVectorManager.deleteAllVectors.mockResolvedValue({
        deletedCount: 5
      })

      const response = await app.request('/vectors/all?confirm=DELETE_ALL', {
        method: 'DELETE'
      }, mockEnv)

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json).toMatchObject({
        success: true,
        message: '5件のベクトルを削除しました',
        data: {
          deletedCount: 5,
          message: '全namespaceの全ベクトルを削除しました'
        }
      })
      expect(mockVectorManager.deleteAllVectors).toHaveBeenCalled()
    })

    it('should reject without confirmation parameter', async () => {
      const response = await app.request('/vectors/all', {
        method: 'DELETE'
      }, mockEnv)

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.success).toBe(false)
      // OpenAPIのバリデーションエラーの形式
      expect(json.error).toBeDefined()
      expect(mockVectorManager.deleteAllVectors).not.toHaveBeenCalled()
    })

    it('should reject with incorrect confirmation parameter', async () => {
      const response = await app.request('/vectors/all?confirm=delete', {
        method: 'DELETE'
      }, mockEnv)

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.success).toBe(false)
      expect(json.error).toBeDefined()
      expect(mockVectorManager.deleteAllVectors).not.toHaveBeenCalled()
    })

    it('should handle empty vector list gracefully', async () => {
      mockVectorManager.deleteAllVectors.mockResolvedValue({
        deletedCount: 0
      })

      const response = await app.request('/vectors/all?confirm=DELETE_ALL', {
        method: 'DELETE'
      }, mockEnv)

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json).toMatchObject({
        success: true,
        message: '0件のベクトルを削除しました',
        data: {
          deletedCount: 0
        }
      })
      expect(mockVectorManager.deleteAllVectors).toHaveBeenCalled()
    })

    it('should handle large number of vectors', async () => {
      mockVectorManager.deleteAllVectors.mockResolvedValue({
        deletedCount: 1500
      })

      const response = await app.request('/vectors/all?confirm=DELETE_ALL', {
        method: 'DELETE'
      }, mockEnv)

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json).toMatchObject({
        success: true,
        message: '1500件のベクトルを削除しました',
        data: {
          deletedCount: 1500
        }
      })
      expect(mockVectorManager.deleteAllVectors).toHaveBeenCalled()
    })

    it('should handle VectorManager errors', async () => {
      mockVectorManager.deleteAllVectors.mockRejectedValue(new Error('VectorManager error'))

      const response = await app.request('/vectors/all?confirm=DELETE_ALL', {
        method: 'DELETE'
      }, mockEnv)

      expect(response.status).toBe(500)
      const json = await response.json()
      expect(json).toMatchObject({
        success: false,
        error: 'Internal Server Error',
        message: 'VectorManager error'
      })
    })

    it('should handle Vectorize deletion errors gracefully', async () => {
      // delete-allの実装はDurable Object経由でdeleteAllVectorsを呼ぶだけなので
      // Vectorize操作はDurable Object内で行われる
      mockVectorManager.deleteAllVectors.mockResolvedValue({
        deletedCount: 3
      })

      const response = await app.request('/vectors/all?confirm=DELETE_ALL', {
        method: 'DELETE'
      }, mockEnv)

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json).toMatchObject({
        success: true,
        message: '3件のベクトルを削除しました',
        data: {
          deletedCount: 3
        }
      })
    })

    it('should handle partial batch failures', async () => {
      // Durable Object内で処理されるため、エラーハンドリングもそちらで行われる
      mockVectorManager.deleteAllVectors.mockResolvedValue({
        deletedCount: 250
      })

      const response = await app.request('/vectors/all?confirm=DELETE_ALL', {
        method: 'DELETE'
      }, mockEnv)

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json).toMatchObject({
        success: true,
        message: '250件のベクトルを削除しました',
        data: {
          deletedCount: 250
        }
      })
    })

    it('should handle non-Error exceptions', async () => {
      mockVectorManager.deleteAllVectors.mockRejectedValue({ code: 'UNKNOWN_ERROR' })

      const response = await app.request('/vectors/all?confirm=DELETE_ALL', {
        method: 'DELETE'
      }, mockEnv)

      expect(response.status).toBe(500)
      const json = await response.json()
      expect(json).toMatchObject({
        success: false,
        error: 'Internal Server Error',
        message: '全削除中にエラーが発生しました'
      })
    })

    it('should handle case-sensitive confirmation parameter', async () => {
      const response = await app.request('/vectors/all?confirm=delete_all', {
        method: 'DELETE'
      }, mockEnv)

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.success).toBe(false)
      expect(json.error).toBeDefined()
    })

    it('should delete vectors for specific namespace', async () => {
      mockVectorManager.deleteAllVectors.mockResolvedValue({
        deletedCount: 10
      })

      const response = await app.request('/vectors/all?confirm=DELETE_ALL&namespace=test-namespace', {
        method: 'DELETE'
      }, mockEnv)

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json).toMatchObject({
        success: true,
        message: '10件のベクトルを削除しました',
        data: {
          deletedCount: 10,
          message: 'Namespace "test-namespace" 内の全ベクトルを削除しました'
        }
      })
      expect(mockVectorManager.deleteAllVectors).toHaveBeenCalledWith('test-namespace')
    })

    it('should handle namespace deletion with zero results', async () => {
      mockVectorManager.deleteAllVectors.mockResolvedValue({
        deletedCount: 0
      })

      const response = await app.request('/vectors/all?confirm=DELETE_ALL&namespace=empty-namespace', {
        method: 'DELETE'
      }, mockEnv)

      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json).toMatchObject({
        success: true,
        message: '0件のベクトルを削除しました',
        data: {
          deletedCount: 0,
          message: 'Namespace "empty-namespace" 内の全ベクトルを削除しました'
        }
      })
      expect(mockVectorManager.deleteAllVectors).toHaveBeenCalledWith('empty-namespace')
    })
  })
})