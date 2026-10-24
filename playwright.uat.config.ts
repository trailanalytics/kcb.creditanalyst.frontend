import { defineConfig } from '@playwright/test'

/**
 * Executable UAT: the specs in e2e/uat run against the REAL stack (compose app + mysql + mailpit) with no API mocks.
 * UAT_BASE_URL is the Vite dev server (or nginx) that proxies /api to the compose app. See docs/uat/README.md in the
 * backend repo for how to start everything and run scripts/uat/seed.sh first.
 *
 * One worker, files in order: the cases share one database and some of them start background processes (only one CBA
 * run may be active at a time).
 */
export default defineConfig({
  testDir: './e2e/uat',
  testMatch: '**/*.spec.ts',
  globalSetup: './e2e/uat/global-setup.ts',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 45_000 },
  reporter: [['list'], ['json', { outputFile: 'test-results/uat-report.json' }]],
  outputDir: 'test-results/uat',
  use: {
    baseURL: process.env.UAT_BASE_URL ?? 'http://localhost:5242',
    acceptDownloads: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 45_000,
  },
})
