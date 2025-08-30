/**
 * 共通バリデーションユーティリティ
 */

import { z, ZodError, ZodSchema } from 'zod'
import { Context } from 'hono'
import { AppError, ErrorCodes } from './error-handler'

/**
 * バリデーションエラーの詳細
 */
export interface ValidationErrorDetail {
  field: string
  message: string
  code?: string
  received?: any
}

/**
 * Zodエラーを読みやすい形式に変換
 */
export function formatZodError(error: ZodError): ValidationErrorDetail[] {
  return error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
    received: err.received
  }))
}

/**
 * バリデーションエラーをAppErrorに変換
 */
export function createValidationError(
  error: ZodError | ValidationErrorDetail[],
  message: string = 'Validation failed'
): AppError {
  const details = error instanceof ZodError 
    ? formatZodError(error)
    : error

  return new AppError(
    ErrorCodes.VALIDATION_ERROR,
    message,
    400,
    { errors: details }
  )
}

/**
 * スキーマでバリデーション実行
 */
export function validate<T>(
  schema: ZodSchema<T>,
  data: unknown,
  options?: { 
    errorMessage?: string
    throwOnError?: boolean 
  }
): { success: true; data: T } | { success: false; error: AppError } {
  const result = schema.safeParse(data)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  const error = createValidationError(result.error, options?.errorMessage)
  
  if (options?.throwOnError) {
    throw error
  }
  
  return { success: false, error }
}

/**
 * リクエストボディをバリデーション
 */
export async function validateBody<T>(
  c: Context,
  schema: ZodSchema<T>
): Promise<T> {
  try {
    const body = await c.req.json()
    const result = validate(schema, body, { throwOnError: true })
    
    if (result.success) {
      return result.data
    }
    
    // TypeScriptの型推論のため（実際には到達しない）
    throw result.error
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new AppError(
        ErrorCodes.BAD_REQUEST,
        'Invalid JSON in request body',
        400
      )
    }
    throw error
  }
}

/**
 * クエリパラメータをバリデーション
 */
export function validateQuery<T>(
  c: Context,
  schema: ZodSchema<T>
): T {
  const query = c.req.query()
  const result = validate(schema, query, { throwOnError: true })
  
  if (result.success) {
    return result.data
  }
  
  // TypeScriptの型推論のため（実際には到達しない）
  throw result.error
}

/**
 * パスパラメータをバリデーション
 */
export function validateParams<T>(
  c: Context,
  schema: ZodSchema<T>
): T {
  const params = c.req.param()
  const result = validate(schema, params, { throwOnError: true })
  
  if (result.success) {
    return result.data
  }
  
  // TypeScriptの型推論のため（実際には到達しない）
  throw result.error
}

/**
 * 共通バリデーションスキーマ
 */
export const CommonSchemas = {
  // UUID v4
  uuid: z.string().uuid(),
  
  // ID (英数字とハイフン、アンダースコア)
  id: z.string().regex(/^[a-zA-Z0-9_-]+$/, 'Invalid ID format'),
  
  // Email
  email: z.string().email(),
  
  // URL
  url: z.string().url(),
  
  // 日付文字列 (ISO 8601)
  dateString: z.string().datetime(),
  
  // ページネーション
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
  }),
  
  // ソート
  sort: z.object({
    sortBy: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('desc')
  }),
  
  // 日付範囲
  dateRange: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional()
  }).refine(
    data => {
      if (data.from && data.to) {
        return new Date(data.from) <= new Date(data.to)
      }
      return true
    },
    { message: 'From date must be before or equal to To date' }
  ),
  
  // 配列（空でない）
  nonEmptyArray: <T extends z.ZodTypeAny>(schema: T) => 
    z.array(schema).min(1, 'Array must contain at least one item'),
  
  // 文字列（空でない）
  nonEmptyString: z.string().min(1, 'String cannot be empty').trim(),
  
  // 数値範囲
  numberInRange: (min: number, max: number) =>
    z.number().min(min).max(max)
}

/**
 * カスタムバリデータ
 */
export const CustomValidators = {
  /**
   * ベクトルIDのバリデーション
   */
  vectorId: z.string().regex(
    /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/,
    'Vector ID must start with alphanumeric and contain only alphanumeric, hyphen, or underscore'
  ),
  
  /**
   * ベクトル値のバリデーション（次元数チェック付き）
   */
  vectorValues: (dimensions?: number) => {
    const baseSchema = z.array(z.number().finite())
    
    if (dimensions) {
      return baseSchema.length(dimensions, `Vector must have exactly ${dimensions} dimensions`)
    }
    
    return baseSchema.min(1, 'Vector must have at least one dimension')
  },
  
  /**
   * メタデータのバリデーション
   */
  metadata: z.record(z.unknown()).refine(
    (data) => {
      // メタデータのサイズ制限（例: 10KB）
      const jsonStr = JSON.stringify(data)
      return jsonStr.length <= 10240
    },
    { message: 'Metadata size exceeds 10KB limit' }
  ),
  
  /**
   * ファイルタイプのバリデーション
   */
  fileType: (allowedTypes: string[]) =>
    z.string().refine(
      (type) => allowedTypes.includes(type.toLowerCase()),
      { message: `File type must be one of: ${allowedTypes.join(', ')}` }
    ),
  
  /**
   * ファイルサイズのバリデーション（バイト単位）
   */
  fileSize: (maxSize: number) =>
    z.number().positive().max(maxSize, `File size must not exceed ${maxSize} bytes`),
  
  /**
   * Notion Page IDのバリデーション
   */
  notionPageId: z.string().regex(
    /^[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}$/i,
    'Invalid Notion page ID format'
  ),
  
  /**
   * 環境変数の存在チェック
   */
  requiredEnvVar: (varName: string) =>
    z.string().min(1, `Environment variable ${varName} is required`)
}

/**
 * 複数のスキーマを組み合わせる
 */
export function combineSchemas<T extends Record<string, ZodSchema>>(
  schemas: T
): z.ZodObject<{ [K in keyof T]: T[K] extends ZodSchema<infer U> ? z.ZodType<U> : never }> {
  const combined: any = {}
  for (const [key, schema] of Object.entries(schemas)) {
    combined[key] = schema
  }
  return z.object(combined)
}

/**
 * オプショナルなフィールドを持つスキーマを作成
 */
export function createOptionalSchema<T extends z.ZodRawShape>(
  shape: T,
  requiredFields: (keyof T)[]
): z.ZodObject<T> {
  const newShape: any = {}
  
  for (const [key, value] of Object.entries(shape)) {
    if (requiredFields.includes(key as keyof T)) {
      newShape[key] = value
    } else {
      newShape[key] = (value as any).optional()
    }
  }
  
  return z.object(newShape as T)
}

/**
 * 条件付きバリデーション
 */
export function conditionalValidation<T, U>(
  condition: (data: any) => boolean,
  trueSchema: ZodSchema<T>,
  falseSchema: ZodSchema<U>
): ZodSchema<T | U> {
  return z.any().transform((data, ctx) => {
    if (condition(data)) {
      const result = trueSchema.safeParse(data)
      if (!result.success) {
        result.error.errors.forEach(err => ctx.addIssue(err))
        return z.NEVER
      }
      return result.data
    } else {
      const result = falseSchema.safeParse(data)
      if (!result.success) {
        result.error.errors.forEach(err => ctx.addIssue(err))
        return z.NEVER
      }
      return result.data
    }
  }) as ZodSchema<T | U>
}