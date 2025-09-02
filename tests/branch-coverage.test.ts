/**
 * Tests for 100% branch coverage
 */

import { describe, it, expect, vi } from 'vitest'
import app from '../src/index'
import { createMockEnv } from './hono-test-helper'

describe('Branch Coverage Tests', () => {
  const env = createMockEnv()
  
  describe('Non-Error exceptions (false branches)', () => {
    it('handles non-Error in generateEmbedding', async () => {
      // Create a mock that throws a string instead of Error
      const badEnv = {
        ...env,
        AI: {
          run: vi.fn().mockRejectedValue('string error not Error object')
        }
      } as any
      
      const res = await app.request('/api/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'test' })
      }, badEnv)
      
      expect(res.status).toBe(500)
      const data = await res.json() as any
      expect(data.error).toBe('string error not Error object')
    })
    
    it('handles non-Error in batchEmbedding', async () => {
      const badEnv = {
        ...env,
        AI: {
          run: vi.fn().mockRejectedValue('string error not Error object')
        }
      } as any
      
      const res = await app.request('/api/embeddings/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: ['test1', 'test2'] })
      }, badEnv)
      
      expect(res.status).toBe(500)
      const data = await res.json() as any
      expect(data.error).toBe('string error not Error object')
    })
    
    it('handles non-Error in getVector', async () => {
      const badEnv = {
        ...env,
        VECTORIZE_INDEX: {
          ...env.VECTORIZE_INDEX,
          getByIds: vi.fn().mockRejectedValue('string error not Error object')
        }
      } as any
      
      const res = await app.request('/api/vectors/test-id', {}, badEnv)
      
      expect(res.status).toBe(500)
      const data = await res.json() as any
      expect(data.error).toBe('string error not Error object')
    })
    
    it('handles non-Error in deleteVector', async () => {
      const badEnv = {
        ...env,
        VECTORIZE_INDEX: {
          ...env.VECTORIZE_INDEX,
          deleteByIds: vi.fn().mockRejectedValue('string error not Error object')
        }
      } as any
      
      const res = await app.request('/api/vectors/test-id', {
        method: 'DELETE'
      }, badEnv)
      
      expect(res.status).toBe(500)
      const data = await res.json() as any
      expect(data.error).toBe('string error not Error object')
    })
    
    it('handles non-Error in searchVectors', async () => {
      const badEnv = {
        ...env,
        VECTORIZE_INDEX: {
          ...env.VECTORIZE_INDEX,
          query: vi.fn().mockRejectedValue('string error not Error object')
        }
      } as any
      
      const res = await app.request('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vector: [0.1, 0.2] })
      }, badEnv)
      
      expect(res.status).toBe(500)
      const data = await res.json() as any
      expect(data.error).toBe('string error not Error object')
    })
    
    it('handles non-Error in batchCreateVectors', async () => {
      const badEnv = {
        ...env,
        VECTORIZE_INDEX: {
          ...env.VECTORIZE_INDEX,
          insert: vi.fn().mockRejectedValue('string error not Error object')
        }
      } as any
      
      const res = await app.request('/api/vectors/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ values: [0.1, 0.2] }])
      }, badEnv)
      
      expect(res.status).toBe(500)
      const data = await res.json() as any
      expect(data.error).toBe('string error not Error object')
    })
  })
})