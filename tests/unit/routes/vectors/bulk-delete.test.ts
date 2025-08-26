import { describe, it, expect, vi, beforeEach } from 'vitest'
import app from '../../../../src/index'

// レスポンスの型定義
interface BulkDeleteResponse {
  success: boolean
  data?: {
    requested: number
    deleted: number
    failed: number
    errors?: string[]
  }
  error?: string
  message: string
}

interface ErrorResponse {
  success: boolean
  error: string
  message: string
}

// Envをモック
const mockEnv = {
  DB: {} as any,
  VECTORIZE_INDEX: {
    deleteByIds: vi.fn()
  } as any,
  VECTOR_CACHE: {
    idFromName: vi.fn(),
    get: vi.fn()
  } as any,
  AI: {} as any,
  AI_EMBEDDINGS: {} as any,
  NOTION_MANAGER: {} as any,
  EMBEDDINGS_WORKFLOW: {} as any,
  BATCH_EMBEDDINGS_WORKFLOW: {} as any,
  VECTOR_OPERATIONS_WORKFLOW: {} as any,
  FILE_PROCESSING_WORKFLOW: {} as any,
  NOTION_SYNC_WORKFLOW: {} as any,
  ENVIRONMENT: 'development' as const,
  DEFAULT_EMBEDDING_MODEL: '@cf/baai/bge-base-en-v1.5' as const,
  DEFAULT_TEXT_GENERATION_MODEL: '@cf/google/gemma-3-12b-it' as const,
  IMAGE_ANALYSIS_PROMPT: 'Describe this image in detail. Include any text visible in the image.' as const,
  IMAGE_ANALYSIS_MAX_TOKENS: '512' as const,
  TEXT_EXTRACTION_MAX_TOKENS: '1024' as const,
  NOTION_API_KEY: '' as const
} satisfies Env

describe('Bulk Delete Vector Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should delete vectors successfully', async () => {
    const mockVectorManager = {
      removeDeletedVectors: vi.fn().mockResolvedValue(undefined)
    }

    mockEnv.VECTORIZE_INDEX.deleteByIds.mockResolvedValue({})
    mockEnv.VECTOR_CACHE.idFromName.mockReturnValue('test-id')
    mockEnv.VECTOR_CACHE.get.mockReturnValue(mockVectorManager)

    const response = await app.request('/api/vectors/bulk-delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ids: ['vec_1', 'vec_2', 'vec_3']
      })
    }, mockEnv)

    expect(response.status).toBe(200)
    const json = await response.json<BulkDeleteResponse | ErrorResponse>()
    expect(json).toEqual({
      success: true,
      data: {
        requested: 3,
        deleted: 3,
        failed: 0
      },
      message: '3件のベクトルを削除しました'
    })

    expect(mockEnv.VECTORIZE_INDEX.deleteByIds).toHaveBeenCalledWith(['vec_1', 'vec_2', 'vec_3'])
    expect(mockVectorManager.removeDeletedVectors).toHaveBeenCalledWith(['vec_1', 'vec_2', 'vec_3'])
  })

  it('should handle empty ID list', async () => {
    const response = await app.request('/api/vectors/bulk-delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ids: []
      })
    }, mockEnv)

    expect(response.status).toBe(400)
    const json = await response.json<BulkDeleteResponse | ErrorResponse>()
    expect(json).toEqual({
      success: false,
      error: 'Bad Request',
      message: 'IDリストが指定されていません'
    })
  })

  it('should handle too many IDs', async () => {
    const tooManyIds = Array.from({ length: 1001 }, (_, i) => `vec_${i}`)
    
    const response = await app.request('/api/vectors/bulk-delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ids: tooManyIds
      })
    }, mockEnv)

    expect(response.status).toBe(400)
    const json = await response.json<BulkDeleteResponse | ErrorResponse>()
    expect(json).toEqual({
      success: false,
      error: 'Bad Request',
      message: 'IDは最大1000件まで指定できます'
    })
  })

  it('should handle batch deletion with errors', async () => {
    const mockVectorManager = {
      removeDeletedVectors: vi.fn().mockResolvedValue(undefined)
    }

    // 最初のバッチは成功、2番目のバッチは失敗
    mockEnv.VECTORIZE_INDEX.deleteByIds
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('Delete failed'))

    mockEnv.VECTOR_CACHE.idFromName.mockReturnValue('test-id')
    mockEnv.VECTOR_CACHE.get.mockReturnValue(mockVectorManager)

    const ids = Array.from({ length: 150 }, (_, i) => `vec_${i}`)
    
    const response = await app.request('/api/vectors/bulk-delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ids })
    }, mockEnv)

    expect(response.status).toBe(200)
    const json = await response.json<BulkDeleteResponse | ErrorResponse>()
    expect(json.success).toBe(false)
    expect(json.data.requested).toBe(150)
    expect(json.data.deleted).toBe(100)
    expect(json.data.failed).toBe(50)
    expect(json.data.errors).toHaveLength(1)
  })

  it('should handle VectorManager update failure gracefully', async () => {
    const mockVectorManager = {
      removeDeletedVectors: vi.fn().mockRejectedValue(new Error('Update failed'))
    }

    mockEnv.VECTORIZE_INDEX.deleteByIds.mockResolvedValue({})
    mockEnv.VECTOR_CACHE.idFromName.mockReturnValue('test-id')
    mockEnv.VECTOR_CACHE.get.mockReturnValue(mockVectorManager)

    const response = await app.request('/api/vectors/bulk-delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ids: ['vec_1']
      })
    }, mockEnv)

    expect(response.status).toBe(200)
    const json = await response.json<BulkDeleteResponse | ErrorResponse>()
    expect(json).toEqual({
      success: true,
      data: {
        requested: 1,
        deleted: 1,
        failed: 0
      },
      message: '1件のベクトルを削除しました'
    })
  })

  it('should handle invalid JSON', async () => {
    const response = await app.request('/api/vectors/bulk-delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: 'invalid json'
    }, mockEnv)

    expect(response.status).toBe(400)
  })
})