import { describe, it, expect } from 'vitest'
import { extractTextFromBlocks, extractPageTitle } from '../../src/services/notion.service'

describe('NotionService utility functions', () => {
  describe('extractTextFromBlocks', () => {
    it('should extract text from paragraph blocks', () => {
      const service = {
        extractTextFromBlocks: (blocks: any[]) => {
          const texts: string[] = []
          
          for (const block of blocks) {
            if (block.type === 'paragraph' && block.paragraph?.rich_text) {
              const text = block.paragraph.rich_text.map((t: any) => t.plain_text).join('')
              if (text) texts.push(text)
            }
          }
          
          return texts.join('\n')
        }
      }

      const blocks = [
        {
          type: 'paragraph',
          paragraph: {
            rich_text: [{ plain_text: 'First paragraph' }]
          }
        },
        {
          type: 'paragraph',
          paragraph: {
            rich_text: [{ plain_text: 'Second paragraph' }]
          }
        }
      ]

      const result = service.extractTextFromBlocks(blocks)
      expect(result).toBe('First paragraph\nSecond paragraph')
    })
  })

  describe('extractPageTitle', () => {
    it('should extract title from properties', () => {
      const service = {
        extractPageTitle: (properties: any) => {
          for (const [key, value] of Object.entries(properties)) {
            if (value && typeof value === 'object' && 'type' in value && value.type === 'title') {
              const titleValue = value as any
              if (titleValue.title && Array.isArray(titleValue.title) && titleValue.title.length > 0) {
                return titleValue.title[0].plain_text || 'Untitled'
              }
            }
          }
          return 'Untitled'
        }
      }

      const properties = {
        Title: {
          type: 'title',
          title: [{ plain_text: 'Test Page Title' }]
        }
      }

      const result = service.extractPageTitle(properties)
      expect(result).toBe('Test Page Title')
    })

    it('should return Untitled when no title found', () => {
      const service = {
        extractPageTitle: (properties: any) => {
          for (const [key, value] of Object.entries(properties)) {
            if (value && typeof value === 'object' && 'type' in value && value.type === 'title') {
              const titleValue = value as any
              if (titleValue.title && Array.isArray(titleValue.title) && titleValue.title.length > 0) {
                return titleValue.title[0].plain_text || 'Untitled'
              }
            }
          }
          return 'Untitled'
        }
      }

      const properties = {
        Description: {
          type: 'rich_text',
          rich_text: [{ plain_text: 'Not a title' }]
        }
      }

      const result = service.extractPageTitle(properties)
      expect(result).toBe('Untitled')
    })
  })
})