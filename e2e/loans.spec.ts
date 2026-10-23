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

async function signIn(page: Page, permissions: string[]) {
  await page.route('**/api/v1/me', (r) => json(r, me(permissions)))
  await page.route('**/api/v1/reference/**', (r) => json(r, []))
}

const paged = (data: unknown[]) => ({
  data,
  current_page: 1,
  last_page: 1,
  per_page: 50,
  total: data.length,
  from: data.length ? 1 : null,
  to: data.length ? data.length : null,
})

const customer = {
  id: 7,
  clientNumber: '1000001',
  II_FCSNumber: 'FCS-1',
  full_name: 'Okello James  ',
  customer_type: 'Individual',
  classificationCode: '0',
  currentAccount: null,
  branchCode: '001',
  individual_details: { id: 1, GSCAFB_Surname: 'Okello', II_CountryID: 'CM88000000ABCD' },
  non_individual_details: null,
}

const loanRow = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  contractCode: `AA00${id}`,
  clientNumber: '1000001',
  contractDate: '20250115',
  maturityDate: '20270115',
  currency: 'UGX',
  creditAmount: '1234567',
  currentBalanceAmount: '750000',
  creditAccountStatus: '5',
  loan_type: 'Term Loan',
  customer,
  ...extra,
})

const header = {
  amount: 'UGX 1,234,567',
  contractCode: 'AA003',
  contractDate: '15 Jan 2025',
  maturityDate: '15 Jan 2027',
  currentBalance: 'UGX 750,000',
  status: 'Current',
  loanType: 'Term Loan',
  purpose: 'Working capital',
  balanceOverdue: 'UGX 0',
  dueDays: '0',
}

const view = (extra: Record<string, unknown> = {}) => ({
  loan: { ...loanRow(3), contractCode: 'AA003' },
  customer,
  header,
  ...extra,
})

test('a loan is found on the list, ignored from its menu, opened and written off', async ({ page }) => {
  await signIn(page, ['View CBA Loans', 'CBA Loans Details', 'Write-off Accounts', 'Ignore Accounts'])
  const sent: { ignore?: unknown; writeOff?: Record<string, string> } = {}
  await page.route('**/api/v1/loans?**', (r) => json(r, paged([loanRow(3)])))
  await page.route('**/api/v1/ignored-accounts', (r) => {
    sent.ignore = r.request().postDataJSON()
    return json(r, {
      message: 'Account(s) Ignored Successfully!',
      ignored: ['AA003'],
      already_ignored: [],
      unknown: [],
    })
  })

  await page.goto('/loans')
  const row = page.getByTestId('loan-row')
  await expect(row).toContainText('AA003')
  await expect(row).toContainText('UGX 1,234,567')
  await expect(row).toContainText('Term Loan')
  await expect(row).toContainText('Current')

  await row.hover()
  await row.getByRole('button', { name: 'More actions' }).click()
  await expect(page.getByRole('menuitem', { name: 'Repayments' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Write Off Account' })).toBeVisible()
  await page.getByRole('menuitem', { name: 'Ignore Account' }).click()
  await expect(page.getByText('The loan AA003 will no longer appear in the CBA')).toBeVisible()
  await page.getByRole('button', { name: 'Yes, ignore it!' }).click()
  await expect(page.getByText('Account Ignored Successfully!')).toBeVisible()
  expect(sent.ignore).toEqual({ accounts: ['AA003'] })
  await page.getByRole('button', { name: 'OK' }).click()

  // the details page: header facts, then the full details on demand
  await page.route('**/api/v1/loans/3', (r) =>
    json(
      r,
      view({
        groups: [
          {
            title: 'Account',
            rows: [{ label: 'Branch', value: 'Kampala Main (001)' }, { label: 'Loan Category' }],
          },
        ],
      }),
    ),
  )
  await page.goto('/loans/show/3')
  await expect(page.getByTestId('loan-facts')).toContainText('UGX 1,234,567')
  await expect(page.getByTestId('loan-facts')).toContainText('Working capital')
  await expect(page.getByText('Kampala Main (001)')).toBeHidden()
  await page.getByRole('button', { name: 'Show / Hide' }).click()
  await expect(page.getByText('Kampala Main (001)')).toBeVisible()

  // the write-off form is prefilled with the balance and posts what was shown
  await page.route('**/api/v1/loans/3/write-off', (r) => {
    if (r.request().method() === 'GET') return json(r, view())
    sent.writeOff = r.request().postDataJSON()
    return json(r, { message: 'Loan Account Written Off Successfully' })
  })
  await page.goto('/loans/write-off/3')
  await expect(page.getByRole('textbox').first()).toHaveValue('750,000')
  await page.getByRole('button', { name: 'Write Off Loan' }).click()
  await expect(page.getByText('Loan Account Written Off Successfully')).toBeVisible()
  expect(sent.writeOff).toMatchObject({ written_off_amt: '750000', closure_reason: '3' })
  expect(sent.writeOff?.closure_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
})

test('the write-off form shows what the server refused', async ({ page }) => {
  await signIn(page, ['Write-off Accounts'])
  await page.route('**/api/v1/loans/3/write-off', (r) =>
    r.request().method() === 'GET'
      ? json(r, view())
      : json(
          r,
          {
            status: 422,
            detail: 'The given data was invalid.',
            errors: { closure_date: ['The closure date is not a valid date.'] },
          },
          422,
        ),
  )
  await page.goto('/loans/write-off/3')
  await page.getByRole('button', { name: 'Write Off Loan' }).click()
  await expect(page.getByText('Form Validation Failed!')).toBeVisible()
  await expect(page.getByText('The closure date is not a valid date.')).toBeVisible()
})

test('repayments are numbered and an empty list says so', async ({ page }) => {
  await signIn(page, ['CBA Loans Details'])
  await page.route('**/api/v1/loans/3/repayments', (r) =>
    json(
      r,
      view({
        repayments: [
          { no: 1, paymentDate: '31-Mar-2025', paymentAmount: '175,000', lastStatusChangeDate: 'N/F' },
        ],
      }),
    ),
  )
  await page.route('**/api/v1/loans/4/repayments', (r) => json(r, view({ repayments: [] })))
  await page.goto('/loans/repayments/3')
  await expect(page.getByRole('cell', { name: '31-Mar-2025' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'N/F' })).toBeVisible()
  await page.goto('/loans/repayments/4')
  await expect(page.getByText('No repayments found at the moment!')).toBeVisible()
})

test('ignored accounts: add several codes, remove one', async ({ page }) => {
  await signIn(page, ['Ignore Accounts'])
  const sent: { add?: unknown; removed?: string } = {}
  await page.route('**/api/v1/ignored-accounts?**', (r) => json(r, paged([loanRow(3)])))
  await page.route('**/api/v1/ignored-accounts', (r) => {
    sent.add = r.request().postDataJSON()
    return json(r, {
      message: 'Account(s) Ignored Successfully!',
      ignored: [],
      already_ignored: [],
      unknown: [],
    })
  })
  await page.route('**/api/v1/ignored-accounts/AA003', (r) => {
    sent.removed = r.request().method()
    return json(r, { message: 'Loan removed from the ignored accounts successfully!' })
  })

  await page.goto('/ignored-accounts')
  await expect(page.getByTestId('loan-row')).toContainText('AA003')

  await page.getByRole('button', { name: '+ Add Accounts' }).click()
  await page.getByRole('button', { name: 'Submit Accounts' }).click()
  await expect(page.getByText('Please enter at least one contract code')).toBeVisible()
  await page.getByRole('textbox', { name: 'Contract codes' }).fill('AA1, AA2,\nAA3,')
  await page.getByRole('button', { name: 'Submit Accounts' }).click()
  await expect(page.getByText('Account(s) Ignored Successfully!')).toBeVisible()
  expect(sent.add).toEqual({ accounts: ['AA1', 'AA2', 'AA3'] })
  await page.getByRole('button', { name: 'OK' }).click()

  const row = page.getByTestId('loan-row')
  await row.hover()
  await row.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('menuitem', { name: 'Remove' }).click()
  await expect(page.getByText('This loan will appear in the CBA. Proceed?')).toBeVisible()
  await page.getByRole('button', { name: 'Yes, Proceed' }).click()
  await expect(page.getByText('Loan removed from the ignored accounts successfully!')).toBeVisible()
  expect(sent.removed).toBe('DELETE')
})

test('force closed accounts: the manual form and the template upload', async ({ page }) => {
  await signIn(page, ['View Force Closed Accounts', 'Update CBA Details'])
  const sent: { manual?: unknown; upload?: string } = {}
  await page.route('**/api/v1/force-closed-accounts?**', (r) => json(r, paged([loanRow(3)])))
  await page.route('**/api/v1/force-closed-accounts', (r) => {
    sent.manual = r.request().postDataJSON()
    return json(r, { message: 'Loan Accounts Force Closed Successfully!', closed: 1 })
  })
  await page.route('**/api/v1/force-closed-accounts/upload', (r) => {
    sent.upload = r.request().postData() ?? ''
    return json(r, {
      message:
        'Force close import finished: 0 removed from the CBA, 1 closed, 0 updated, 1 contract codes not found, 0 rows skipped.',
      rows: 2,
      removed: 0,
      closed: 1,
      updated: 0,
      not_found: ['NOLOAN1'],
      not_found_count: 1,
      skipped: [],
      skipped_count: 0,
    })
  })

  await page.goto('/force-closed-accounts')
  await expect(page.getByTestId('loan-row')).toContainText('AA003')

  await page.getByRole('button', { name: '+ Force Close Accounts' }).click()
  await page.getByLabel('Contract code, row 1').fill('AA003')
  await page.getByLabel('Closure date, row 1').fill('2026-09-30')
  await page.getByLabel('Closure reason, row 1').fill('2')
  await page.getByLabel('Last payment date, row 1').fill('2026-09-15')
  await page.getByLabel('Last payment amount, row 1').fill('5000')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('appear in the CBA as fully paid')).toBeVisible()
  await page.getByRole('button', { name: 'Yes, Proceed' }).click()
  await expect(page.getByText('Loan Accounts Force Closed Successfully!')).toBeVisible()
  expect(sent.manual).toEqual({
    accounts: [
      {
        contractCode: 'AA003',
        creditAccountClosureDate: '2026-09-30',
        creditAccountClosureReason: '2',
        lastPaymentDate: '2026-09-15',
        lastPaymentAmount: '5000',
      },
    ],
  })
  await page.getByRole('button', { name: 'OK' }).click()

  await page.getByRole('button', { name: 'Upload Template' }).click()
  await expect(page.getByRole('button', { name: 'Upload & Process' })).toBeDisabled()
  await page.locator('#fc-template-file').setInputFiles({
    name: 'closed.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('contractCode\nAA003\n'),
  })
  await page.getByLabel('Include in CBA').check()
  await page.getByRole('button', { name: 'Upload & Process' }).click()
  await expect(page.getByText('1 closed')).toBeVisible()
  await expect(page.getByText('Not found: NOLOAN1')).toBeVisible()
  expect(sent.upload).toContain('name="include_in_cba"')
  expect(sent.upload).toMatch(/name="include_in_cba"\r?\n\r?\n1\r?\n/)
  expect(sent.upload).toContain('AA003')
})

test('open accounts downloads the workbook and credit cards report unknown clients', async ({ page }) => {
  await signIn(page, ['Manage Open Accounts', 'Update CBA Details'])
  await page.route('**/api/v1/open-accounts/export', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      headers: { 'content-disposition': 'attachment; filename="open accounts export.xlsx"' },
      body: 'xlsx',
    }),
  )
  await page.route('**/api/v1/credit-cards/upload', (r) =>
    json(r, {
      message: '1 Credit Cards Uploaded Successfully',
      uploaded: 1,
      not_found: ['NOCLIENT1'],
      skipped: [],
    }),
  )

  await page.goto('/open-accounts')
  await page.getByRole('button', { name: 'GENERATE REPORT' }).click()
  await expect(page.getByText('Please choose the open accounts template first.')).toBeVisible()
  await page.getByRole('button', { name: 'OK' }).click()
  await page
    .locator('#app input[type=file]')
    .setInputFiles({ name: 'codes.csv', mimeType: 'text/csv', buffer: Buffer.from('code\nAA003\n') })
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'GENERATE REPORT' }).click()
  expect((await download).suggestedFilename()).toBe('open accounts export.xlsx')

  await page.goto('/upload-credit-cards')
  await page
    .locator('#app input[type=file]')
    .setInputFiles({ name: 'cards.csv', mimeType: 'text/csv', buffer: Buffer.from('MG/AccountNumber\n') })
  await page.getByRole('button', { name: 'UPLOAD' }).click()
  await expect(page.getByText('1 Credit Cards Uploaded Successfully')).toBeVisible()
  await expect(page.getByText('NOCLIENT1')).toBeVisible()
  await expect(page.getByText('could not find corresponding customers')).toBeVisible()
})

test('off balance sheet items: type a client number and save', async ({ page }) => {
  await signIn(page, [
    'View Off Balance Sheet Items',
    'Update Off Balance Sheet Items',
    'Delete Off Balance Sheet Items',
  ])
  let saved: unknown
  const items = [
    {
      id: 11,
      contractCode: 'OB-11',
      customerName: 'Zz Trading',
      contractType: 'Guarantee',
      amount: '5000000',
      contractDate: '20260105',
      maturityDate: '20271231',
      clientNumber: null,
    },
  ]
  await page.route('**/api/v1/off-balance-sheet-items?**', (r) => json(r, paged(items)))
  await page.route('**/api/v1/off-balance-sheet-items', (r) => {
    saved = r.request().postDataJSON()
    return json(r, {
      message: 'Off Balance Sheet Items Updated Successfully.',
      updated: 1,
      not_found: [],
      missing_items: [],
    })
  })

  await page.goto('/off-balance-sheet')
  await expect(page).toHaveURL(/\/off-balance-sheet\/items$/)
  await expect(page.getByTestId('item-row')).toContainText('Zz Trading')
  await expect(page.getByTestId('item-row')).toContainText('5,000,000')
  await page.getByRole('button', { name: 'Save Changes' }).click()
  await expect(
    page.getByText('Please fill in a client number for at least 1 off balance sheet item and try again!'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'OK' }).click()
  await page.getByLabel('Client number for OB-11').fill('1000001')
  await page.getByRole('button', { name: 'Save Changes' }).click()
  await page.getByRole('button', { name: 'Yes, Proceed!' }).click()
  await expect(page.getByText('Off Balance Sheet Items Updated Successfully.')).toBeVisible()
  expect(saved).toEqual({ items: [{ id: 11, clientNumber: '1000001' }] })
})
