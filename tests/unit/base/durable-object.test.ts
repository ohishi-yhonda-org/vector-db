import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BaseDurableObject } from '../../../src/base/durable-object'
import { AppError, ErrorCodes } from '../../../src/utils/error-handler'

// Mock error handler
vi.mock('../../../src/utils/error-handler', () => ({
  AppError: class extends Error {
    constructor(public code: string, message: string, public statusCode: number, public originalError?: any) {
      super(message)
      this.name = 'AppError'
    }
  },
  ErrorCodes: {
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    DURABLE_OBJECT_ERROR: 'DURABLE_OBJECT_ERROR'
  },
  logError: vi.fn()
}))

// Test implementation
class TestDurableObject extends BaseDurableObject {
  async testGetFromStorage(key: string) {
    return this.getFromStorage(key)
  }

  async testPutToStorage(key: string, value: any) {
    return this.putToStorage(key, value)
  }

  async testDeleteFromStorage(key: string) {
    return this.deleteFromStorage(key)
  }

  async testGetMultiple(keys: string[]) {
    return this.getMultipleFromStorage(keys)
  }

  async testPutMultiple(entries: Record<string, any>) {
    return this.putMultipleToStorage(entries)
  }

  async testGetMultiple(keys: string[]) {
    return this.getMultipleFromStorage(keys)
  }

  async testTransaction(fn: any) {
    return this.transaction(fn)
  }

  async testSetAlarm(delayMs: number) {
    return this.setAlarm(delayMs)
  }

  async testDeleteAlarm() {
    return this.deleteAlarm()
  }

  protected async handleRequest(request: Request, method: string, path: string): Promise<Response> {
    if (path === '/test') {
      return new Response('test response')
    }
    return new Response('Not found', { status: 404 })
  }

  async testGetState() {
    return this.getState()
  }

  async testSetState(newState: any) {
    return this.setState(newState)
  }
}

describe('BaseDurableObject', () => {
  let durableObject: TestDurableObject
  let mockCtx: any
  let mockEnv: any
  let mockStorage: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockStorage = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
      deleteAll: vi.fn(),
      transaction: vi.fn()
    }

    mockCtx = {
      storage: mockStorage,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    }

    mockEnv = {}

    durableObject = new TestDurableObject(mockCtx, mockEnv)
  })

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(durableObject).toBeDefined()
      expect((durableObject as any).ctx).toBe(mockCtx)
      expect((durableObject as any).storage).toBe(mockStorage)
      expect((durableObject as any).env).toBe(mockEnv)
    })
  })

  describe('getFromStorage', () => {
    it('should get value from storage', async () => {
      mockStorage.get.mockResolvedValue('test-value')
      
      const result = await durableObject.testGetFromStorage('test-key')
      
      expect(result).toBe('test-value')
      expect(mockStorage.get).toHaveBeenCalledWith('test-key')
    })

    it('should return undefined for non-existent key', async () => {
      mockStorage.get.mockResolvedValue(undefined)
      
      const result = await durableObject.testGetFromStorage('missing-key')
      
      expect(result).toBeUndefined()
    })

    it('should handle storage errors', async () => {
      mockStorage.get.mockRejectedValue(new Error('Storage error'))
      
      await expect(durableObject.testGetFromStorage('test-key'))
        .rejects.toThrow('Failed to get value from storage')
    })
  })

  describe('putToStorage', () => {
    it('should put value to storage', async () => {
      await durableObject.testPutToStorage('test-key', 'test-value')
      
      expect(mockStorage.put).toHaveBeenCalledWith('test-key', 'test-value')
    })

    it('should handle complex objects', async () => {
      const complexValue = { foo: 'bar', nested: { value: 123 } }
      
      await durableObject.testPutToStorage('complex-key', complexValue)
      
      expect(mockStorage.put).toHaveBeenCalledWith('complex-key', complexValue)
    })

    it('should handle storage errors', async () => {
      mockStorage.put.mockRejectedValue(new Error('Storage error'))
      
      await expect(durableObject.testPutToStorage('test-key', 'value'))
        .rejects.toThrow('Failed to put value to storage')
    })
  })

  describe('deleteFromStorage', () => {
    it('should delete value from storage', async () => {
      mockStorage.delete.mockResolvedValue(true)
      
      const result = await durableObject.testDeleteFromStorage('test-key')
      
      expect(result).toBe(true)
      expect(mockStorage.delete).toHaveBeenCalledWith('test-key')
    })

    it('should return false if key does not exist', async () => {
      mockStorage.delete.mockResolvedValue(false)
      
      const result = await durableObject.testDeleteFromStorage('missing-key')
      
      expect(result).toBe(false)
    })

    it('should handle storage errors', async () => {
      mockStorage.delete.mockRejectedValue(new Error('Storage error'))
      
      await expect(durableObject.testDeleteFromStorage('test-key'))
        .rejects.toThrow('Failed to delete value from storage')
    })
  })

  describe('getMultipleFromStorage', () => {
    it('should get multiple values from storage', async () => {
      const mockMap = new Map([
        ['key1', 'value1'],
        ['key2', 'value2']
      ])
      mockStorage.get.mockResolvedValue(mockMap)
      
      const result = await durableObject.testGetMultiple(['key1', 'key2'])
      
      expect(result).toBe(mockMap)
      expect(mockStorage.get).toHaveBeenCalledWith(['key1', 'key2'])
    })

    it('should handle empty array', async () => {
      mockStorage.get.mockResolvedValue(new Map())
      
      const result = await durableObject.testGetMultiple([])
      
      expect(result.size).toBe(0)
    })

    it('should handle storage errors', async () => {
      mockStorage.get.mockRejectedValue(new Error('Storage error'))
      
      await expect(durableObject.testGetMultiple(['key1', 'key2']))
        .rejects.toThrow('Failed to get multiple values from storage')
    })
  })

  describe('putMultipleToStorage', () => {
    it('should put multiple values to storage', async () => {
      const entries = {
        'key1': 'value1',
        'key2': 'value2'
      }
      
      await durableObject.testPutMultiple(entries)
      
      expect(mockStorage.put).toHaveBeenCalledWith(entries)
    })

    it('should handle empty object', async () => {
      await durableObject.testPutMultiple({})
      
      expect(mockStorage.put).toHaveBeenCalledWith({})
    })

    it('should handle storage errors', async () => {
      mockStorage.put.mockRejectedValue(new Error('Storage error'))
      
      await expect(durableObject.testPutMultiple({ 'key': 'value' }))
        .rejects.toThrow('Failed to put multiple values to storage')
    })
  })

  describe('setAlarm and deleteAlarm', () => {
    it('should set alarm', async () => {
      mockStorage.setAlarm = vi.fn()
      const delayMs = 5000
      
      await durableObject.testSetAlarm(delayMs)
      
      expect(mockStorage.setAlarm).toHaveBeenCalledWith(expect.any(Number))
    })

    it('should delete alarm', async () => {
      mockStorage.deleteAlarm = vi.fn()
      
      await durableObject.testDeleteAlarm()
      
      expect(mockStorage.deleteAlarm).toHaveBeenCalled()
    })

    it('should handle alarm set errors', async () => {
      mockStorage.setAlarm = vi.fn().mockRejectedValue(new Error('Alarm error'))
      
      await expect(durableObject.testSetAlarm(5000))
        .rejects.toThrow('Failed to set alarm')
    })

    it('should handle alarm delete errors', async () => {
      mockStorage.deleteAlarm = vi.fn().mockRejectedValue(new Error('Delete error'))
      
      await expect(durableObject.testDeleteAlarm())
        .rejects.toThrow('Failed to delete alarm')
    })
  })

  describe('state management', () => {
    it('should get and set state', async () => {
      const newState = { count: 5 }
      
      await durableObject.testSetState(newState)
      const state = await durableObject.testGetState()
      
      expect(state).toEqual(newState)
    })

    it('should merge state on setState', async () => {
      await durableObject.testSetState({ a: 1 })
      await durableObject.testSetState({ b: 2 })
      
      const state = await durableObject.testGetState()
      expect(state).toEqual({ a: 1, b: 2 })
    })
  })

  describe('transaction', () => {
    it('should run transaction successfully', async () => {
      const mockResult = 'tx-value'
      
      mockStorage.transaction.mockImplementation(async (fn) => {
        // トランザクション内で実行される関数をモック
        return await fn()
      })
      
      const result = await durableObject.testTransaction(async () => {
        // トランザクション内でストレージ操作を実行
        const value = await mockStorage.get('key')
        await mockStorage.put('key', 'new-value')
        return mockResult
      })
      
      expect(result).toBe('tx-value')
      expect(mockStorage.transaction).toHaveBeenCalled()
    })

    it('should handle transaction errors', async () => {
      mockStorage.transaction.mockRejectedValue(new Error('Transaction error'))
      
      await expect(durableObject.testTransaction(async () => {}))
        .rejects.toThrow('Transaction failed')
    })
  })

  describe('fetch', () => {
    it('should handle requests', async () => {
      const request = new Request('http://example.com/test')
      const response = await durableObject.fetch(request)
      
      expect(response.status).toBe(200)
      const text = await response.text()
      expect(text).toBe('test response')
    })

    it('should return 404 for unknown paths', async () => {
      const request = new Request('http://example.com/unknown')
      const response = await durableObject.fetch(request)
      
      expect(response.status).toBe(404)
    })

    it('should handle errors in request handling', async () => {
      const request = new Request('http://example.com/error')
      // Override handleRequest to throw error
      durableObject['handleRequest'] = vi.fn().mockRejectedValue(new Error('Handler error'))
      
      const response = await durableObject.fetch(request)
      
      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toBe('INTERNAL_ERROR')
    })
  })
})