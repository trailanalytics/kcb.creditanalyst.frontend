import { defineConfig } from '@playwright/test'

/**
 * Executable UAT: the specs in e2e/uat run against the REAL stack (compose app + mysql + mailpit) with no API mocks.
 * UAT_BASE_URL is the Vite dev server (or nginx) that proxies /api to the compose app. See docs/uat/README.md in the
 * backend repo for how to start everything and run scripts/uat/seed.sh first.
 *
 * One worker, files in order: the cases share one database and some of them start background processes (only one CBA
 * run may be active at a time).
 */
const RUN = process.env.UAT_RUN_ID ?? 'local'
const EVIDENCE = process.env.UAT_EVIDENCE === '1'

export default defineConfig({
  testDir: './e2e/uat',
  testMatch: '**/*.spec.ts',
  globalSetup: './e2e/uat/global-setup.ts',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 45_000 },
  // Each run keeps its own report and evidence (UAT_RUN_ID), so the synthetic, real-data, warehouse and Kubernetes runs do not
  // overwrite each other. UAT_EVIDENCE=1 keeps a screenshot and a trace of every case, pass or fail, for the evidence pack.
  reporter: [
    ['list'],
    ['json', { outputFile: `test-results/uat-runs/${RUN}/uat-report.json` }],
    ['html', { outputFolder: `test-results/uat-runs/${RUN}/html`, open: 'never' }],
  ],
  outputDir: `test-results/uat-runs/${RUN}/artifacts`,
  use: {
    baseURL: process.env.UAT_BASE_URL ?? 'http://localhost:5242',
    acceptDownloads: true,
    trace: EVIDENCE ? 'on' : 'retain-on-failure',
    screenshot: EVIDENCE ? 'on' : 'only-on-failure',
    actionTimeout: 45_000,
  },
})
