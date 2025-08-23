import { createRoute, RouteHandler } from '@hono/zod-openapi'
import { z } from '@hono/zod-openapi'
import {
  VectorListResponseSchema,
  type VectorListResponse
} from '../../../schemas/vector.schema'
import { ErrorResponseSchema, type ErrorResponse } from '../../../schemas/error.schema'

// 環境の型定義
type EnvType = {
  Bindings: Env
}

// ベクトル一覧取得ルート定義
export const listVectorsRoute = createRoute({
  method: 'get',
  path: '/vectors',
  request: {
    query: z.object({
      namespace: z.string().optional(),
      limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default(10),
      cursor: z.string().optional()
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: VectorListResponseSchema
        }
      },
      description: 'ベクトル一覧'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      },
      description: 'サーバーエラー'
    }
  },
  tags: ['Vectors'],
  summary: 'ベクトル一覧の取得',
  description: 'ベクトルの一覧を取得します'
})

// ベクトル一覧取得ハンドラー
export const listVectorsHandler: RouteHandler<typeof listVectorsRoute, EnvType> = async (c) => {
  try {
    // 注: Vectorizeは直接的な一覧取得APIを提供していないため、
    // 実装では別の方法（例：メタデータストレージ）が必要
    return c.json<VectorListResponse, 200>({
      success: true,
      data: [],
      count: 0,
      message: 'ベクトル一覧取得機能は実装中です'
    }, 200)
  } catch (error) {
    console.error('List vectors error:', error)
    return c.json<ErrorResponse, 500>({
      success: false,
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'ベクトル一覧の取得中にエラーが発生しました'
    }, 500)
  }
}