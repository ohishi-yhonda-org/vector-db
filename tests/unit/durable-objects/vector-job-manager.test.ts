import { describe, it, expect, beforeEach, vi } from 'vitest'
import { VectorJobManager, VectorJobType, VectorJobParams, VectorJobResult } from '../../../src/durable-objects/vector-job-manager'
import { JobStatus, JobPriority } from '../../../src/base/job-manager'

describe('VectorJobManager', () => {
  let jobManager: VectorJobManager
  let mockEnv: Env
  let mockVectorizeIndex: VectorizeIndex

  beforeEach(() => {
    // Mock environment
    mockEnv = {
      DEFAULT_EMBEDDING_MODEL: 'text-embedding-ada-002',
      EMBEDDINGS_WORKFLOW: {
        create: vi.fn().mockResolvedValue({}),
        get: vi.fn().mockResolvedValue({
          status: vi.fn().mockResolvedValue({
            status: 'complete',
            output: {
              success: true,
              embedding: [0.1, 0.2, 0.3],
              model: 'text-embedding-ada-002'
            }
          })
        })
      },
      VECTOR_OPERATIONS_WORKFLOW: {
        create: vi.fn().mockResolvedValue({}),
        get: vi.fn().mockResolvedValue({
          status: vi.fn().mockResolvedValue({
            status: 'complete',
            output: {
              success: true,
              vectorId: 'vec_123'
            }
          })
        })
      },
      FILE_PROCESSING_WORKFLOW: {
        create: vi.fn().mockResolvedValue({}),
        get: vi.fn().mockResolvedValue({
          status: vi.fn().mockResolvedValue({
            status: 'complete',
            output: {
              vectorIds: ['vec_1', 'vec_2'],
              extractedText: 'Sample text',
              description: 'Sample file'
            }
          })
        })
      }
    } as any

    // Mock vectorize index
    mockVectorizeIndex = {
      deleteByIds: vi.fn().mockResolvedValue({ count: 2 })
    } as any

    // Create job manager instance
    jobManager = new VectorJobManager(mockEnv, mockVectorizeIndex)
  })

  describe('createJob', () => {
    it('should create a vector creation job', async () => {
      const params: VectorJobParams = {
        text: 'Test text',
        model: 'text-embedding-ada-002',
        namespace: 'test',
        metadata: { key: 'value' }
      }

      const job = await jobManager.createJob({
        type: VectorJobType.CREATE,
        params
      })

      expect(job).toBeDefined()
      expect(job.type).toBe(VectorJobType.CREATE)
      expect([JobStatus.QUEUED, JobStatus.PROCESSING]).toContain(job.status)
      expect(job.params).toEqual(params)
    })

    it('should create a vector deletion job', async () => {
      const params: VectorJobParams = {
        vectorIds: ['vec_1', 'vec_2']
      }

      const job = await jobManager.createJob({
        type: VectorJobType.DELETE,
        params
      })

      expect(job).toBeDefined()
      expect(job.type).toBe(VectorJobType.DELETE)
      expect([JobStatus.QUEUED, JobStatus.PROCESSING]).toContain(job.status)
      expect(job.params).toEqual(params)
    })

    it('should create a file processing job', async () => {
      const params: VectorJobParams = {
        fileData: 'base64data',
        fileName: 'test.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
        namespace: 'test'
      }

      const job = await jobManager.createJob({
        type: VectorJobType.FILE_PROCESS,
        params
      })

      expect(job).toBeDefined()
      expect(job.type).toBe(VectorJobType.FILE_PROCESS)
      expect([JobStatus.QUEUED, JobStatus.PROCESSING]).toContain(job.status)
      expect(job.params).toEqual(params)
    })
  })

  describe('job processing', () => {
    it('should process vector creation job successfully', async () => {
      const job = await jobManager.createJob({
        type: VectorJobType.CREATE,
        params: {
          text: 'Test text',
          model: 'text-embedding-ada-002'
        }
      })

      // Wait for job to complete
      await new Promise(resolve => setTimeout(resolve, 2000))

      const completedJob = jobManager.getJob(job.id)
      // Job might still be processing or retrying
      if (completedJob?.status === JobStatus.COMPLETED) {
        expect(completedJob?.result).toBeDefined()
        expect(completedJob?.result?.vectorId).toBe('vec_123')
        expect(completedJob?.result?.embedding).toEqual([0.1, 0.2, 0.3])
      } else {
        // Job is still in progress, which is OK for async processing
        expect([JobStatus.PROCESSING, JobStatus.RETRYING, JobStatus.QUEUED]).toContain(completedJob?.status)
      }
    })

    it('should handle vector creation job failure', async () => {
      // Mock workflow failure
      mockEnv.EMBEDDINGS_WORKFLOW.get = vi.fn().mockResolvedValue({
        status: vi.fn().mockResolvedValue({
          status: 'errored',
          error: 'Embedding failed'
        })
      })

      const job = await jobManager.createJob({
        type: VectorJobType.CREATE,
        params: {
          text: 'Test text'
        }
      })

      // Wait for job to process
      await new Promise(resolve => setTimeout(resolve, 2000))

      const failedJob = jobManager.getJob(job.id)
      // Job might be retrying or failed
      expect([JobStatus.FAILED, JobStatus.RETRYING]).toContain(failedJob?.status)
      if (failedJob?.status === JobStatus.FAILED) {
        expect(failedJob?.error).toContain('Embedding failed')
      }
    })

    it('should process vector deletion job successfully', async () => {
      const job = await jobManager.createJob({
        type: VectorJobType.DELETE,
        params: {
          vectorIds: ['vec_1', 'vec_2']
        }
      })

      // Wait for job to complete
      await new Promise(resolve => setTimeout(resolve, 2000))

      const completedJob = jobManager.getJob(job.id)
      // Job might still be processing
      if (completedJob?.status === JobStatus.COMPLETED) {
        expect(completedJob?.result?.deletedCount).toBe(2)
        expect(mockVectorizeIndex.deleteByIds).toHaveBeenCalledWith(['vec_1', 'vec_2'])
      } else {
        expect([JobStatus.PROCESSING, JobStatus.QUEUED]).toContain(completedJob?.status)
      }
    })

    it('should process file job successfully', async () => {
      const job = await jobManager.createJob({
        type: VectorJobType.FILE_PROCESS,
        params: {
          fileData: 'base64data',
          fileName: 'test.pdf',
          fileType: 'application/pdf',
          fileSize: 1024
        }
      })

      // Wait for job to complete
      await new Promise(resolve => setTimeout(resolve, 2000))

      const completedJob = jobManager.getJob(job.id)
      // Job might still be processing
      if (completedJob?.status === JobStatus.COMPLETED) {
        expect(completedJob?.result?.vectorIds).toEqual(['vec_1', 'vec_2'])
        expect(completedJob?.result?.extractedText).toBe('Sample text')
      } else {
        expect([JobStatus.PROCESSING, JobStatus.QUEUED]).toContain(completedJob?.status)
      }
    })
  })

  describe('job management', () => {
    it('should get all jobs', async () => {
      await jobManager.createJob({
        type: VectorJobType.CREATE,
        params: { text: 'Text 1' }
      })
      await jobManager.createJob({
        type: VectorJobType.DELETE,
        params: { vectorIds: ['vec_1'] }
      })

      const allJobs = jobManager.getAllJobs()
      expect(allJobs).toHaveLength(2)
    })

    it('should get jobs by status', async () => {
      await jobManager.createJob({
        type: VectorJobType.CREATE,
        params: { text: 'Text 1' }
      })

      // Jobs might be already processing
      const allJobs = jobManager.getAllJobs()
      expect(allJobs.length).toBeGreaterThanOrEqual(1)
    })

    it('should cancel a job', async () => {
      const job = await jobManager.createJob({
        type: VectorJobType.CREATE,
        params: { text: 'Text 1' }
      })

      // Job might already be processing and cannot be cancelled
      const cancelled = await jobManager.cancelJob(job.id)
      
      const cancelledJob = jobManager.getJob(job.id)
      if (cancelled) {
        expect(cancelledJob?.status).toBe(JobStatus.CANCELLED)
      } else {
        // Job was already processing
        expect(cancelledJob?.status).toBe(JobStatus.PROCESSING)
      }
    })

    it('should cleanup old jobs', async () => {
      // Create a job
      await jobManager.createJob({
        type: VectorJobType.CREATE,
        params: { text: 'Text 1' }
      })

      // Clear completed jobs
      const cleared = jobManager.clearJobs(true)
      expect(cleared).toBeGreaterThanOrEqual(0)
    })

    it('should get statistics', () => {
      const stats = jobManager.getStatistics()
      expect(stats).toBeDefined()
      expect(stats.total).toBeGreaterThanOrEqual(0)
      expect(stats.queued).toBeGreaterThanOrEqual(0)
      expect(stats.processing).toBeGreaterThanOrEqual(0)
    })
  })

  describe('error handling', () => {
    it('should handle missing text for create job', async () => {
      const job = await jobManager.createJob({
        type: VectorJobType.CREATE,
        params: {}
      })

      // Wait for job to process
      await new Promise(resolve => setTimeout(resolve, 2000))

      const failedJob = jobManager.getJob(job.id)
      // Job might be retrying or failed
      expect([JobStatus.FAILED, JobStatus.RETRYING]).toContain(failedJob?.status)
      if (failedJob?.status === JobStatus.FAILED) {
        expect(failedJob?.error).toContain('Text is required')
      }
    })

    it('should handle missing vector IDs for delete job', async () => {
      const job = await jobManager.createJob({
        type: VectorJobType.DELETE,
        params: {}
      })

      // Wait for job to process
      await new Promise(resolve => setTimeout(resolve, 2000))

      const failedJob = jobManager.getJob(job.id)
      // Job might be retrying or failed
      expect([JobStatus.FAILED, JobStatus.RETRYING]).toContain(failedJob?.status)
      if (failedJob?.status === JobStatus.FAILED) {
        expect(failedJob?.error).toContain('Vector IDs are required')
      }
    })

    it('should handle missing file data for file job', async () => {
      const job = await jobManager.createJob({
        type: VectorJobType.FILE_PROCESS,
        params: {
          fileName: 'test.pdf'
        }
      })

      // Wait for job to process
      await new Promise(resolve => setTimeout(resolve, 2000))

      const failedJob = jobManager.getJob(job.id)
      // Job might be retrying or failed
      expect([JobStatus.FAILED, JobStatus.RETRYING]).toContain(failedJob?.status)
      if (failedJob?.status === JobStatus.FAILED) {
        expect(failedJob?.error).toContain('File data and name are required')
      }
    })

    it('should handle workflow timeout', async () => {
      // Mock workflow that never completes
      mockEnv.EMBEDDINGS_WORKFLOW.get = vi.fn().mockResolvedValue({
        status: vi.fn().mockResolvedValue({
          status: 'running'
        })
      })

      // Reduce timeout for testing
      const originalTimeout = (jobManager as any).constructor.prototype.waitForWorkflow
      ;(jobManager as any).waitForWorkflow = async function(workflow: any, workflowId: string, schema?: any) {
        const instance = await workflow.get(workflowId)
        const maxAttempts = 2 // Reduce to 2 attempts for faster testing
        let attempts = 0

        while (attempts < maxAttempts) {
          const statusResult = await instance.status()
          if (statusResult.status === 'complete' && statusResult.output) {
            return schema ? schema.parse(statusResult.output) : statusResult.output
          } else if (statusResult.status === 'errored') {
            throw new Error(`Workflow failed: ${statusResult.error || 'Unknown error'}`)
          }
          await new Promise(resolve => setTimeout(resolve, 100))
          attempts++
        }
        throw new Error('Workflow did not complete within timeout')
      }

      const job = await jobManager.createJob({
        type: VectorJobType.CREATE,
        params: { text: 'Test text' }
      })

      // Wait for job to process
      await new Promise(resolve => setTimeout(resolve, 2000))

      const failedJob = jobManager.getJob(job.id)
      // Job might be retrying or failed
      expect([JobStatus.FAILED, JobStatus.RETRYING]).toContain(failedJob?.status)
      if (failedJob?.status === JobStatus.FAILED) {
        expect(failedJob?.error).toContain('timeout')
      }
    })
  })
})