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

// View Analysis is what the Background Processes placeholder asks for until that page lands
async function signIn(page: Page, permissions = ['Update CBA Details', 'View Analysis']) {
  await page.route('**/api/v1/me', (r) => json(r, me(permissions)))
  await page.route('**/api/v1/reference/**', (r) => json(r, []))
}

// a short column list is enough here: the page works from whatever /cba/columns says (the 130 are checked by the backend tests)
const columns = [
  { key: 'Borrowers_Client_Number', label: 'Borrowers Client Number', readonly: true, numeric: false },
  { key: 'Credit_Account_Reference', label: 'Credit Account Reference', readonly: true, numeric: false },
  { key: 'Credit_Amount', label: 'Credit Amount', readonly: false, numeric: true },
  { key: 'Currency', label: 'Currency', readonly: false, numeric: false },
  {
    key: 'Credit_Account_Closure_Date',
    label: 'Credit Account Closure Date',
    readonly: false,
    numeric: false,
  },
  { key: 'Credit_Account_Status', label: 'Credit Account Status', readonly: false, numeric: false },
]

const allRows = [
  { id: 1, values: ['C1', 'REF-1', '1000', 'UGX', null, '4'] },
  { id: 2, values: ['C2', 'REF-2', '2000', 'USD', '20260930', '1'] },
  { id: 3, values: ['C3', 'REF-3', '3000', 'UGX', null, '3'] },
]

const rule = (name: string, desc: string, count: number, fixable: boolean) => ({
  name,
  desc,
  count,
  percentage: Math.round((count / 3) * 10000) / 100,
  fixable,
})

const validations = {
  total_accounts: 3,
  validations: {
    CBA_023: rule('CBA_023', 'NO CURRENT BALANCE AMOUNT SUPPLIED', 0, false),
    CBA_106: rule('CBA_106', 'THE CREDIT ACCOUNT CLOSURE DATE FIELD IS NULL', 2, true),
    CBA_429: rule('CBA_429', 'CREDIT ACCOUNT DATE IS GREATER THAN MATURITY DATE', 1, false),
  },
}

const pageOf = (data: typeof allRows, current = 1, last = 1) => ({
  data,
  current_page: current,
  last_page: last,
  per_page: 10,
  total: data.length,
  from: data.length ? 1 : null,
  to: data.length || null,
})

interface Calls {
  lists: URLSearchParams[]
  saves: unknown[]
  fixes: string[]
  removed: string[]
  downloads: unknown[]
}

async function mockCba(page: Page): Promise<Calls> {
  const calls: Calls = { lists: [], saves: [], fixes: [], removed: [], downloads: [] }
  await signIn(page)
  await page.route('**/api/v1/cba/columns', (r) => json(r, columns))
  await page.route('**/api/v1/cba/validations', (r) => json(r, validations))
  await page.route('**/api/v1/cba/accounts**', async (r) => {
    const request = r.request()
    const url = new URL(request.url())
    if (request.method() === 'PUT') {
      calls.saves.push(request.postDataJSON())
      return json(r, { updated: 1, unchanged: 0, unmatched: [], message: 'Changes saved successfully' })
    }
    if (request.method() === 'DELETE') {
      calls.removed.push(decodeURIComponent(url.pathname.split('/').pop() ?? ''))
      return json(r, { cba_rows: 1, loan_accounts: 1, message: 'Account removed from CBA successfully' })
    }
    calls.lists.push(url.searchParams)
    const wanted = url.searchParams.get('rule')
    const search = url.searchParams.get('search')
    let data = allRows
    if (wanted === 'CBA_106') data = allRows.filter((x) => x.values[4] === null)
    if (search) data = data.filter((x) => search.split(',').some((t) => x.values.includes(t.trim())))
    return json(r, pageOf(data))
  })
  await page.route('**/api/v1/cba/validations/*/fix', (r) => {
    calls.fixes.push(r.request().url().split('/').slice(-2)[0] ?? '')
    return json(r, { rule: 'CBA_106', updated: 2, message: 'CBA Error Rule (CBA_106) fixed successfully' })
  })
  await page.route('**/api/v1/cba/download', (r) => {
    calls.downloads.push(r.request().postDataJSON())
    return json(r, { process_id: 41 }, 202)
  })
  await page.route('**/api/v1/background-processes**', (r) => json(r, { data: [] }))
  return calls
}

const cell = (page: Page, row: number, key: string) => page.locator(`[data-cell="${row}:${key}"]`)

test('the grid lists the accounts and the validation rules', async ({ page }) => {
  await mockCba(page)
  await page.goto('/cba/output')
  await expect(cell(page, 0, 'Credit_Account_Reference')).toHaveValue('REF-1')
  await expect(cell(page, 1, 'Currency')).toHaveValue('USD')
  await expect(cell(page, 0, 'Credit_Account_Closure_Date')).toHaveValue('')
  await expect(cell(page, 0, 'Credit_Account_Reference')).toHaveAttribute('readonly', '')
  await expect(page.getByTestId('page-status')).toContainText('Page 1 of 1 · 3 accounts')

  const panel = page.getByTestId('validations')
  await expect(panel.getByText('CBA_106')).toBeVisible()
  await expect(panel.locator('[data-rule="CBA_106"]')).toContainText('66.67% (2)')
  await expect(panel.locator('[data-rule="CBA_023"]').getByLabel('no records')).toBeVisible()
  await expect(panel.locator('[data-rule="CBA_429"]').getByLabel('Fix CBA_429')).toHaveCount(0)
  await expect(panel.locator('[data-rule="CBA_106"]').getByLabel('Fix CBA_106')).toBeVisible()
})

test('an edited cell is marked green and the save sends that cell by name, even with another column hidden', async ({
  page,
}) => {
  const calls = await mockCba(page)
  await page.goto('/cba/output')
  await expect(cell(page, 0, 'Currency')).toBeVisible()

  // hide the currency column: the cells after it must not move
  await page.locator('[data-column-toggle="Currency"]').uncheck()
  await expect(page.locator('th[data-column="Currency"]')).toHaveCount(0)

  await cell(page, 1, 'Credit_Account_Closure_Date').fill('20260831')
  await expect(cell(page, 1, 'Credit_Account_Closure_Date').locator('..')).toHaveClass(/border-b-\[#14A44D\]/)
  await expect(page.getByTestId('save')).toContainText('(1)')

  await page.getByTestId('save').click()
  await expect(page.getByText('Changes saved successfully.')).toBeVisible()
  expect(calls.saves).toEqual([
    {
      accounts: [
        {
          Credit_Account_Reference: 'REF-2',
          Borrowers_Client_Number: 'C2',
          Credit_Account_Closure_Date: '20260831',
        },
      ],
    },
  ])
  await expect(cell(page, 1, 'Credit_Account_Closure_Date').locator('..')).not.toHaveClass(
    /border-b-\[#14A44D\]/,
  )
  await expect(page.getByTestId('save')).not.toContainText('(1)')
})

test('text in a number column is flagged and blocks the save', async ({ page }) => {
  const calls = await mockCba(page)
  await page.goto('/cba/output')
  await cell(page, 0, 'Credit_Amount').fill('lots')
  await expect(page.getByText('Invalid input. Please enter digits only.')).toBeVisible()
  await page.getByTestId('save').click()
  await expect(page.getByText('Some edited cells need a number.')).toBeVisible()
  expect(calls.saves).toHaveLength(0)
  await cell(page, 0, 'Credit_Amount').fill('1500.50')
  await page.getByTestId('save').click()
  await expect(page.getByText('Changes saved successfully.')).toBeVisible()
  expect(calls.saves).toHaveLength(1)
})

test('Load Account searches by reference or client number and says when nothing matches', async ({
  page,
}) => {
  const calls = await mockCba(page)
  await page.goto('/cba/output')
  await page.getByRole('button', { name: 'Load Account', exact: true }).click()
  await expect(
    page.getByText('Please enter an account reference or client number of the loan.'),
  ).toBeVisible()
  await page.getByPlaceholder('Enter Account Reference or Client Number').fill('C3')
  await page.getByRole('button', { name: 'Load Account', exact: true }).click()
  await expect(cell(page, 0, 'Credit_Account_Reference')).toHaveValue('REF-3')
  await expect(page.locator('#table-container tbody tr')).toHaveCount(1)
  expect(calls.lists.at(-1)?.get('search')).toBe('C3')
  await page.getByPlaceholder('Enter Account Reference or Client Number').fill('nobody')
  await page.getByRole('button', { name: 'Load Account', exact: true }).click()
  await expect(page.getByText('No data found for the account number.')).toBeVisible()
})

test('the eye of a rule lists its records and tints the cells the rule looks at; Fix applies it after a confirmation', async ({
  page,
}) => {
  const calls = await mockCba(page)
  await page.goto('/cba/output')
  await page.getByLabel('Show CBA_106 records').click()
  await expect(page.locator('#table-container tbody tr')).toHaveCount(2)
  expect(calls.lists.at(-1)?.get('rule')).toBe('CBA_106')
  await expect(page.getByTestId('rule-note')).toContainText('CBA_106')
  await expect(cell(page, 0, 'Credit_Account_Closure_Date').locator('..')).toHaveClass(/bg-red-100/)
  await expect(cell(page, 0, 'Credit_Account_Status').locator('..')).toHaveClass(/bg-amber-50/)

  await page.getByLabel('Fix CBA_106').click()
  await expect(page.getByText('Fix CBA_106?')).toBeVisible()
  await page.getByRole('button', { name: 'Fix', exact: true }).click()
  await expect(page.getByText('CBA Error Rule (CBA_106) fixed successfully')).toBeVisible()
  expect(calls.fixes).toEqual(['CBA_106'])
  // the grid and the counts are read again
  await expect.poll(() => calls.lists.length).toBeGreaterThan(2)

  await page.getByLabel('Show all records again').click()
  await expect(page.locator('#table-container tbody tr')).toHaveCount(3)
})

test('Remove From CBA is on the first column, also for the first row, and says the loan is closed too', async ({
  page,
}) => {
  const calls = await mockCba(page)
  await page.goto('/cba/output')
  await cell(page, 0, 'Borrowers_Client_Number').click({ button: 'right' })
  await expect(page.getByRole('menuitem')).toHaveText(['Hide Row', 'Remove From CBA', 'Cancel'])
  await page.getByRole('menuitem', { name: 'Remove From CBA' }).click()
  await expect(page.getByText('You are about to remove account reference:')).toBeVisible()
  await expect(page.getByText('closed as fully paid and deleted as well')).toBeVisible()
  await page.getByRole('button', { name: 'Yes, remove it!' }).click()
  await expect(page.getByText('Account removed from CBA successfully.')).toBeVisible()
  expect(calls.removed).toEqual(['REF-1'])
  await expect(page.locator('#table-container tbody tr')).toHaveCount(2)
})

test('Clear Content blanks a cell and Restore Content brings it back', async ({ page }) => {
  await mockCba(page)
  await page.goto('/cba/output')
  await cell(page, 1, 'Currency').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Clear Content' }).click()
  await expect(cell(page, 1, 'Currency')).toHaveValue('')
  await cell(page, 1, 'Currency').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Restore Content' }).click()
  await expect(cell(page, 1, 'Currency')).toHaveValue('USD')
})

test('Download Short CBA saves pending edits, asks for the date and version, calls the CBA slice and follows the process', async ({
  page,
}) => {
  const calls = await mockCba(page)
  await page.goto('/cba/output')
  await cell(page, 0, 'Currency').fill('EUR')
  await page.getByTestId('download-short').click()
  await expect(page.getByText('Writes the CBA file from the table as it is now')).toBeVisible()
  await page.locator('#cba-version').selectOption('7.0')
  await page.getByTestId('download-confirm').click()
  await expect(page).toHaveURL(/\/background-processes$/)
  // the edit was saved before the file was asked for
  expect(calls.saves).toHaveLength(1)
  expect(calls.downloads).toHaveLength(1)
  expect(calls.downloads[0]).toMatchObject({ version: '7.0' })
  expect((calls.downloads[0] as { toDate: string }).toDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
})

test('without Update CBA Details the pages are not available', async ({ page }) => {
  await signIn(page, ['View Analysis'])
  await page.goto('/cba/output')
  await expect(page).toHaveURL(/\/errors\/403/)
  await page.goto('/cba/fix')
  await expect(page).toHaveURL(/\/errors\/403/)
})

// ---- /cba/fix ----

const codes = { name: 'codes.csv', mimeType: 'text/csv', buffer: Buffer.from('contractCode\nAA1\n') }
const fixes = {
  name: 'fix.csv',
  mimeType: 'text/csv',
  buffer: Buffer.from('clientNumber,dob,nin,gender\nC1,19900115,CM1,0\n'),
}

test('delete reported records: the file is uploaded and the dialog leads to the background processes', async ({
  page,
}) => {
  await signIn(page)
  await page.route('**/api/v1/background-processes**', (r) => json(r, { data: [] }))
  let posted = ''
  await page.route('**/api/v1/cba/fix/delete-records', (r) => {
    posted = r.request().postData() ?? ''
    return json(
      r,
      {
        message: 'Delete job queued. Track progress in Background Processes.',
        process_id: 12,
        bg_url: 'http://localhost/background-processes',
      },
      202,
    )
  })
  await page.goto('/cba/fix')
  await expect(page.getByText('Upload Contract Codes to Delete')).toBeVisible()
  await expect(
    page.getByTestId('delete-file').locator('xpath=ancestor::form').getByTestId('submit'),
  ).toBeDisabled()
  await expect(page.getByRole('link', { name: 'Download template' }).first()).toHaveAttribute(
    'href',
    '/api/v1/cba/fix/template/delete-records',
  )
  await page.getByTestId('delete-file').setInputFiles(codes)
  await page.getByTestId('delete-file').locator('xpath=ancestor::form').getByTestId('submit').click()
  await expect(page.getByText('Delete job queued. Track progress in Background Processes.')).toBeVisible()
  expect(posted).toContain('filename="codes.csv"')
  await page.getByRole('button', { name: 'View Background Process' }).click()
  await expect(page).toHaveURL(/\/background-processes$/)
})

test('fix customer details: its tab, its template, its endpoint and the refusal of a bad file', async ({
  page,
}) => {
  await signIn(page)
  let calls = 0
  await page.route('**/api/v1/cba/fix/fix-customer-details', (r) => {
    calls += 1
    return json(
      r,
      {
        type: 'about:blank',
        title: 'Unprocessable Content',
        status: 422,
        detail: 'The given data was invalid.',
        errors: { file: ['The file must be a file of type: csv, txt, xlsx, xls.'] },
      },
      422,
    )
  })
  await page.goto('/cba/fix')
  await page.getByRole('tab', { name: /Fix Customer Details/ }).click()
  await expect(page.getByText('Upload Customer Details to Fix')).toBeVisible()
  await expect(page.getByText('0 For Male or 1 For Female')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Download template' }).first()).toHaveAttribute(
    'href',
    '/api/v1/cba/fix/template/fix-customer',
  )
  const form = page.getByTestId('customer-file').locator('xpath=ancestor::form')
  await page.getByTestId('customer-file').setInputFiles(fixes)
  await form.getByTestId('submit').click()
  await expect(page.getByText('The file must be a file of type: csv, txt, xlsx, xls.')).toBeVisible()
  expect(calls).toBe(1)
  await page.getByRole('button', { name: 'OK' }).click()
  // the file stays chosen, so the user can try again
  await expect(form.getByText('fix.csv')).toBeVisible()
  await expect(form.getByTestId('submit')).toBeEnabled()
})

test('the fix page links to the background processes', async ({ page }) => {
  await signIn(page)
  await page.route('**/api/v1/background-processes**', (r) => json(r, { data: [] }))
  await page.goto('/cba/fix')
  await page.getByRole('link', { name: 'Background Processes' }).click()
  await expect(page).toHaveURL(/\/background-processes$/)
})
