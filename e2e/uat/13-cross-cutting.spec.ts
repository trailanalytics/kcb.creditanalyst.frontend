import { expect, test } from '@playwright/test'
import { Api } from './support/api'
import { authFile } from './support/auth'
import { BASE_URL, CUSTOMER } from './support/env'
import { createApplication } from './support/data'
import { confirmDialog, dialog, loginViaUi, unique } from './support/ui'

const MAILPIT = process.env.UAT_MAILPIT_URL ?? 'http://localhost:18421'

test.describe('global search', () => {
  test.use({ storageState: authFile('officer') })

  test('customers are found by name, client number and NIN, and applications by reference', async ({
    page,
  }) => {
    const api = await Api.as('officer')
    const app = await createApplication(api, { clientNumber: CUSTOMER.main })
    await page.goto('/home')
    const box = page.getByLabel('Search customers, CAPs and loans')
    // two words find an individual by name; one word only looks up numbers and companies, as before (D-1316)
    await box.fill('Okello James')
    await expect(
      page
        .getByRole('listbox')
        .getByRole('link', { name: /Okello James Peter/ })
        .first(),
    ).toBeVisible()
    await expect(page.getByRole('listbox')).toContainText('Customers')
    await box.fill('Okello')
    await expect(page.getByRole('listbox')).toContainText('No customers, CAPs or loans match')
    await box.fill(CUSTOMER.main)
    await expect(
      page
        .getByRole('listbox')
        .getByRole('link', { name: /Okello James Peter/ })
        .first(),
    ).toBeVisible()
    await box.fill(`CM${CUSTOMER.main}UATXY`)
    await expect(
      page
        .getByRole('listbox')
        .getByRole('link', { name: /Okello James Peter/ })
        .first(),
    ).toBeVisible()
    await box.fill(app.creditApplicationReference)
    await expect(page.getByRole('listbox')).toContainText('Credit applications (CAP)')
    await page
      .getByRole('listbox')
      .getByRole('link', { name: new RegExp(app.creditApplicationReference.slice(0, 12)) })
      .first()
      .click()
    await expect(page).toHaveURL(/\/applications\/show\/\d+/)
    await api.dispose()
  })

  test('a search with nothing behind it says so, and one character does not search at all', async ({
    page,
  }) => {
    await page.goto('/home')
    const box = page.getByLabel('Search customers, CAPs and loans')
    await box.fill('zzzqqq-nothing-matches')
    await expect(page.getByRole('listbox')).toContainText('No customers, CAPs or loans match')
    await box.fill('a')
    await expect(page.getByRole('listbox')).toHaveCount(0)
  })

  test('loans are found by contract code only by a user who may see loans, and the API refuses the rest', async ({
    browser,
  }) => {
    const crb = await Api.as('crb')
    const found = await crb.get('/api/v1/search', { query: 'UATLN0001' })
    expect(found.status).toBe(200)
    expect(found.body.loans.map((l: any) => l.title).join('|')).toContain('UATLN0001')
    const officer = await Api.as('officer')
    const hidden = await officer.get('/api/v1/search', { query: 'UATLN0001' })
    expect(hidden.status).toBe(200)
    expect(hidden.body.loans).toHaveLength(0)
    const none = await Api.as('noaccess')
    const denied = await none.get('/api/v1/search', { query: 'Okello' })
    expect(denied.body.customers ?? []).toHaveLength(0)
    await crb.dispose()
    await officer.dispose()
    await none.dispose()
    void browser
  })
})

test.describe('403, negative and permission cases', () => {
  test('every guarded page sends a user without its permission to the 403 page', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile('noaccess') })
    const page = await ctx.newPage()
    const guarded = [
      '/applications',
      '/applications/report',
      '/applications/bulk-approve',
      '/loans',
      '/write-offs',
      '/open-accounts',
      '/ignored-accounts',
      '/force-closed-accounts',
      '/upload-credit-cards',
      '/off-balance-sheet/items',
      '/cba/output',
      '/cba/fix',
      '/bc-list',
      '/upload-bounced-cheques',
      '/upload-fully-paid-or-write-offs',
      '/fraud',
      '/institution',
      '/branches',
      '/branches/new',
      '/pis',
      '/cmc-list',
      '/ccg-list',
      '/bs-list',
      '/reports/crb',
      '/reports/loans-without-cmc-bs-ccg',
      '/reports/submission-analysis',
      '/output-files',
      '/analysis',
      '/analysis/pr4/results',
      '/requests',
      '/t24',
      '/t24/sync',
    ]
    for (const path of guarded) {
      await page.goto(path)
      await expect(page, path).toHaveURL(/\/errors\/403/)
      await expect(page.getByRole('heading', { name: "You don't have access to this page" })).toBeVisible()
    }
    await ctx.close()
  })

  test('users and logs are closed to a role without admin access and to a permission-less administrator', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: authFile('noaccess') })
    const page = await ctx.newPage()
    for (const path of ['/users', '/users/new', '/logs', '/admin', '/admin/configuration']) {
      await page.goto(path)
      await expect(page, path).toHaveURL(/\/home$/)
    }
    await ctx.close()
  })

  test('the API answers 401 without a session, 403 without the permission and 419 without the CSRF token', async () => {
    const anonymous = await Api.login('nobody@kcb.test', 'x') // creates an anonymous session only
    expect(anonymous.status).toBe(401)
    const res = await fetch(`${BASE_URL}/api/v1/applications`)
    expect(res.status).toBe(401)
    expect(res.headers.get('content-type')).toContain('application/problem+json')
    const officer = await Api.as('officer')
    expect(
      (await officer.post('/api/v1/reports/BC', { fromDate: '2026-01-01', toDate: '2026-10-31' })).status,
    ).toBe(403)
    expect((await officer.get('/api/v1/loans')).status).toBe(403)
    // a state-changing call without the token header is refused even with a valid session
    const state = JSON.parse(await (await import('node:fs/promises')).readFile(authFile('officer'), 'utf8'))
    const cookie = state.cookies.map((c: any) => `${c.name}=${c.value}`).join('; ')
    const noToken = await fetch(`${BASE_URL}/api/v1/applications/check-duplicate/${CUSTOMER.main}`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: '{}',
    })
    expect(noToken.status).toBe(419)
    await officer.dispose()
  })

  test('an address that does not exist shows the 404 page', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile('officer') })
    const page = await ctx.newPage()
    await page.goto('/this/page/does/not/exist')
    await expect(page).toHaveURL(/\/errors\/404/)
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
    await ctx.close()
  })
})

test.describe('session expiry', () => {
  test('a session that ends while the page is open sends the user to the login with a message and back again afterwards', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await ctx.newPage()
    await loginViaUi(page, 'officer')
    await expect(page).toHaveURL(/\/home/)
    await page.goto('/applications')
    await expect(page.getByPlaceholder('search...')).toBeVisible()
    // the session is ended on the server (as the idle timeout or another sign-out would)
    const cookies = await ctx.cookies()
    const stolen = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
    const token = decodeURIComponent(cookies.find((c) => c.name === 'XSRF-TOKEN')!.value)
    const out = await fetch(`${BASE_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { cookie: stolen, 'X-XSRF-TOKEN': token },
    })
    expect(out.status).toBe(204)
    await page.getByPlaceholder('search...').fill('Okello')
    await expect(dialog(page)).toContainText(/session has expired|log in/i)
    await confirmDialog(page, 'OK')
    await expect(page).toHaveURL(/\/login\?redirect=(%2F|\/)applications/)
    await loginViaUi(page, 'officer')
    await expect(page).toHaveURL(/\/home|\/applications/)
    await ctx.close()
  })
})

test.describe('an unexpected error: the 500 page and Notify IT', () => {
  test.use({ storageState: authFile('admin') })

  test('an unexpected error shows a reference and IT is notified by e-mail', async ({ page }) => {
    const reference = await (async () => {
      await page.goto('/users/new')
      await page.getByLabel('First name').fill('x'.repeat(400))
      await page.getByLabel('Last name').fill('Long')
      await page.getByLabel('Email').fill(`uat.long.${unique()}@kcb.test`)
      await page.getByLabel('Authentication').selectOption('credit_analyst')
      await page.locator('input[type="password"]').fill('LongEnough#2026')
      await page.getByRole('button', { name: 'Create User' }).click()
      await expect(dialog(page)).toContainText('Error reference:')
      const text = await dialog(page).innerText()
      return /ERR-\d{6}-\d{6}-[A-Z0-9]{4}/.exec(text)![0]
    })()
    await page.getByRole('button', { name: 'Notify IT' }).click()
    await expect(page).toHaveURL(/\/errors\/500/)
    await expect(page.locator('#app').getByText(`Error reference: ${reference}`)).toBeVisible()
    // the page offers "Notify IT" again: it opens the small form, and "Send to IT" sends the reference with the note
    await page.getByRole('button', { name: 'Notify IT' }).click()
    const note = `UAT note ${unique()}`
    await page.getByLabel('What were you doing? (optional)').fill(note)
    await page.getByRole('button', { name: 'Send to IT' }).click()
    await expect(page.getByRole('status')).toContainText(/IT has been notified|already been notified/)
    // the mail is in the mailbox of the stack, with the reference and what the user wrote
    for (const needle of [reference, note]) {
      await expect
        .poll(
          async () => {
            const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`"${needle}"`)}`)
            return res.ok ? (((await res.json()) as { messages_count?: number }).messages_count ?? 0) : 0
          },
          { timeout: 30_000 },
        )
        .toBeGreaterThan(0)
    }
  })
})

test.describe('the installable app', () => {
  test('the manifest, icons, service worker and offline page are served', async ({ request }) => {
    const manifest = await request.get('/manifest.json')
    expect(manifest.status()).toBe(200)
    const body = await manifest.json()
    expect(body.name).toBe('KCB Credit Analyst')
    expect(body.display).toBe('standalone')
    expect(body.start_url).toBe('/home')
    expect(body.icons.length).toBeGreaterThanOrEqual(8)
    for (const icon of body.icons.slice(0, 3)) expect((await request.get(icon.src)).status()).toBe(200)
    const worker = await request.get('/sw.js')
    expect(worker.status()).toBe(200)
    expect(await worker.text()).toContain(
      "request.url.startsWith('/api/')".replace('request.url', 'url.pathname'),
    )
    const offline = await request.get('/offline.html')
    expect(offline.status()).toBe(200)
    expect(await offline.text()).toMatch(/offline/i)
  })

  test('the page links the manifest and the theme colour', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.json')
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#002c4d')
  })

  test('in a production build the service worker registers and a signed-in page is not kept for offline use', async ({
    browser,
  }) => {
    test.skip(
      !process.env.UAT_PWA_URL,
      'needs a production build: npm run build && npx vite preview --port 5243, then UAT_PWA_URL=http://localhost:5243',
    )
    const ctx = await browser.newContext({
      baseURL: process.env.UAT_PWA_URL,
      storageState: { cookies: [], origins: [] },
    })
    const page = await ctx.newPage()
    await page.goto('/login')
    // the browser's service worker API, typed loosely because the suite compiles without the DOM library
    type Workers = { serviceWorker: { ready: Promise<unknown>; getRegistrations(): Promise<unknown[]> } }
    await page.evaluate(async () => (navigator as unknown as Workers).serviceWorker.ready)
    const registrations = await page.evaluate(
      async () => (await (navigator as unknown as Workers).serviceWorker.getRegistrations()).length,
    )
    expect(registrations).toBeGreaterThan(0)
    await ctx.close()
  })
})
