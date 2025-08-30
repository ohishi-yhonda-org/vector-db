/**
 * チャンク処理ワークフロー
 * FileProcessingWorkflowから分離したチャンク処理機能
 */

import { WorkflowStep } from 'cloudflare:workers'
import { BaseWorkflow } from '../base/workflow'
import { AppError, ErrorCodes } from '../utils/error-handler'

/**
 * チャンク処理パラメータ
 */
export interface ChunkProcessingParams {
  text: string
  fileName: string
  namespace?: string
  metadata?: Record<string, any>
  chunkSize?: number
  chunkOverlap?: number
}

/**
 * チャンク処理結果
 */
export interface ChunkProcessingResult {
  chunks: TextChunk[]
  totalChunks: number
  averageChunkSize: number
}

/**
 * テキストチャンク
 */
export interface TextChunk {
  id: string
  text: string
  index: number
  startOffset: number
  endOffset: number
  metadata?: Record<string, any>
}

/**
 * チャンク処理ワークフロー
 */
export class ChunkProcessor extends BaseWorkflow<ChunkProcessingParams, ChunkProcessingResult> {
  private readonly DEFAULT_CHUNK_SIZE = 1000
  private readonly DEFAULT_CHUNK_OVERLAP = 100
  private readonly MIN_CHUNK_SIZE = 100
  private readonly MAX_CHUNK_SIZE = 5000

  /**
   * ワークフロー実行
   */
  protected async execute(
    params: ChunkProcessingParams,
    step: WorkflowStep
  ): Promise<ChunkProcessingResult> {
    this.logger.info('Starting chunk processing', {
      textLength: params.text.length,
      fileName: params.fileName,
      namespace: params.namespace
    })

    // パラメータの検証
    const chunkSize = this.validateChunkSize(params.chunkSize)
    const chunkOverlap = this.validateChunkOverlap(params.chunkOverlap, chunkSize)

    // テキストをチャンクに分割
    const chunks = await this.executeStep(
      step,
      'split-into-chunks',
      () => this.splitTextIntoChunks(params.text, chunkSize, chunkOverlap, params),
      { critical: true }
    )

    if (!chunks.success || !chunks.data) {
      throw new AppError(
        ErrorCodes.WORKFLOW_ERROR,
        `Chunk processing failed: ${chunks.error}`,
        500
      )
    }

    // チャンクのメタデータを追加
    const enrichedChunks = await this.executeStep(
      step,
      'enrich-chunks',
      () => this.enrichChunks(chunks.data!, params),
      { critical: false }
    )

    const finalChunks = enrichedChunks.success && enrichedChunks.data 
      ? enrichedChunks.data 
      : chunks.data!

    // 統計情報を計算
    const stats = this.calculateStatistics(finalChunks)

    return {
      chunks: finalChunks,
      totalChunks: finalChunks.length,
      averageChunkSize: stats.averageSize
    }
  }

  /**
   * チャンクサイズを検証
   */
  private validateChunkSize(chunkSize?: number): number {
    if (!chunkSize) {
      return this.DEFAULT_CHUNK_SIZE
    }
    
    if (chunkSize < this.MIN_CHUNK_SIZE) {
      this.logger.warn(`Chunk size too small, using minimum: ${this.MIN_CHUNK_SIZE}`)
      return this.MIN_CHUNK_SIZE
    }
    
    if (chunkSize > this.MAX_CHUNK_SIZE) {
      this.logger.warn(`Chunk size too large, using maximum: ${this.MAX_CHUNK_SIZE}`)
      return this.MAX_CHUNK_SIZE
    }
    
    return chunkSize
  }

  /**
   * チャンクオーバーラップを検証
   */
  private validateChunkOverlap(chunkOverlap?: number, chunkSize: number): number {
    if (!chunkOverlap) {
      return this.DEFAULT_CHUNK_OVERLAP
    }
    
    const maxOverlap = Math.floor(chunkSize / 2)
    if (chunkOverlap > maxOverlap) {
      this.logger.warn(`Chunk overlap too large, using: ${maxOverlap}`)
      return maxOverlap
    }
    
    if (chunkOverlap < 0) {
      this.logger.warn('Negative chunk overlap, using 0')
      return 0
    }
    
    return chunkOverlap
  }

  /**
   * テキストをチャンクに分割
   */
  private async splitTextIntoChunks(
    text: string,
    chunkSize: number,
    chunkOverlap: number,
    params: ChunkProcessingParams
  ): Promise<TextChunk[]> {
    const chunks: TextChunk[] = []
    const cleanText = this.cleanText(text)
    
    if (!cleanText || cleanText.length === 0) {
      this.logger.warn('No text to chunk')
      return []
    }

    let startOffset = 0
    let chunkIndex = 0

    while (startOffset < cleanText.length) {
      // チャンクの終了位置を計算
      const endOffset = Math.min(startOffset + chunkSize, cleanText.length)
      
      // 単語の境界で分割を調整
      const adjustedEndOffset = this.findWordBoundary(cleanText, endOffset)
      
      // チャンクを作成
      const chunkText = cleanText.substring(startOffset, adjustedEndOffset)
      
      if (chunkText.trim().length > 0) {
        chunks.push({
          id: this.generateChunkId(params.fileName, chunkIndex),
          text: chunkText,
          index: chunkIndex,
          startOffset,
          endOffset: adjustedEndOffset,
          metadata: {
            fileName: params.fileName,
            namespace: params.namespace,
            ...params.metadata
          }
        })
        chunkIndex++
      }

      // 次のチャンクの開始位置を計算（オーバーラップを考慮）
      startOffset = adjustedEndOffset - chunkOverlap
      
      // 無限ループを防ぐ
      if (startOffset >= cleanText.length - 1) {
        break
      }
    }

    this.logger.info(`Split text into ${chunks.length} chunks`)
    return chunks
  }

  /**
   * テキストをクリーンアップ
   */
  private cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  /**
   * 単語の境界を見つける
   */
  private findWordBoundary(text: string, position: number): number {
    if (position >= text.length) {
      return text.length
    }

    // 日本語の場合は句読点で区切る
    const punctuations = ['。', '！', '？', '\n', '.', '!', '?']
    
    // 近くの句読点を探す
    for (let i = position; i > Math.max(0, position - 50); i--) {
      if (punctuations.includes(text[i])) {
        return i + 1
      }
    }

    // スペースで区切る（英語の場合）
    for (let i = position; i > Math.max(0, position - 20); i--) {
      if (text[i] === ' ') {
        return i + 1
      }
    }

    // 見つからない場合は元の位置を返す
    return position
  }

  /**
   * チャンクIDを生成
   */
  private generateChunkId(fileName: string, index: number): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 7)
    return `chunk_${fileName.replace(/[^a-zA-Z0-9]/g, '_')}_${index}_${timestamp}_${random}`
  }

  /**
   * チャンクを豊富化
   */
  private async enrichChunks(
    chunks: TextChunk[],
    params: ChunkProcessingParams
  ): Promise<TextChunk[]> {
    return chunks.map(chunk => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        processedAt: new Date().toISOString(),
        chunkCount: chunks.length,
        position: `${chunk.index + 1}/${chunks.length}`
      }
    }))
  }

  /**
   * 統計情報を計算
   */
  private calculateStatistics(chunks: TextChunk[]): {
    averageSize: number
    minSize: number
    maxSize: number
  } {
    if (chunks.length === 0) {
      return { averageSize: 0, minSize: 0, maxSize: 0 }
    }

    const sizes = chunks.map(c => c.text.length)
    const total = sizes.reduce((sum, size) => sum + size, 0)
    
    return {
      averageSize: Math.round(total / chunks.length),
      minSize: Math.min(...sizes),
      maxSize: Math.max(...sizes)
    }
  }
}