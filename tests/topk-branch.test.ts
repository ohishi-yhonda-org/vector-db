/**
 * Test for topK fallback branch
 */

import { describe, it, expect, vi } from 'vitest'
import app from '../src/index'

describe('TopK Branch Coverage', () => {
  const env = {
    ENVIRONMENT: 'development',
    DEFAULT_EMBEDDING_MODEL: '@cf/baai/bge-base-en-v1.5',
    API_KEY: 'test-key',
    AI: { 
      run: vi.fn().mockResolvedValue({ data: [[0.1, 0.2]] })
    } as any,
    VECTORIZE_INDEX: {
      query: vi.fn().mockResolvedValue({ matches: [], count: 0 })
    } as any
  }
  
  it('uses default topK when not provided', async () => {
    const res = await app.request('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vector: [0.1, 0.2] })
    }, env)
    
    expect(res.status).toBe(200)
    expect(env.VECTORIZE_INDEX.query).toHaveBeenCalledWith(
      [0.1, 0.2],
      { topK: 10, filter: undefined }
    )
  })
})