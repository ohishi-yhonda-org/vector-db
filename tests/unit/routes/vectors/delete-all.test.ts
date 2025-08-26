import { describe, it, expect, vi, beforeEach } from 'vitest'
import { app } from '../../../../src/index'

// Envをモック
const mockEnv = {
  DB: {} as any,
  VECTORIZE_INDEX: {} as any,
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

describe('Delete All Vectors Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should delete all vectors with confirmation', async () => {
    const mockVectorManager = {
      deleteAllVectors: vi.fn().mockResolvedValue({
        deletedCount: 10,
        success: true
      })
    }

    mockEnv.VECTOR_CACHE.idFromName.mockReturnValue('test-id')
    mockEnv.VECTOR_CACHE.get.mockReturnValue(mockVectorManager)

    const response = await app.request('/api/vectors/all?confirm=DELETE_ALL', {
      method: 'DELETE'
    }, mockEnv)

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json).toEqual({
      success: true,
      data: {
        deletedCount: 10,
        message: '全namespaceの全ベクトルを削除しました'
      },
      message: '10件のベクトルを削除しました'
    })

    expect(mockVectorManager.deleteAllVectors).toHaveBeenCalledWith(undefined)
  })

  it('should delete vectors in specific namespace', async () => {
    const mockVectorManager = {
      deleteAllVectors: vi.fn().mockResolvedValue({
        deletedCount: 5,
        success: true
      })
    }

    mockEnv.VECTOR_CACHE.idFromName.mockReturnValue('test-id')
    mockEnv.VECTOR_CACHE.get.mockReturnValue(mockVectorManager)

    const response = await app.request('/api/vectors/all?confirm=DELETE_ALL&namespace=test-namespace', {
      method: 'DELETE'
    }, mockEnv)

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json).toEqual({
      success: true,
      data: {
        deletedCount: 5,
        message: 'Namespace "test-namespace" 内の全ベクトルを削除しました'
      },
      message: '5件のベクトルを削除しました'
    })

    expect(mockVectorManager.deleteAllVectors).toHaveBeenCalledWith('test-namespace')
  })

  it('should require confirmation', async () => {
    const response = await app.request('/api/vectors/all', {
      method: 'DELETE'
    }, mockEnv)

    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json).toEqual({
      success: false,
      error: 'Bad Request',
      message: '確認パラメータが不正です。confirm=DELETE_ALLを指定してください。'
    })
  })

  it('should reject wrong confirmation', async () => {
    const response = await app.request('/api/vectors/all?confirm=wrong', {
      method: 'DELETE'
    }, mockEnv)

    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json).toEqual({
      success: false,
      error: 'Bad Request',
      message: '確認パラメータが不正です。confirm=DELETE_ALLを指定してください。'
    })
  })

  it('should handle deletion errors', async () => {
    const mockVectorManager = {
      deleteAllVectors: vi.fn().mockRejectedValue(new Error('Deletion failed'))
    }

    mockEnv.VECTOR_CACHE.idFromName.mockReturnValue('test-id')
    mockEnv.VECTOR_CACHE.get.mockReturnValue(mockVectorManager)

    const response = await app.request('/api/vectors/all?confirm=DELETE_ALL', {
      method: 'DELETE'
    }, mockEnv)

    expect(response.status).toBe(500)
    const json = await response.json()
    expect(json).toEqual({
      success: false,
      error: 'Internal Server Error',
      message: 'Deletion failed'
    })
  })

  it('should handle zero deleted vectors', async () => {
    const mockVectorManager = {
      deleteAllVectors: vi.fn().mockResolvedValue({
        deletedCount: 0,
        success: true
      })
    }

    mockEnv.VECTOR_CACHE.idFromName.mockReturnValue('test-id')
    mockEnv.VECTOR_CACHE.get.mockReturnValue(mockVectorManager)

    const response = await app.request('/api/vectors/all?confirm=DELETE_ALL', {
      method: 'DELETE'
    }, mockEnv)

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json).toEqual({
      success: true,
      data: {
        deletedCount: 0,
        message: '全namespaceの全ベクトルを削除しました'
      },
      message: '0件のベクトルを削除しました'
    })
  })
})