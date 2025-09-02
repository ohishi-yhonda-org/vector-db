/**
 * Hono Test Helper - Simplified version using app.request()
 */

import type { Hono } from 'hono'
import { expect } from 'vitest'

/**
 * Create mock environment for testing
 */
export function createMockEnv(): Env {
  return {
    ENVIRONMENT: 'development',
    DEFAULT_EMBEDDING_MODEL: '@cf/baai/bge-base-en-v1.5',
    DEFAULT_TEXT_GENERATION_MODEL: '@cf/google/gemma-3-12b-it',
    IMAGE_ANALYSIS_PROMPT: 'Describe this image in detail. Include any text visible in the image.',
    IMAGE_ANALYSIS_MAX_TOKENS: '512',
    TEXT_EXTRACTION_MAX_TOKENS: '1024',
    NOTION_API_KEY: '',
    API_KEY: '',
    VECTOR_CACHE: {} as any,
    VECTOR_MANAGER: {} as any,
    AI_EMBEDDINGS: {} as any,
    NOTION_MANAGER: {} as any,
    DB: {} as any,
    VECTORIZE_INDEX: {
      insert: async (vectors: any[]) => ({ count: vectors.length }),
      getByIds: async (ids: string[]) => ids.map(id => ({
        id,
        values: [0.1, 0.2, 0.3],
        metadata: { test: true }
      })),
      deleteByIds: async (ids: string[]) => ({ count: ids.length }),
      query: async (vector: number[], options?: any) => ({
        matches: [
          { id: 'test-id', score: 0.99, metadata: {} }
        ],
        count: 1
      })
    } as any,
    AI: {
      run: async () => ({
        data: [[0.1, 0.2, 0.3]]
      })
    } as any,
    EMBEDDINGS_WORKFLOW: {} as any,
    BATCH_EMBEDDINGS_WORKFLOW: {} as any,
    VECTOR_OPERATIONS_WORKFLOW: {} as any,
    FILE_PROCESSING_WORKFLOW: {} as any,
    NOTION_SYNC_WORKFLOW: {} as any
  }
}

/**
 * Helper to make requests using app.request()
 */
export async function testRequest(
  app: Hono<{ Bindings: Env }>,
  path: string,
  options?: {
    method?: string
    body?: any
    headers?: Record<string, string>
  },
  env?: Env
) {
  const method = options?.method || 'GET'
  const headers = options?.headers || {}
  
  if (options?.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }
  
  const body = options?.body 
    ? typeof options.body === 'string' 
      ? options.body 
      : JSON.stringify(options.body)
    : undefined
  
  return app.request(
    path,
    {
      method,
      headers,
      body
    },
    env || createMockEnv()
  )
}

/**
 * Helper for POST requests with JSON
 */
export async function postJson(
  app: Hono<{ Bindings: Env }>,
  path: string,
  data: any,
  env?: Env
) {
  return testRequest(app, path, {
    method: 'POST',
    body: data
  }, env)
}

/**
 * Helper for GET requests
 */
export async function get(
  app: Hono<{ Bindings: Env }>,
  path: string,
  env?: Env
) {
  return testRequest(app, path, {}, env)
}

/**
 * Helper for DELETE requests
 */
export async function del(
  app: Hono<{ Bindings: Env }>,
  path: string,
  env?: Env
) {
  return testRequest(app, path, { method: 'DELETE' }, env)
}

/**
 * Create production environment for testing
 */
export function createProdEnv(apiKey: string = 'secret'): any {
  const env = createMockEnv()
  return {
    ...env,
    ENVIRONMENT: 'production',
    API_KEY: apiKey
  }
}

/**
 * Assert JSON response
 */
export async function expectJson(response: Response) {
  const data = await response.json()
  return {
    toBe(expected: any) {
      expect(data).toEqual(expected)
    },
    toHaveProperty(prop: string, value?: any) {
      if (value !== undefined) {
        expect(data).toHaveProperty(prop, value)
      } else {
        expect(data).toHaveProperty(prop)
      }
    },
    toMatchObject(expected: any) {
      expect(data).toMatchObject(expected)
    },
    data // Return raw data for custom assertions
  }
}