/**
 * Vector operations (CRUD and search)
 */

import { z } from 'zod'
import type { Context } from 'hono'
import type { Env } from '../worker-configuration'

// Schemas
const CreateVectorSchema = z.object({
  id: z.string().optional(),
  values: z.array(z.number()),
  metadata: z.record(z.string(), z.any()).optional()
})

const SearchSchema = z.object({
  vector: z.array(z.number()).optional(),
  text: z.string().optional(),
  topK: z.number().int().min(1).max(100).default(10),
  filter: z.record(z.string(), z.any()).optional()
})

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `vec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Create a new vector
 */
export async function createVector(c: Context<{ Bindings: Env }>): Promise<Response> {
  try {
    const body = await c.req.json()
    const parsed = CreateVectorSchema.parse(body)
    const id = parsed.id || generateId()
    
    await c.env.VECTORIZE_INDEX.insert([{
      id,
      values: parsed.values,
      metadata: parsed.metadata || {}
    }])
    
    return c.json({
      success: true,
      data: { id },
      message: 'Vector created successfully'
    })
  } catch (err) {
    console.error('Create vector error:', err)
    if (err instanceof z.ZodError) {
      return c.json({ success: false, error: `Invalid request: ${err.errors[0].message}` }, 400)
    }
    if (err instanceof Error) {
      return c.json({ success: false, error: err.message }, 500)
    }
    return c.json({ success: false, error: String(err) }, 500)
  }
}

/**
 * Get vector by ID
 */
export async function getVector(c: Context<{ Bindings: Env }>, id: string): Promise<Response> {
  try {
    const vectors = await c.env.VECTORIZE_INDEX.getByIds([id])
    
    if (!vectors || vectors.length === 0) {
      return c.json({ success: false, error: 'Vector not found' }, 404)
    }
    
    return c.json({
      success: true,
      data: vectors[0]
    })
  } catch (err: any) {
    console.error('Get vector error:', err)
    return c.json({ success: false, error: err?.message || String(err) }, 500)
  }
}

/**
 * Delete vector by ID
 */
export async function deleteVector(c: Context<{ Bindings: Env }>, id: string): Promise<Response> {
  try {
    const result = await c.env.VECTORIZE_INDEX.deleteByIds([id])
    
    if (result.count === 0) {
      return c.json({ success: false, error: 'Vector not found' }, 404)
    }
    
    return c.json({
      success: true,
      data: { deleted: true },
      message: 'Vector deleted successfully'
    })
  } catch (err: any) {
    console.error('Delete vector error:', err)
    return c.json({ success: false, error: err?.message || String(err) }, 500)
  }
}

/**
 * Search vectors
 */
export async function searchVectors(c: Context<{ Bindings: Env }>): Promise<Response> {
  try {
    const body = await c.req.json()
    const parsed = SearchSchema.parse(body)
    
    let queryVector: number[]
    
    if (parsed.vector) {
      queryVector = parsed.vector
    } else if (parsed.text) {
      // Generate embedding for text search
      const model = c.env.DEFAULT_EMBEDDING_MODEL
      const result = await c.env.AI.run(model, {
        text: [parsed.text]
      })
      queryVector = result.data?.[0]
      if (!queryVector) {
        throw new Error('Failed to generate search embedding')
      }
    } else {
      return c.json({ success: false, error: 'Either vector or text must be provided' }, 400)
    }
    
    const results = await c.env.VECTORIZE_INDEX.query(queryVector, {
      topK: parsed.topK,
      filter: parsed.filter
    })
    
    return c.json({
      success: true,
      data: {
        matches: results.matches,
        count: results.count
      }
    })
  } catch (err) {
    console.error('Search error:', err)
    if (err instanceof z.ZodError) {
      return c.json({ success: false, error: `Invalid request: ${err.errors[0].message}` }, 400)
    }
    if (err instanceof Error) {
      return c.json({ success: false, error: err.message }, 500)
    }
    return c.json({ success: false, error: String(err) }, 500)
  }
}

/**
 * Batch create vectors
 */
export async function batchCreateVectors(c: Context<{ Bindings: Env }>): Promise<Response> {
  try {
    const body = await c.req.json() as any[]
    
    if (!Array.isArray(body) || body.length === 0) {
      return c.json({ success: false, error: 'Request body must be a non-empty array' }, 400)
    }
    
    const vectors = body.map(item => ({
      id: item.id || generateId(),
      values: item.values,
      metadata: item.metadata || {}
    }))
    
    await c.env.VECTORIZE_INDEX.insert(vectors)
    
    return c.json({
      success: true,
      data: {
        count: vectors.length,
        ids: vectors.map(v => v.id)
      },
      message: `${vectors.length} vectors created successfully`
    })
  } catch (err: any) {
    console.error('Batch create error:', err)
    return c.json({ success: false, error: err?.message || String(err) }, 500)
  }
}