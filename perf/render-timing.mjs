// First useful render, measured in a real browser against a real backend (SRS section 27: <= 3 s on the bank LAN).
//
//   npm run build && VITE_API_PROXY=http://localhost:18430 npx vite preview --port 18431 &
//   BASE_URL=http://localhost:18431 PERF_EMAIL=perf.user1@kcb.test PERF_PASSWORD='...' node perf/render-timing.mjs [runs]
//
// "Useful" means the content the page exists for is on screen: the dashboard after sign in, the first row of a list, the heading of a record.
// The clock starts at navigation (page.goto) and stops when that element is visible. Each page is measured RUNS times in a fresh browser
// context (cold: empty HTTP cache, JS chunks fetched) and RUNS times in a signed-in context (warm). Prints a markdown table.
import { chromium } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://localhost:18431'
const EMAIL = process.env.PERF_EMAIL || 'perf.user1@kcb.test'
const PASSWORD = process.env.PERF_PASSWORD || ''
const RUNS = parseInt(process.argv[2] || '5')
const LOAN_ID = process.env.PERF_LOAN_ID || '200000'
const CUSTOMER_ID = process.env.PERF_CUSTOMER_ID || '150000'
const APP_ID = process.env.PERF_APP_ID || '75000'

const pages = [
  { name: 'dashboard', path: '/home', ready: 'main a, main button' },
  { name: 'profiles list', path: '/profiles', ready: 'tbody tr' },
  { name: 'profile details', path: `/borrowers/${CUSTOMER_ID}`, ready: 'main h1, main h2' },
  { name: 'applications list', path: '/applications', ready: 'a[href^="/borrowers/"]' },
  { name: 'application details', path: `/applications/show/${APP_ID}`, ready: 'main h1, main h2' },
  { name: 'loans list', path: '/loans', ready: 'a[href^="/borrowers/"]' },
  { name: 'loan details', path: `/loans/show/${LOAN_ID}`, ready: 'main h1, main h2' },
  { name: 'collaterals list (CMC)', path: '/cmc-list', ready: 'tbody tr' },
  { name: 'processes', path: '/background-processes', ready: 'tbody tr, main p' },
]

async function signIn(page) {
  await page.goto(BASE + '/login')
  await page.locator('input[type=text]').first().fill(EMAIL)
  await page.locator('input[type=password]').first().fill(PASSWORD)
  await page.locator('button[type=submit]').click()
  await page.waitForURL('**/home', { timeout: 60000 })
}

async function time(page, p) {
  const t0 = Date.now()
  await page.goto(BASE + p.path, { waitUntil: 'commit' })
  try {
    await page.locator(p.ready).first().waitFor({ state: 'visible', timeout: 30000 })
  } catch {
    return 30000 // not visible within 30 s: counted as 30 s and reported as a fail
  }
  return Date.now() - t0
}

const pct = (a, q) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.ceil(q * a.length) - 1)]
const only = process.env.PERF_PAGES ? process.env.PERF_PAGES.split(',') : null
if (only) pages.splice(0, pages.length, ...pages.filter((p) => only.includes(p.name)))
const browser = await chromium.launch()
const rows = []
for (const p of pages) {
  const cold = []
  for (let i = 0; i < RUNS; i++) {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await signIn(page)
    cold.push(await time(page, p))
    await ctx.close()
  }
  rows.push({ p, cold })
}
const ctx = await browser.newContext()
const page = await ctx.newPage()
const t0 = Date.now()
await signIn(page)
const loginToDashboard = Date.now() - t0
for (const r of rows) {
  await time(page, r.p)
  r.warm = []
  for (let i = 0; i < RUNS; i++) r.warm.push(await time(page, r.p))
}
await browser.close()

console.log(`Sign in to dashboard (first load, cold cache): ${loginToDashboard} ms\n`)
console.log('| page | cold p50 ms | cold max ms | warm p50 ms | warm max ms | <= 3 s |')
console.log('|---|---:|---:|---:|---:|---|')
for (const r of rows) {
  const ok = Math.max(...r.cold) <= 3000 && Math.max(...r.warm) <= 3000
  console.log(`| ${r.p.name} | ${pct(r.cold, 0.5)} | ${Math.max(...r.cold)} | ${pct(r.warm, 0.5)} | ${Math.max(...r.warm)} | ${ok ? 'pass' : '**FAIL**'} |`)
}
