/**
 * Tests with vectorize mock throwing non-Error objects
 */

import { describe, it, expect, vi } from 'vitest'
import app from '../src/index'

describe('Vectorize Mock Tests', () => {
  const env = {
    ENVIRONMENT: 'development',
    DEFAULT_EMBEDDING_MODEL: '@cf/baai/bge-base-en-v1.5',
    API_KEY: 'test-key',
    AI: { 
      run: vi.fn().mockResolvedValue({ data: [[0.1, 0.2]] })
    } as any,
    VECTORIZE_INDEX: {} as any
  }
  
  it('handles non-Error from getByIds', async () => {
    const testEnv = {
      ...env,
      VECTORIZE_INDEX: {
        getByIds: vi.fn().mockRejectedValue(123) // number instead of Error
      }
    } as any
    
    const res = await app.request('/api/vectors/test', {}, testEnv)
    expect(res.status).toBe(500)
    const data = await res.json() as any
    expect(data.error).toBe('123')
  })
  
  it('handles non-Error from deleteByIds', async () => {
    const testEnv = {
      ...env,
      VECTORIZE_INDEX: {
        deleteByIds: vi.fn().mockRejectedValue({ code: 'FAIL' }) // object instead of Error
      }
    } as any
    
    const res = await app.request('/api/vectors/test', {
      method: 'DELETE'
    }, testEnv)
    expect(res.status).toBe(500)
    const data = await res.json() as any
    expect(data.error).toBe('[object Object]')
  })
  
  it('handles non-Error from insert', async () => {
    const testEnv = {
      ...env,
      VECTORIZE_INDEX: {
        insert: vi.fn().mockRejectedValue(null) // null instead of Error
      }
    } as any
    
    const res = await app.request('/api/vectors/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ values: [0.1, 0.2] }])
    }, testEnv)
    expect(res.status).toBe(500)
    const data = await res.json() as any
    expect(data.error).toBe('null')
  })
  
  it('handles non-Error from query', async () => {
    const testEnv = {
      ...env,
      VECTORIZE_INDEX: {
        query: vi.fn().mockRejectedValue(undefined) // undefined instead of Error
      }
    } as any
    
    const res = await app.request('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vector: [0.1, 0.2] })
    }, testEnv)
    expect(res.status).toBe(500)
    const data = await res.json() as any
    expect(data.error).toBe('undefined')
  })
  
  it('handles non-Error from createVector insert', async () => {
    const testEnv = {
      ...env,
      VECTORIZE_INDEX: {
        insert: vi.fn().mockRejectedValue(false) // boolean instead of Error
      }
    } as any
    
    const res = await app.request('/api/vectors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [0.1, 0.2] })
    }, testEnv)
    expect(res.status).toBe(500)
    const data = await res.json() as any
    expect(data.error).toBe('false')
  })
})