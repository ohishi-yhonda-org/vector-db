/**
 * Tests for embeddings non-Error branches
 */

import { describe, it, expect, vi } from 'vitest'
import app from '../src/index'

describe('Embeddings Branch Coverage', () => {
  const env = {
    ENVIRONMENT: 'development',
    DEFAULT_EMBEDDING_MODEL: '@cf/baai/bge-base-en-v1.5',
    API_KEY: 'test-key',
    AI: { run: vi.fn() } as any,
    VECTORIZE_INDEX: {
      insert: vi.fn(),
      getByIds: vi.fn(),
      deleteByIds: vi.fn(),
      query: vi.fn()
    } as any
  }
  
  describe('Non-Error exceptions', () => {
    it('covers generateEmbedding non-Error branch', async () => {
      const testEnv = {
        ...env,
        AI: {
          run: vi.fn().mockRejectedValue('not an Error object')
        }
      } as any
      
      const res = await app.request('/api/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'test' })
      }, testEnv)
      
      expect(res.status).toBe(500)
      const data = await res.json() as any
      expect(data.error).toBe('not an Error object')
    })
    
    it('covers batchEmbedding non-Error branch', async () => {
      const testEnv = {
        ...env,
        AI: {
          run: vi.fn().mockRejectedValue('not an Error object')
        }
      } as any
      
      const res = await app.request('/api/embeddings/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: ['test'] })
      }, testEnv)
      
      expect(res.status).toBe(500)
      const data = await res.json() as any
      expect(data.error).toBe('not an Error object')
    })
  })
})