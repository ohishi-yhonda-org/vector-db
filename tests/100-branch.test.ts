/**
 * Final tests for 100% branch coverage
 */

import { describe, it, expect, vi } from 'vitest'
import app from '../src/index'

describe('100% Branch Coverage', () => {
  const env = {
    ENVIRONMENT: 'development',
    DEFAULT_EMBEDDING_MODEL: '@cf/baai/bge-base-en-v1.5',
    API_KEY: 'test-key',
    AI: {
      run: vi.fn()
    } as any,
    VECTORIZE_INDEX: {
      insert: vi.fn(),
      getByIds: vi.fn(),
      deleteByIds: vi.fn(),
      query: vi.fn()
    } as any
  }
  
  it('covers utils error branch', async () => {
    const res = await app.request('/', {}, env)
    expect(res.status).toBe(200)
    const data = await res.json() as any
    expect(data.status).toBe('ok')
  })
  
  it('covers getVector non-Error branch', async () => {
    const testEnv = {
      ...env,
      VECTORIZE_INDEX: {
        getByIds: vi.fn().mockRejectedValue('not an Error object')
      }
    } as any
    
    const res = await app.request('/api/vectors/test', {}, testEnv)
    expect(res.status).toBe(500)
    const data = await res.json() as any
    expect(data.error).toBe('not an Error object')
  })
  
  it('covers deleteVector non-Error branch', async () => {
    const testEnv = {
      ...env,
      VECTORIZE_INDEX: {
        deleteByIds: vi.fn().mockRejectedValue('not an Error object')
      }
    } as any
    
    const res = await app.request('/api/vectors/test', {
      method: 'DELETE'
    }, testEnv)
    expect(res.status).toBe(500)
    const data = await res.json() as any
    expect(data.error).toBe('not an Error object')
  })
  
  it('covers searchVectors non-Error branch', async () => {
    const testEnv = {
      ...env,
      VECTORIZE_INDEX: {
        query: vi.fn().mockRejectedValue('not an Error object')
      }
    } as any
    
    const res = await app.request('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vector: [0.1] })
    }, testEnv)
    expect(res.status).toBe(500)
    const data = await res.json() as any
    expect(data.error).toBe('not an Error object')
  })
  
  it('covers batchCreateVectors non-Error branch', async () => {
    const testEnv = {
      ...env,
      VECTORIZE_INDEX: {
        insert: vi.fn().mockRejectedValue('not an Error object')
      }
    } as any
    
    const res = await app.request('/api/vectors/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ values: [0.1] }])
    }, testEnv)
    expect(res.status).toBe(500)
    const data = await res.json() as any
    expect(data.error).toBe('not an Error object')
  })
})