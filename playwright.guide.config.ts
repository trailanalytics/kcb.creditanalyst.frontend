import { defineConfig } from '@playwright/test'

/**
 * Screenshots for the stakeholder guides (e2e/guide). Runs against a freshly seeded UAT stack, like the UAT suite, and uses
 * the same signed-in users (the UAT global setup). Pictures go to guide-out/<role>/, and tools/guide/build-docx.mjs turns them
 * into the Word guides. Run it before the UAT suite, so the lists show only the fixture records.
 *
 *   UAT_BASE_URL=http://localhost:5173 npx playwright test -c playwright.guide.config.ts [e2e/guide/officer.guide.ts]
 */
export default defineConfig({
  testDir: './e2e/guide',
  testMatch: '**/*.guide.ts',
  globalSetup: './e2e/uat/global-setup.ts',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 300_000,
  expect: { timeout: 30_000 },
  reporter: [['list']],
  outputDir: 'test-results/guide',
  use: {
    baseURL: process.env.UAT_BASE_URL ?? 'http://localhost:5173',
    viewport: { width: 1280, height: 760 },
    deviceScaleFactor: 1.5,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    timezoneId: 'Africa/Kampala',
    locale: 'en-GB',
    acceptDownloads: true,
    actionTimeout: 30_000,
    screenshot: 'only-on-failure',
  },
})
