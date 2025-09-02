/**
 * Vector DB - Simplified API
 * 
 * A clean, simple vector database API built on Cloudflare Workers
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { generateEmbedding, batchEmbedding } from './embeddings'
import { createVector, getVector, deleteVector, searchVectors, batchCreateVectors } from './vectors'

const app = new Hono<{ Bindings: Env }>()

// ============= Middleware =============

// CORS
app.use('*', cors())

// Authentication
app.use('/api/*', async (c, next) => {
  // Skip auth in development
  if (c.env.ENVIRONMENT === 'development') {
    return next()
  }
  
  const apiKey = c.req.header('X-API-Key') || c.req.header('Authorization')?.replace('Bearer ', '')
  if (apiKey !== c.env.API_KEY) {
    return c.json({ success: false, error: 'Unauthorized' }, 401)
  }
  
  await next()
})

// Request logging
app.use('*', async (c, next) => {
  const start = Date.now()
  await next()
  const duration = Date.now() - start
  console.log(`${c.req.method} ${c.req.path} - ${c.res.status} (${duration}ms)`)
})

// ============= Routes =============

// Health check
app.get('/', (c) => c.json({ 
  status: 'ok', 
  service: 'Vector DB',
  version: '2.0.0',
  endpoints: [
    'POST /api/embeddings',
    'POST /api/embeddings/batch',
    'POST /api/vectors',
    'GET /api/vectors/:id',
    'DELETE /api/vectors/:id',
    'POST /api/vectors/batch',
    'POST /api/search'
  ]
}))

// Embedding endpoints
app.post('/api/embeddings', async (c) => {
  return generateEmbedding(c)
})

app.post('/api/embeddings/batch', async (c) => {
  return batchEmbedding(c)
})

// Vector CRUD endpoints
app.post('/api/vectors', async (c) => {
  return createVector(c)
})

app.get('/api/vectors/:id', async (c) => {
  return getVector(c, c.req.param('id'))
})

app.delete('/api/vectors/:id', async (c) => {
  return deleteVector(c, c.req.param('id'))
})

app.post('/api/vectors/batch', async (c) => {
  return batchCreateVectors(c)
})

// Search endpoint
app.post('/api/search', async (c) => {
  return searchVectors(c)
})

// 404 handler
app.notFound((c) => {
  return c.json({ success: false, error: 'Not found' }, 404)
})

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ success: false, error: 'Internal server error' }, 500)
})

// ============= Export =============

export default app

