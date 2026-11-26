import { test, type Page } from '@playwright/test'

/**
 * Step screenshots for the UAT evidence pack. Off unless UAT_EVIDENCE=1, so a normal run costs nothing.
 *
 * Each shot is attached to the running test (the JSON report lists it with the test, which is how the run log
 * (backend scripts/uat/run_log.py) finds the screenshots of a case) and numbered in the order taken.
 */
export const EVIDENCE = process.env.UAT_EVIDENCE === '1'

const counters = new WeakMap<object, number>()

export async function shot(page: Page, label: string) {
  if (!EVIDENCE || page.isClosed()) return
  let info
  try {
    info = test.info()
  } catch {
    return // called outside a test (global setup)
  }
  const n = (counters.get(info) ?? 0) + 1
  counters.set(info, n)
  const name = `${String(n).padStart(2, '0')}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)}`
  try {
    const body = await page.screenshot({ fullPage: false, animations: 'disabled', timeout: 10_000 })
    await info.attach(name, { body, contentType: 'image/png' })
  } catch {
    // evidence must never fail a case
  }
}
