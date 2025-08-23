import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    // setupFiles: ['./tests/setup.ts', './tests/apply-migrations.ts'],
    setupFiles: ['./tests/setup.ts'],
    silent: false,
    reporters: ['basic'],
    testTimeout: 30000,
    hookTimeout: 10000,
    sequence: {
      concurrent: false,
    },
    poolOptions: {
      workers: {
        main: './src/index.ts',
        singleWorker: true,
        isolatedStorage: false,
        miniflare: {
          compatibilityDate: '2024-12-18',
          compatibilityFlags: ['nodejs_compat'],
          d1Databases: {
            DB: 'test-db'
          },
          bindings: {
            TEST_MIGRATIONS: './migrations',
            DEFAULT_EMBEDDING_MODEL: '@cf/baai/bge-base-en-v1.5',
            BATCH_EMBEDDINGS_WORKFLOW: 'BatchEmbeddingsWorkflow'
          }
        },
      },
    },
    coverage: {
      enabled: true,
      provider: 'istanbul',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts', 'src/**/*.js'],
      exclude: [
        'node_modules/**',
        'coverage/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/tests/**',
        '**/*.test.ts',
        '**/migrations/**',
        'src/index.ts',
      ],
      all: true,
      clean: true,
      skipFull: false,
    },
  },
})