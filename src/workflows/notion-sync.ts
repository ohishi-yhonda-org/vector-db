import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers'
import { z } from 'zod'
import { NotionService } from '../services/notion.service'
import { getDb } from '../db'
import { notionSyncJobs } from '../db/schema'
import { eq } from 'drizzle-orm'

// パラメータスキーマ
const NotionSyncParamsSchema = z.object({
  pageId: z.string(),
  notionToken: z.string(),
  includeBlocks: z.boolean().default(true),
  includeProperties: z.boolean().default(true),
  namespace: z.string().optional()
})

export type NotionSyncParams = z.infer<typeof NotionSyncParamsSchema>

export interface NotionSyncResult {
  success: boolean
  pageId: string
  blocksProcessed: number
  propertiesProcessed: number
  vectorsCreated: number
  error?: string
  completedAt: string
}

export class NotionSyncWorkflow extends WorkflowEntrypoint<Env, NotionSyncParams> {
  async run(event: WorkflowEvent<NotionSyncParams>, step: WorkflowStep): Promise<NotionSyncResult> {
    const params = NotionSyncParamsSchema.parse(event.payload)
    const notionService = new NotionService(this.env, params.notionToken)
    
    let blocksProcessed = 0
    let propertiesProcessed = 0
    let vectorsCreated = 0

    try {
      // Step 1: Notionページを取得して保存
      const page = await step.do('fetch-and-save-page', async () => {
        const page = await notionService.fetchPageFromNotion(params.pageId)
        if (!page) {
          throw new Error(`Page ${params.pageId} not found`)
        }
        await notionService.savePage(page)
        return page
      })

      // Step 2: ページタイトルをベクトル化
      const titleVector = await step.do('vectorize-page-title', async () => {
        const titleProperty = Object.values(page.properties).find(
          (prop: any) => prop.type === 'title'
        )
        
        if (!titleProperty) return null
        
        const titleText = titleProperty.title
          .map((rt: any) => rt.plain_text || '')
          .join('')
        
        if (!titleText) return null

        // VectorManagerを使用してベクトル作成
        const vectorManagerId = this.env.VECTOR_CACHE.idFromName('global')
        const vectorManager = this.env.VECTOR_CACHE.get(vectorManagerId)
        
        const result = await vectorManager.createVectorAsync(
          titleText,
          this.env.DEFAULT_EMBEDDING_MODEL,
          params.namespace || 'notion-pages',
          {
            source: 'notion',
            pageId: params.pageId,
            contentType: 'page_title',
            pageUrl: page.url
          }
        )

        // ベクトル関連を保存
        await notionService.saveVectorRelation(
          params.pageId,
          result.jobId,
          params.namespace || 'notion-pages',
          'page_title'
        )

        return result.jobId
      })

      if (titleVector) vectorsCreated++

      // Step 3: プロパティを処理
      if (params.includeProperties) {
        const propertiesResult = await step.do('process-properties', async () => {
          await notionService.savePageProperties(params.pageId, page.properties)
          
          const propertiesToVectorize: Array<{name: string, text: string}> = []
          
          // ベクトル化するプロパティを抽出
          for (const [name, prop] of Object.entries(page.properties)) {
            const property = prop as any
            if (['title', 'rich_text', 'select', 'multi_select'].includes(property.type)) {
              let text = ''
              
              if (property.type === 'title' || property.type === 'rich_text') {
                text = property[property.type]
                  ?.map((rt: any) => rt.plain_text || '')
                  .join('') || ''
              } else if (property.type === 'select') {
                text = property.select?.name || ''
              } else if (property.type === 'multi_select') {
                text = property.multi_select
                  ?.map((s: any) => s.name)
                  .join(', ') || ''
              }
              
              if (text) {
                propertiesToVectorize.push({ name, text })
              }
            }
          }

          // プロパティをベクトル化
          const vectorManagerId = this.env.VECTOR_CACHE.idFromName('global')
          const vectorManager = this.env.VECTOR_CACHE.get(vectorManagerId)
          
          for (const prop of propertiesToVectorize) {
            const result = await vectorManager.createVectorAsync(
              `${prop.name}: ${prop.text}`,
              this.env.DEFAULT_EMBEDDING_MODEL,
              params.namespace || 'notion-properties',
              {
                source: 'notion',
                pageId: params.pageId,
                contentType: 'property',
                propertyName: prop.name,
                pageUrl: page.url
              }
            )

            await notionService.saveVectorRelation(
              params.pageId,
              result.jobId,
              params.namespace || 'notion-properties',
              'property'
            )
          }

          return {
            count: Object.keys(page.properties).length,
            vectorized: propertiesToVectorize.length
          }
        })

        propertiesProcessed = propertiesResult.count
        vectorsCreated += propertiesResult.vectorized
      }

      // Step 4: ブロックを処理
      if (params.includeBlocks) {
        const blocksResult = await step.do('process-blocks', async () => {
          const blocks = await notionService.fetchBlocksFromNotion(params.pageId)
          await notionService.saveBlocks(params.pageId, blocks)
          
          const vectorManagerId = this.env.VECTOR_CACHE.idFromName('global')
          const vectorManager = this.env.VECTOR_CACHE.get(vectorManagerId)
          
          let vectorizedCount = 0
          
          // テキストを含むブロックをベクトル化
          for (const block of blocks) {
            const plainText = this.extractPlainTextFromBlock(block)
            
            if (plainText && plainText.length > 10) { // 10文字以上のテキストのみ
              const result = await vectorManager.createVectorAsync(
                plainText,
                this.env.DEFAULT_EMBEDDING_MODEL,
                params.namespace || 'notion-blocks',
                {
                  source: 'notion',
                  pageId: params.pageId,
                  blockId: block.id,
                  blockType: block.type,
                  contentType: 'block',
                  pageUrl: page.url
                }
              )

              await notionService.saveVectorRelation(
                params.pageId,
                result.jobId,
                params.namespace || 'notion-blocks',
                'block',
                block.id
              )
              
              vectorizedCount++
            }
          }

          return {
            count: blocks.length,
            vectorized: vectorizedCount
          }
        })

        blocksProcessed = blocksResult.count
        vectorsCreated += blocksResult.vectorized
      }

      // Step 5: 同期ジョブを完了として記録
      await step.do('complete-sync-job', async () => {
        const db = getDb(this.env)
        await db.insert(notionSyncJobs).values({
          pageId: params.pageId,
          jobType: 'sync_page',
          status: 'completed',
          completedAt: new Date().toISOString(),
          metadata: JSON.stringify({
            blocksProcessed,
            propertiesProcessed,
            vectorsCreated
          })
        })
      })

      return {
        success: true,
        pageId: params.pageId,
        blocksProcessed,
        propertiesProcessed,
        vectorsCreated,
        completedAt: new Date().toISOString()
      }
    } catch (error) {
      // エラーを記録
      await step.do('record-error', async () => {
        const db = getDb(this.env)
        await db.insert(notionSyncJobs).values({
          pageId: params.pageId,
          jobType: 'sync_page',
          status: 'failed',
          completedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      })

      return {
        success: false,
        pageId: params.pageId,
        blocksProcessed,
        propertiesProcessed,
        vectorsCreated,
        error: error instanceof Error ? error.message : 'Sync failed',
        completedAt: new Date().toISOString()
      }
    }
  }

  private extractPlainTextFromBlock(block: any): string {
    const content = block[block.type]
    if (!content) return ''

    const richTextTypes = [
      'paragraph', 'heading_1', 'heading_2', 'heading_3',
      'bulleted_list_item', 'numbered_list_item', 'to_do',
      'toggle', 'quote', 'callout'
    ]

    if (richTextTypes.includes(block.type) && content.rich_text) {
      return content.rich_text
        .map((rt: any) => rt.plain_text || '')
        .join('')
    }

    if (block.type === 'code' && content.rich_text) {
      return content.rich_text
        .map((rt: any) => rt.plain_text || '')
        .join('')
    }

    if (block.type === 'table_row' && content.cells) {
      return content.cells
        .map((cell: any[]) => 
          cell.map((rt: any) => rt.plain_text || '').join('')
        )
        .join(' ')
    }

    return ''
  }
}