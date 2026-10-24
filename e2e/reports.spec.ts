import { expect, test, type Page, type Route } from '@playwright/test'

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

const me = (permissions: string[]) => ({
  id: 1,
  firstname: 'Jane',
  lastname: 'Doe',
  name: 'Jane Doe',
  email: 'jane@kcb.test',
  role: 'crb-officer',
  branchId: null,
  permissions,
})

async function signIn(page: Page, permissions = ['Download Crb Reports']) {
  await page.route('**/api/v1/me', (r) => json(r, me(permissions)))
  await page.route('**/api/v1/reference/**', (r) => json(r, []))
}

const paged = (data: unknown[]) => ({
  data,
  current_page: 1,
  last_page: 1,
  per_page: 20,
  total: data.length,
  from: data.length ? 1 : null,
  to: data.length ? data.length : null,
})

test('/reports forwards to the CRB form', async ({ page }) => {
  await signIn(page)
  await page.goto('/reports')
  await expect(page).toHaveURL(/\/reports\/crb$/)
  await expect(page.getByText('Credit Bureau Reports')).toBeVisible()
})

test('the CRB pages need the permission', async ({ page }) => {
  await signIn(page, [])
  await page.goto('/reports/crb')
  await expect(page.getByText('Credit Bureau Reports')).toHaveCount(0)
})

test('a bounced cheque report is requested with the dates of the form and downloaded', async ({ page }) => {
  await signIn(page)
  let body: Record<string, unknown> = {}
  await page.route('**/api/v1/reports/BC', (r) => {
    body = r.request().postDataJSON()
    return r.fulfill({
      status: 200,
      contentType: 'text/csv',
      headers: { 'content-disposition': 'attachment; filename="CB01120260930BC.csv"' },
      body: '"H"|"CB011"\n',
    })
  })
  await page.goto('/reports/crb')
  await expect(page.locator('#file_name')).toHaveValue('BC')
  await page.locator('select[name="from_day"]').selectOption('1')
  await page.locator('select[name="from_month"]').selectOption('9')
  await page.locator('select[name="from_year"]').selectOption('2026')
  await page.locator('select[name="to_day"]').selectOption('30')
  await page.locator('select[name="to_month"]').selectOption('9')
  await page.locator('select[name="to_year"]').selectOption('2026')
  const download = page.waitForEvent('download')
  await page.getByTestId('download').click()
  expect((await download).suggestedFilename()).toBe('CB01120260930BC.csv')
  expect(body).toEqual({ fromDate: '2026-09-01', toDate: '2026-09-30', version: '8.0' })
})

test('a failed report shows the server message', async ({ page }) => {
  await signIn(page)
  await page.route('**/api/v1/reports/CAP', (r) =>
    json(
      r,
      { title: 'Unprocessable', status: 422, errors: { toDate: ['The to date is not a valid date.'] } },
      422,
    ),
  )
  await page.goto('/reports/crb')
  await page.locator('#file_name').selectOption('CAP')
  await page.getByTestId('download').click()
  await expect(page.getByText('The to date is not a valid date.')).toBeVisible()
})

test('the CBA type is queued through the CBA endpoint and the user goes to the background processes', async ({
  page,
}) => {
  // the Background Processes page has its own gate, so the user needs it to follow the process
  await signIn(page, ['Download Crb Reports', 'View Analysis', 'Manage Background Processes'])
  let body: Record<string, unknown> = {}
  await page.route('**/api/v1/cba/generate', (r) => {
    body = r.request().postDataJSON()
    return json(r, { process_id: 5 }, 202)
  })
  await page.route('**/api/v1/reports/CBA', (r) => json(r, {}, 500))
  await page.goto('/reports/crb')
  await page.locator('#file_name').selectOption('CBA')
  await expect(page.getByTestId('from-block')).toBeHidden()
  await page.locator('input[name="use_cached_cba"]').check()
  await page.getByTestId('download').click()
  await expect(
    page.getByText('CBA report generation has been queued and is running in the background.'),
  ).toBeVisible()
  expect(body).toMatchObject({ version: '8.0', useCached: true })
  expect(String(body.toDate)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  await page.getByRole('button', { name: 'View Progress →' }).click()
  await expect(page).toHaveURL(/\/background-processes$/)
})

test('a running CBA process is reported with a link to its progress', async ({ page }) => {
  await signIn(page)
  await page.route('**/api/v1/cba/generate', (r) =>
    json(
      r,
      { title: 'Conflict', status: 409, detail: 'A CBA generation or cleanup is already running.' },
      409,
    ),
  )
  await page.goto('/reports/crb')
  await page.locator('#file_name').selectOption('CBA')
  await page.getByTestId('download').click()
  await expect(page.getByText('A CBA generation or cleanup is already running.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'View Progress →' })).toBeVisible()
})

const outputRow = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  rule_name: `CBA_${id}`,
  records_count: 1200,
  report_type: 'CBA',
  submission_date: '20260930',
  version: '8.0',
  time_remaining: '12 days',
  expired: false,
  download_name: `CBA_${id}.xlsx`,
  created_at: '2026-10-20 10:00:00',
  ...extra,
})

test('output files are listed, the feedback filter refreshes the list and expired files cannot be downloaded', async ({
  page,
}) => {
  await signIn(page)
  let rows = [outputRow(1), outputRow(2, { expired: true, time_remaining: 'expired' })]
  await page.route('**/api/v1/output-files', (r) => json(r, { data: rows }))
  let posted = ''
  await page.route('**/api/v1/output-files/extract', (r) => {
    posted = r.request().postData() ?? ''
    rows = [outputRow(3, { rule_name: 'CBA_399' }), ...rows]
    return r.fulfill({
      status: 200,
      contentType: 'application/vnd.ms-excel',
      headers: { 'content-disposition': 'attachment; filename="CBA_399.xlsx"' },
      body: 'xlsx',
    })
  })
  await page.goto('/output-files')
  await expect(page.getByText('( 12 days left )')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download CBA_1' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download CBA_2' })).toHaveCount(0)
  await expect(page.getByTestId('expired')).toHaveText('CBA_2')

  await page.locator('select[name="report_type"]').selectOption('cba')
  await page.locator('#output_file').setInputFiles({
    name: 'feedback.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('"D"|"CB011"|"CBA_399"\n'),
  })
  await page.locator('#rule_name').fill('CBA_399')
  const download = page.waitForEvent('download')
  await page.getByTestId('extract').click()
  expect((await download).suggestedFilename()).toBe('CBA_399.xlsx')
  expect(posted).toContain('name="rule_name"')
  expect(posted).toContain('CBA_399')
  expect(posted).toContain('filename="feedback.csv"')
  await expect(page.getByTestId('output-row')).toHaveCount(3)
})

test('the rule name is checked before the upload', async ({ page }) => {
  await signIn(page)
  await page.route('**/api/v1/output-files', (r) => json(r, { data: [] }))
  await page.goto('/output-files')
  await expect(page.locator('table')).toHaveCount(0)
  await page.locator('select[name="report_type"]').selectOption('cba')
  await page
    .locator('#output_file')
    .setInputFiles({ name: 'f.csv', mimeType: 'text/csv', buffer: Buffer.from('x') })
  await page.locator('#rule_name').fill('bad rule!')
  await page.getByTestId('extract').click()
  await expect(page.getByText(/letters, digits, dashes and underscores/)).toBeVisible()
})

test('loans without CMC, CCG or BS are listed with a link to the loan', async ({ page }) => {
  await signIn(page)
  await page.route('**/api/v1/reports/loans-without-cmc-ccg-bs*', (r) =>
    json(
      r,
      paged([
        {
          id: 1,
          contractCode: 'AA001',
          clientNumber: '100',
          creditAmount: '5000000',
          currency: 'UGX',
          contractDate: '20250905',
          maturityDate: '20270905',
          lackFactor: 'without_ccg',
          loan_id: 42,
          name: 'Okello James',
        },
      ]),
    ),
  )
  await page.goto('/reports/loans-without-cmc-bs-ccg')
  await expect(page.getByText('AA001')).toBeVisible()
  await expect(page.getByText('without_ccg')).toBeVisible()
  await expect(page.getByText('5, Sep 2025')).toBeVisible()
  await expect(page.getByText('UGX 5,000,000')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open AA001' })).toHaveAttribute('href', '/loans/show/42')
})

test('the submission analysis shows its sections and offers the PDF', async ({ page }) => {
  await signIn(page)
  await page.route('**/api/v1/reports/submission-analysis', (r) =>
    json(r, {
      generated_on: '2026-10-24',
      stakeholders: {
        count: 1,
        as_of: '24-Oct-2026',
        rows: [{ name: 'Jane Founder', category: 'Director', category_code: '1', percentage: '60' }],
      },
      bounced_cheques: {
        count: 0,
        min_date: '',
        max_date: '',
        by_currency: [],
        by_branch: [],
        by_reason: [],
      },
      credit_applications: {
        count: 3,
        min_date: '01-Sep-2026',
        max_date: '30-Sep-2026',
        by_currency: [{ currency: 'UGX', count: 3, amount: 9000000 }],
        by_branch: [{ code: '001', name: 'Kampala Main', count: 3 }],
        by_product: [{ code: '10', label: 'Overdraft', count: 3 }],
        by_status: [{ code: '0', label: 'Pending', count: 3 }],
      },
      credit_accounts: {
        count: 0,
        min_date: '',
        max_date: '',
        by_currency: [],
        by_branch: [],
        by_product: [],
        by_status: [],
        by_risk: [],
        largest: [],
        worst: [],
      },
    }),
  )
  await page.route('**/api/v1/reports/submission-analysis/pdf', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/pdf',
      headers: { 'content-disposition': 'attachment; filename="submission_analysis.pdf"' },
      body: '%PDF-1.4',
    }),
  )
  await page.goto('/reports/submission-analysis/view')
  await expect(page.getByText('Credit Applications (3)')).toBeVisible()
  await expect(page.getByText('Jane Founder')).toBeVisible()
  await expect(page.getByText('9,000,000')).toBeVisible()
  await expect(page.getByText('code: 001')).toBeVisible()
  await expect(page.getByText('Bounced Cheques (')).toHaveCount(0)
  await expect(page.getByText('Credit Borrower Accounts (')).toHaveCount(0)
  const download = page.waitForEvent('download')
  await page.getByTestId('pdf').click()
  expect((await download).suggestedFilename()).toBe('submission_analysis.pdf')
})
