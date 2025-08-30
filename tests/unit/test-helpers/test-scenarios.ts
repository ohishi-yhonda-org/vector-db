import { vi } from 'vitest'
import { OpenAPIHono } from '@hono/zod-openapi'
import { createMockEnv } from './mock-env'
import { 
  createMockVectorManager, 
  createMockNotionManager,
  createMockVectorizeIndex,
  createMockDurableObjectNamespace 
} from './mock-durable-objects'

/**
 * Common test scenario setup for vector routes
 */
export function setupVectorRouteTest() {
  const mockVectorManager = createMockVectorManager()
  const mockVectorizeIndex = createMockVectorizeIndex()
  const mockVectorCacheNamespace = createMockDurableObjectNamespace(mockVectorManager)
  
  const mockEnv = createMockEnv({
    VECTOR_CACHE: mockVectorCacheNamespace as any,
    VECTORIZE_INDEX: mockVectorizeIndex as any
  })
  
  const app = new OpenAPIHono<{ Bindings: Env }>()
  
  return {
    app,
    mockEnv,
    mockVectorManager,
    mockVectorizeIndex,
    mockVectorCacheNamespace
  }
}

/**
 * Common test scenario setup for Notion routes
 */
export function setupNotionRouteTest() {
  const mockNotionManager = createMockNotionManager()
  const mockNotionManagerNamespace = createMockDurableObjectNamespace(mockNotionManager, 'notion')
  
  const mockEnv = createMockEnv({
    NOTION_MANAGER: mockNotionManagerNamespace as any,
    NOTION_API_KEY: 'test-notion-api-key'
  })
  
  const app = new OpenAPIHono<{ Bindings: Env }>()
  
  return {
    app,
    mockEnv,
    mockNotionManager,
    mockNotionManagerNamespace
  }
}

/**
 * Common test scenario setup for search routes
 */
export function setupSearchRouteTest() {
  const mockVectorManager = createMockVectorManager()
  const mockVectorizeIndex = createMockVectorizeIndex()
  const mockVectorCacheNamespace = createMockDurableObjectNamespace(mockVectorManager)
  
  const mockEnv = createMockEnv({
    VECTOR_CACHE: mockVectorCacheNamespace as any,
    VECTORIZE_INDEX: mockVectorizeIndex as any
  })
  
  const app = new OpenAPIHono<{ Bindings: Env }>()
  
  return {
    app,
    mockEnv,
    mockVectorManager,
    mockVectorizeIndex,
    mockVectorCacheNamespace
  }
}

/**
 * Common test scenario setup for file processing routes
 */
export function setupFileProcessingRouteTest() {
  const mockVectorManager = createMockVectorManager()
  const mockVectorCacheNamespace = createMockDurableObjectNamespace(mockVectorManager)
  
  const mockFileProcessingWorkflow = {
    create: vi.fn(),
    get: vi.fn()
  }
  
  const mockEnv = createMockEnv({
    VECTOR_CACHE: mockVectorCacheNamespace as any,
    FILE_PROCESSING_WORKFLOW: mockFileProcessingWorkflow as any
  })
  
  const app = new OpenAPIHono<{ Bindings: Env }>()
  
  return {
    app,
    mockEnv,
    mockVectorManager,
    mockVectorCacheNamespace,
    mockFileProcessingWorkflow
  }
}

/**
 * Common test scenario setup for embeddings routes
 */
export function setupEmbeddingsRouteTest() {
  const mockEmbeddingsWorkflow = {
    create: vi.fn(),
    get: vi.fn()
  }
  
  const mockBatchEmbeddingsWorkflow = {
    create: vi.fn(),
    get: vi.fn()
  }
  
  const mockEnv = createMockEnv({
    EMBEDDINGS_WORKFLOW: mockEmbeddingsWorkflow as any,
    BATCH_EMBEDDINGS_WORKFLOW: mockBatchEmbeddingsWorkflow as any
  })
  
  const app = new OpenAPIHono<{ Bindings: Env }>()
  
  return {
    app,
    mockEnv,
    mockEmbeddingsWorkflow,
    mockBatchEmbeddingsWorkflow
  }
}