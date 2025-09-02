/**
 * Durable Object stubs for backward compatibility
 * 
 * These are minimal implementations to maintain compatibility
 * with the existing worker-configuration.d.ts
 */

import { DurableObject } from 'cloudflare:workers'

/**
 * VectorManager - stub implementation
 */
export class VectorManager extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    return new Response(JSON.stringify({ 
      message: 'VectorManager is deprecated in v2.0' 
    }), {
      status: 501,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * AIEmbeddings - stub implementation
 */
export class AIEmbeddings extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    return new Response(JSON.stringify({ 
      message: 'AIEmbeddings is deprecated in v2.0' 
    }), {
      status: 501,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * NotionManager - stub implementation
 */
export class NotionManager extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    return new Response(JSON.stringify({ 
      message: 'NotionManager is deprecated in v2.0' 
    }), {
      status: 501,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}