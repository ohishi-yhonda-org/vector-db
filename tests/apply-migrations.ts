import { applyD1Migrations, env } from 'cloudflare:test'
import path from 'path'

try {
  console.log('Applying D1 migrations...')
  
  // Use the correct path approach like the GitHub example
  const migrationsPath = path.join(process.cwd(), 'migrations')
  console.log('Migrations path:', migrationsPath)
  
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  
  console.log('Migrations applied successfully')
} catch (error) {
  console.error('Error applying migrations:', error)
  
  // Fallback: apply migrations manually if the automatic approach fails
  console.log('Fallback: applying migrations manually...')
  
  try {
    // Create tables manually without foreign key constraints first
    await env.DB.exec(`CREATE TABLE IF NOT EXISTS notion_pages (id text PRIMARY KEY NOT NULL, object text NOT NULL, created_time text NOT NULL, last_edited_time text NOT NULL, created_by_id text NOT NULL, last_edited_by_id text NOT NULL, cover text, icon text, parent text NOT NULL, archived integer NOT NULL, in_trash integer NOT NULL, properties text NOT NULL, url text NOT NULL, public_url text, synced_at text DEFAULT CURRENT_TIMESTAMP NOT NULL)`)
    
    await env.DB.exec(`CREATE TABLE IF NOT EXISTS notion_blocks (id text PRIMARY KEY NOT NULL, page_id text NOT NULL, object text NOT NULL, type text NOT NULL, created_time text NOT NULL, last_edited_time text NOT NULL, created_by_id text NOT NULL, last_edited_by_id text NOT NULL, has_children integer NOT NULL, archived integer NOT NULL, in_trash integer NOT NULL, parent_id text, parent_type text NOT NULL, content text NOT NULL, plain_text text, order_index integer NOT NULL, synced_at text DEFAULT CURRENT_TIMESTAMP NOT NULL)`)
    
    await env.DB.exec(`CREATE TABLE IF NOT EXISTS notion_page_properties (id text PRIMARY KEY NOT NULL, page_id text NOT NULL, property_id text NOT NULL, property_name text NOT NULL, property_type text NOT NULL, property_value text NOT NULL, plain_text_value text, number_value real, synced_at text DEFAULT CURRENT_TIMESTAMP NOT NULL)`)
    
    await env.DB.exec(`CREATE TABLE IF NOT EXISTS notion_sync_jobs (id text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL, page_id text NOT NULL, job_type text NOT NULL, status text NOT NULL, started_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, completed_at text, error text, metadata text)`)
    
    await env.DB.exec(`CREATE TABLE IF NOT EXISTS notion_vector_relations (id text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL, notion_page_id text NOT NULL, notion_block_id text, vector_id text NOT NULL, vector_namespace text NOT NULL, content_type text NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL)`)
    
    console.log('Manual migration fallback completed successfully')
  } catch (fallbackError) {
    console.error('Fallback migration also failed:', fallbackError)
    throw fallbackError
  }
}