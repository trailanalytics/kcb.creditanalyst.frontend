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

async function signIn(page: Page, permissions = ['View Analysis']) {
  await page.route('**/api/v1/me', (r) => json(r, me(permissions)))
  await page.route('**/api/v1/reference/**', (r) => json(r, []))
}

const results = {
  id: 3,
  batch_id: 8,
  reporting_month: '2026-09-30',
  pr4_records_count: '1250',
  cba_records_count: '98765',
  matching_records_count: '1200',
  matching_records_percentage: '96',
  balance_records_count: '1250',
  balance_records_percentage: '100',
  matching_balance_count: '1100',
  matching_balance_percentage: '91.67',
  installment_records_count: '1250',
  installment_records_percentage: '100',
  matching_installment_count: '1000',
  matching_installment_percentage: '83.33',
  arrears_records_count: '1250',
  arrears_records_percentage: '100',
  matching_arrears_count: '1190',
  matching_arrears_percentage: '99.17',
  pr4_float_loans_records_count: '50',
  pr4_float_loans_records_percentage: '4',
}

const pr4File = { name: 'pr4.csv', mimeType: 'text/csv', buffer: Buffer.from('TRANS_ID,CUST_ID\nAA1,1001\n') }

test('the old upload address forwards to the analysis page', async ({ page }) => {
  await signIn(page)
  await page.route('**/api/v1/analysis/pr4/results', (r) => json(r, { results: null }))
  await page.goto('/upload-pr4')
  await expect(page).toHaveURL(/\/analysis$/)
  await expect(page.getByText('Analysis Instructions')).toBeVisible()
})

test('a PR4 file is uploaded for analysis and the user is taken to the background processes', async ({
  page,
}) => {
  await signIn(page)
  await page.route('**/api/v1/analysis/pr4/results', (r) => json(r, { results: results }))
  let posted = ''
  await page.route('**/api/v1/analysis/pr4', (r) => {
    posted = r.request().postData() ?? ''
    return json(r, {
      message: 'PR4 file queued for background processing.',
      process_id: 9,
      bg_url: 'http://localhost/background-processes',
    })
  })
  await page.goto('/analysis')
  await expect(page.getByRole('link', { name: /View Previous Analysis/ })).toBeVisible()

  await page.getByLabel('Exchange Rate (USD → UGX)').fill('3765')
  await page.getByLabel('Action').selectOption('analyse_pr4')
  await expect(
    page.getByText('The PR4 file will be uploaded and analyzed against the CBA report.'),
  ).toBeVisible()
  await page.locator('input[type=file]').setInputFiles(pr4File)
  await page.getByTestId('submit').click()

  await expect(page.getByText('PR4 file queued for background processing.')).toBeVisible()
  expect(posted).toContain('name="exchange_rate"')
  expect(posted).toContain('3765')
  expect(posted).toMatch(/name="analyze"\s+true/)
  expect(posted).toContain('filename="pr4.csv"')
  await page.getByRole('button', { name: 'View Background Process' }).click()
  await expect(page).toHaveURL(/\/background-processes$/)
})

test('the form asks for what is missing before anything is sent', async ({ page }) => {
  await signIn(page)
  await page.route('**/api/v1/analysis/pr4/results', (r) => json(r, { results: null }))
  let sent = 0
  await page.route('**/api/v1/analysis/pr4', (r) => {
    sent += 1
    return json(r, {})
  })
  await page.goto('/analysis')
  await page.getByTestId('submit').click()
  await expect(page.getByText('Please enter a valid exchange rate greater than 0!')).toBeVisible()
  await page.getByRole('button', { name: 'OK' }).click()
  await page.getByLabel('Exchange Rate (USD → UGX)').fill('3765')
  await page.getByTestId('submit').click()
  await expect(page.getByText('Please make sure the PR4 file is attached!')).toBeVisible()
  expect(sent).toBe(0)
})

for (const [status, body, text] of [
  [
    409,
    { detail: 'A PR4 upload for this reporting month is already pending or processing.' },
    'A PR4 upload for this reporting month is already pending or processing.',
  ],
  [
    422,
    {
      detail: 'The given data was invalid.',
      errors: {
        file: ['The file field must be a file of type: xlsx, xls, csv, txt.'],
        exchange_rate: ['The exchange rate field must be greater than 0.'],
      },
    },
    'The file field must be a file of type: xlsx, xls, csv, txt. (and 1 more error)',
  ],
  [
    500,
    { detail: 'Something went wrong while uploading the file! Please contact IT for support.' },
    'Something went wrong while uploading the file! Please contact IT for support.',
  ],
] as const) {
  test(`a ${status} from the server is shown as the page's own error`, async ({ page }) => {
    await signIn(page)
    await page.route('**/api/v1/analysis/pr4/results', (r) => json(r, { results: null }))
    await page.route('**/api/v1/analysis/pr4', (r) => json(r, body, status))
    await page.goto('/analysis')
    await page.getByLabel('Exchange Rate (USD → UGX)').fill('3765')
    await page.locator('input[type=file]').setInputFiles(pr4File)
    await page.getByTestId('submit').click()
    await expect(page.getByText(text)).toBeVisible()
    await page.getByRole('button', { name: 'OK' }).click()
    await expect(page.getByTestId('submit')).toBeEnabled()
    await expect(page).toHaveURL(/\/analysis$/)
  })
}

test('the results page shows the analysis, and says so when there is none', async ({ page }) => {
  await signIn(page)
  await page.route('**/api/v1/analysis/pr4/results', (r) => json(r, { results }))
  await page.goto('/analysis/pr4/results')
  await expect(page.getByText('Pr4 Report File Analyzed against the CBA successfully!')).toBeVisible()
  await expect(
    page.getByText('1,250 records found in the Pr4 File compared against 98,765 records in the CBA.'),
  ).toBeVisible()
  await expect(page.getByTestId('line-float')).toContainText('50 (4%) are KCB AIRTEL AGENT FLOAT LOAN')

  await page.unroute('**/api/v1/analysis/pr4/results')
  await page.route('**/api/v1/analysis/pr4/results', (r) => json(r, { results: null }))
  await page.reload()
  await expect(page.getByText('No analysis has been run yet.')).toBeVisible()
})

test('both pages need the View Analysis permission', async ({ page }) => {
  await signIn(page, [])
  await page.goto('/analysis')
  await expect(page.getByText('Analysis Instructions')).toHaveCount(0)
})
