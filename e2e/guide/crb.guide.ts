import { expect, test, type Locator, type Page } from '@playwright/test'
import { figure, message } from './support/guide'
import { Api } from '../uat/support/api'
import { authFile } from '../uat/support/auth'
import { CUSTOMER } from '../uat/support/env'
import { nextFromPool } from '../uat/support/data'
import { buildXlsx } from '../uat/support/xlsx'
import { confirmDialog, dialog, expectAppReadable, modal, money, uniqueAmount } from '../uat/support/ui'

/**
 * CRB Officer Guide (role id `crb`, persona uat.crb@kcb.test): CBA loans, write-offs, the CBA uploads, bounced cheques, fraud,
 * the institution, the CRB files, output files, the analysis pages and the CBA fix tools. Runs on a freshly seeded stack with no
 * T24 warehouse; the CBA file is generated here (as spec 08 does) before the pages that need it.
 */
const ROLE = 'crb'
const xlsxType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

test.use({ storageState: authFile('crb') })

/** Open the "..." menu of a loan row (it is drawn again when the list reloads, so the gesture is retried). */
async function openRowMenu(page: Page, row: Locator, item: string) {
  await expect(async () => {
    await row.hover()
    await row.getByRole('button', { name: 'More actions' }).click()
    await expect(page.getByRole('menuitem', { name: item })).toBeVisible({ timeout: 5_000 })
  }).toPass({ timeout: 40_000 })
}

/** The date selects of the profile style forms are named by prefix. */
async function pickDate(page: Page, day: string, month: string, year: string, v: { d: string; m: string; y: string }) {
  await page.locator(`[name="${day}"]`).first().selectOption(v.d)
  await page.locator(`[name="${month}"]`).first().selectOption(v.m)
  await page.locator(`[name="${year}"]`).first().selectOption(v.y)
}

/** The From and To selects of /reports/crb. */
async function reportPeriod(page: Page, from: { d: string; m: string; y: string } | null, to: { d: string; m: string; y: string }) {
  if (from) {
    await page.locator('select[name="from_day"]').selectOption(from.d)
    await page.locator('select[name="from_month"]').selectOption(from.m)
    await page.locator('select[name="from_year"]').selectOption(from.y)
  }
  await page.locator('select[name="to_day"]').selectOption(to.d)
  await page.locator('select[name="to_month"]').selectOption(to.m)
  await page.locator('select[name="to_year"]').selectOption(to.y)
}

/** A background process as GET /api/v1/background-processes lists it (the fields the journey reads). */
interface Proc {
  id: number
  type: string
  status: string
  error_message?: string | null
  progress_label?: string | null
}

async function processIds(api: Api): Promise<Set<number>> {
  const list = await api.get('/api/v1/background-processes')
  return new Set(((list.body?.data ?? []) as { id: number }[]).map((p) => p.id))
}

/** Wait until a process started after `before` whose type matches has ended; returns it. */
async function waitForProcess(api: Api, before: Set<number>, type: RegExp, timeout = 300_000): Promise<Proc> {
  let found: Proc | undefined
  await expect
    .poll(
      async () => {
        const list = await api.get('/api/v1/background-processes')
        found = ((list.body?.data ?? []) as Proc[]).find((p) => !before.has(p.id) && type.test(String(p.type)))
        return found?.status
      },
      { timeout, intervals: [2000] },
    )
    .toMatch(/completed|failed/)
  return found!
}

const PR4_HEADER = [
  'RESTRUCT TYPE', 'CUST NAME', 'TRANS ID', 'NO POL ID', 'ACCOUNT NUMBER', 'DAO CODE', 'CURRENCY', 'OD LIMIT AMT', 'BALANCE',
  'ARREARS', 'TOTAL EXPOSURE', 'REPAYMENT AMT', 'INT RATE', 'MAT DATE', 'VALUE DATE', 'CATEG DESC', 'LOAN DESCRIPTION',
  'SUB SECTOR', 'SEGMENT', 'SPEC PROV', 'NO. DUE DAYS', 'CUST ID', 'ORIGINAL AMOUNT',
]
const pr4Row = (transId: string, custId: string, balance: string) => [
  '', 'UAT Customer', transId, '', '', '4501', 'UGX', '0', balance, '0', balance, '50000', '21.5', '20271001', '20261001',
  'Check Off', 'Salary loan', 'Households', 'Retail', '0', '0', custId, '1000000',
]

/** The "More" arrow at the foot of the CBA card. */
const cbaCardMenu = (page: Page) =>
  page.locator('div.shadow-md', { has: page.getByRole('link', { name: 'Review Credit Accounts' }) }).getByRole('button', { name: 'More' })

test.describe('CRB Officer Guide', () => {
  test('01 getting started: the dashboard and the CBA menu', async ({ page }) => {
    await page.goto('/home')
    await expect(page.getByRole('link', { name: 'Review Credit Accounts' })).toBeVisible()
    await figure(page, ROLE, '01-dashboard', 'Your dashboard', [
      { target: page.getByRole('link', { name: 'CBA', exact: true }), tip: 'Click CBA to open the running loans' },
      { target: page.getByRole('link', { name: 'Upload Bounced Cheques' }), tip: 'Upload the bounced cheques of the month' },
      { target: page.getByRole('link', { name: 'CRB Reports', exact: true }), tip: 'Click CRB Reports to build the CB011 files' },
      { target: page.getByRole('link', { name: 'Output Files', exact: true }), tip: 'The files kept after a submission' },
    ])

    // the arrow of the CBA card itself (which cards have a menu depends on the user's permissions)
    await cbaCardMenu(page).click()
    await expect(page.getByRole('menuitem', { name: 'Update CBA Accounts' })).toBeVisible()
    await figure(page, ROLE, '01-cba-menu', 'The CBA menu on the dashboard', [
      { target: page.getByRole('menuitem', { name: 'Written-off Credit Account' }), tip: 'The loans you have written off' },
      { target: page.getByRole('menuitem', { name: 'Force Close Accounts' }), tip: 'Close loans by hand or by a template' },
      { target: page.getByRole('menuitem', { name: 'Fix CBA Issues' }), tip: 'Correct the CBA before you send it' },
    ])
    await page.keyboard.press('Escape')
  })

  test('02 CBA loans: the list, a loan and its repayments', async ({ page }) => {
    await page.goto('/home')
    await page.getByRole('link', { name: 'Review Credit Accounts' }).click()
    await expect(page).toHaveURL(/\/loans$/)
    await page.getByLabel('Search loans').fill('UATLN000')
    const row = page.getByTestId('loan-row').filter({ hasText: 'UATLN0001' })
    await expect(row).toHaveCount(1)
    await row.hover()
    await expect(row.locator('a', { hasText: 'Loan Details' })).toBeVisible()
    await figure(page, ROLE, '02-loans-list', 'The CBA loans list', [
      { target: page.getByLabel('Search loans'), tip: 'Type a contract code or a name' },
      { target: row.locator('a', { hasText: 'Loan Details' }), tip: 'Point at a loan and click Loan Details', side: 'below' },
      { target: row.getByRole('button', { name: 'More actions' }), tip: 'More actions: repayments, write-off, ignore', side: 'left' },
    ])

    await row.locator('a', { hasText: 'Loan Details' }).click()
    await expect(page).toHaveURL(/\/loans\/show\/\d+/)
    await page.getByRole('button', { name: 'Show / Hide' }).click()
    await expect(page.getByTestId('loan-groups')).toContainText('UATLN0001')
    await figure(page, ROLE, '02-loan-details', 'The details of a loan', [
      { target: page.getByRole('link', { name: 'Repayments' }), tip: 'Click Repayments to see the payments' },
      { target: page.getByRole('button', { name: 'Show / Hide' }), tip: 'Show or hide every field of the loan' },
    ])

    await page.getByRole('link', { name: 'Repayments' }).click()
    await expect(page.getByTestId('repayment-count')).toHaveText('2')
    await figure(page, ROLE, '02-repayments', 'The repayments of a loan', [
      { target: page.getByTestId('repayment-count'), tip: 'How many repayments the extract holds' },
      { target: page.getByRole('row').nth(1), tip: 'The newest payment is first' },
    ])
  })

  test('03 write off a loan and find it in the write-offs', async ({ page }) => {
    const api = await Api.as('crb')
    const loan = await nextFromPool(api, 'UATWO', 40)
    await page.goto('/loans')
    await page.getByLabel('Search loans').fill(loan.code)
    const row = page.getByTestId('loan-row').filter({ hasText: loan.code })
    await expect(row).toHaveCount(1)
    await openRowMenu(page, row, 'Write Off Account')
    await figure(page, ROLE, '03-loan-row-menu', 'The actions of a loan', [
      { target: page.getByRole('menuitem', { name: 'Write Off Account' }), tip: 'Click Write Off Account' },
      { target: page.getByRole('menuitem', { name: 'Ignore Account' }), tip: 'Ignore Account leaves the loan out of the CBA' },
    ])
    await page.getByRole('menuitem', { name: 'Write Off Account' }).click()
    await expect(page).toHaveURL(new RegExp(`/loans/write-off/${loan.id}`))

    const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Write Off Loan' }) })
    await expect(form).toBeVisible()
    await figure(page, ROLE, '03-write-off-form', 'Write off a loan', [
      { target: money(form, 'written_off_amt'), tip: 'Check the amount: it starts at the current balance' },
      { target: form.getByPlaceholder('dd/mm/yyyy'), tip: 'Choose the closure date' },
      { target: form.getByRole('button', { name: 'Write Off Loan' }), tip: 'Click Write Off Loan' },
    ])
    await form.getByRole('button', { name: 'Write Off Loan' }).click()
    await expect(dialog(page)).toContainText('Loan Account Written Off Successfully')
    message(ROLE, 'Loan Account Written Off Successfully', 'The loan is written off. Click OK. It is now on the Written-off Credit Accounts list.')
    await confirmDialog(page, 'OK')
    await expectAppReadable(page)

    await page.goto('/write-offs')
    await page.getByLabel('Search loans').fill(loan.code)
    const written = page.getByTestId('loan-row').filter({ hasText: loan.code })
    await expect(written).toHaveCount(1)
    await figure(page, ROLE, '03-write-offs-list', 'The written-off credit accounts', [
      { target: page.getByLabel('Search loans'), tip: 'Search by contract code or name' },
      { target: written, tip: 'The loan with its amount and current balance', side: 'below' },
    ])
    await api.dispose()
  })

  test('04 ignored and force closed accounts', async ({ page }) => {
    const api = await Api.as('crb')
    const loan = await nextFromPool(api, 'UATFC', 30)
    await page.goto('/ignored-accounts')
    await page.getByRole('button', { name: '+ Add Accounts' }).click()
    await page.locator('#swal2-textarea').fill(loan.code)
    await figure(
      page,
      ROLE,
      '04-ignore-add',
      'Add loans to the ignored accounts',
      [
        { target: page.locator('#swal2-textarea'), tip: 'Type the contract codes, separated by commas' },
        { target: page.getByRole('button', { name: 'Submit Accounts' }), tip: 'Click Submit Accounts' },
      ],
      { clip: dialog(page) },
    )
    await page.getByRole('button', { name: 'Submit Accounts' }).click()
    await expect(dialog(page)).toContainText('Account(s) Ignored Successfully!')
    message(ROLE, 'Account(s) Ignored Successfully!', 'The loans are on the ignored list and stay out of the CBA. Click OK.')
    await confirmDialog(page, 'OK')
    await expectAppReadable(page)

    await page.goto('/force-closed-accounts')
    await expect(page.getByRole('button', { name: 'Upload Template' })).toBeVisible()
    await figure(page, ROLE, '04-force-closed-list', 'The force closed accounts', [
      { target: page.getByRole('button', { name: '+ Force Close Accounts' }), tip: 'Close loans one by one' },
      { target: page.getByRole('button', { name: 'Upload Template' }), tip: 'Or upload a file of closed loans', side: 'below' },
    ])
    await page.getByRole('button', { name: 'Upload Template' }).click()
    const upload = page.getByRole('dialog').filter({ hasText: 'Upload Mopesa Closed Loans Template' })
    await expect(upload).toBeVisible()
    await figure(
      page,
      ROLE,
      '04-force-close-upload',
      'Upload the closed loans template',
      [
        { target: upload.getByRole('link', { name: /Download Template/ }), tip: 'Download the template first', side: 'below' },
        { target: page.locator('#fc-template-file'), tip: 'Choose the filled file', side: 'below' },
        { target: upload.getByLabel('Include in CBA'), tip: 'Tick it to keep the accounts in the CBA', side: 'below' },
        { target: upload.getByRole('button', { name: 'Upload & Process' }), tip: 'Click Upload & Process', side: 'left' },
      ],
      { clip: upload },
    )
    await upload.getByRole('button', { name: '× Cancel' }).click()
    await api.dispose()
  })

  test('05 uploads: open accounts, credit cards and off balance sheet items', async ({ page }) => {
    await page.goto('/open-accounts')
    await page.locator('#app input[type="file"]').setInputFiles({
      name: 'open-accounts.xlsx',
      mimeType: xlsxType,
      buffer: buildXlsx([['contractCode'], ['UATLN0001'], ['UATLN0002']]),
    })
    await figure(page, ROLE, '05-open-accounts', 'Open accounts: the loans of a list of contract codes', [
      { target: page.getByRole('link', { name: /Download Template/ }), tip: 'Download the template: one contractCode per row' },
      { target: page.getByRole('button', { name: 'open-accounts.xlsx' }), tip: 'Drop the filled template here, or click to browse', side: 'below' },
      { target: page.getByRole('button', { name: 'GENERATE REPORT' }), tip: 'Click GENERATE REPORT to download the workbook', side: 'below' },
    ])
    const report = page.waitForEvent('download')
    await page.getByRole('button', { name: 'GENERATE REPORT' }).click()
    expect((await report).suggestedFilename()).toMatch(/\.xlsx$/)

    await page.goto('/upload-credit-cards')
    await figure(page, ROLE, '05-credit-cards', 'Upload credit cards', [
      { target: page.getByRole('link', { name: /Download Template/ }), tip: 'Download the credit card template' },
      { target: page.getByRole('button', { name: /credit cards template/ }), tip: 'Drop the filled template here, or click to browse', side: 'below' },
      { target: page.getByRole('button', { name: 'UPLOAD' }), tip: 'Click UPLOAD: each row becomes a loan account', side: 'below' },
    ])

    await page.goto('/off-balance-sheet/items')
    // one item, so the Save Changes button is on the same screen
    await page.getByLabel('Search by contract code').fill('UATOBX0040')
    const item = page.getByTestId('item-row')
    await expect(item).toHaveCount(1)
    await figure(page, ROLE, '05-off-balance-items', 'Off balance sheet items waiting for a client number', [
      { target: page.getByLabel('Search by contract code'), tip: 'Search by contract code', side: 'below' },
      { target: page.getByRole('button', { name: 'Apply Filter' }), tip: 'Or choose two dates and click Apply Filter', side: 'below' },
      { target: item.getByRole('textbox'), tip: 'Type the client number of the customer' },
      { target: page.getByRole('button', { name: 'Save Changes' }), tip: 'Click Save Changes: matched items join the CBA' },
    ])
  })

  test('06 bounced cheques and the fully paid / written off upload', async ({ page }) => {
    const cheque = `UG${Date.now().toString().slice(-9)}`
    const rows = [
      ['Account Number', 'Account Balance', 'Cheque Number', 'Cheque Amount', 'Currency', 'Beneficiary', 'Bounce Date', 'Reason'],
      [`0100917001/${CUSTOMER.bounced}`, '2500', cheque, '1,250,000', 'UGX', 'Kato Hardware', '15/10/2026', 'Insufficient funds'],
      ['0100999999/9199999', '10', `${cheque}X`, '1000', 'UGX', 'Nobody', '20/10/2026', ''],
    ]
    await page.goto('/upload-bounced-cheques')
    await page
      .locator('#app input[type="file"]')
      .setInputFiles({ name: 'bounced-cheques-october.xlsx', mimeType: xlsxType, buffer: buildXlsx(rows) })
    await figure(page, ROLE, '06-bc-upload', 'Upload bounced cheques', [
      { target: page.getByRole('link', { name: /Download Template/ }), tip: 'Download the bounced cheques template' },
      { target: page.getByRole('button', { name: 'bounced-cheques-october.xlsx' }), tip: 'Drop the filled template here, or click to browse', side: 'below' },
      { target: page.getByRole('button', { name: 'Upload', exact: true }), tip: 'Click Upload', side: 'below' },
    ])
    await page.getByRole('button', { name: 'Upload', exact: true }).click()
    await expect(page).toHaveURL(/\/bc-list/)
    await expect(dialog(page)).toContainText('1 Bounced Cheques Uploaded Successfully')
    await figure(
      page,
      ROLE,
      '06-bc-uploaded',
      'The result of a bounced cheques upload',
      [
        { target: dialog(page).locator('.swal2-html-container'), tip: 'What was saved, and the accounts with no customer' },
        { target: page.locator('.swal2-confirm'), tip: 'Click OK to see the list' },
      ],
      { clip: dialog(page) },
    )
    message(ROLE, '1 Bounced Cheques Uploaded Successfully', 'The cheques are saved and listed under BC. The number is how many rows were saved.')
    message(
      ROLE,
      'Accounts Numbers: … could not find corresponding customers. Please make sure that these customers exist in credit analyst and re-upload Bounced Cheques for these clients!',
      'Those rows were not saved. Create or import the customers (Profiles), then upload a file with only those rows.',
    )
    await confirmDialog(page, 'OK')
    await expectAppReadable(page)
    await expect(page.getByRole('row', { name: new RegExp(cheque) }).first()).toBeVisible()

    await page.goto('/upload-fully-paid-or-write-offs')
    await figure(page, ROLE, '06-fully-paid-upload', 'Upload fully paid or written-off accounts', [
      { target: page.getByRole('button', { name: /fully paid \/ written off template/ }), tip: 'Drop the workbook here, or click to browse', side: 'below' },
      { target: page.getByRole('button', { name: 'Upload', exact: true }), tip: 'Click Upload: the loans get the new status', side: 'below' },
    ])
  })

  test('07 fraud (FRA): the list and a new record', async ({ page }) => {
    await page.goto('/home')
    await page.getByRole('link', { name: '+ New Financial Malpractice' }).click()
    await expect(page).toHaveURL(/\/fraud/)
    await expect(page.getByRole('button', { name: /^Edit / }).first()).toBeVisible()
    await figure(page, ROLE, '07-fraud-list', 'The fraud (FRA) records', [
      { target: page.getByRole('button', { name: 'Register Fraud' }), tip: 'Click Register Fraud to add a record', side: 'left' },
      { target: page.getByRole('button', { name: /^Edit / }).first(), tip: 'Click the pencil to change a record', side: 'left' },
    ])

    await page.getByRole('button', { name: 'Register Fraud' }).click()
    await page.getByLabel('Search Customers', { exact: true }).fill('Mukasa')
    const choose = page.getByRole('row', { name: /Mukasa Francis/ }).getByRole('button', { name: 'Select' })
    await expect(choose).toBeVisible()
    await choose.click()
    const form = modal(page)
    await expect(form.getByRole('textbox', { name: 'Surname' })).toHaveValue('Mukasa')
    await form.locator('select[name="fraudCategory"]').selectOption('2')
    await pickDate(page, 'incident_day', 'incident_month', 'incident_year', { d: '5', m: '10', y: '2026' })
    await money(form, 'saving_amount').fill('100000')
    await money(form, 'loss_amount').fill(uniqueAmount())
    await form.locator('select[name="currency"]').selectOption('UGX')
    await form.locator('textarea[name="incidentDetails"]').fill('Forged signature on a withdrawal slip')
    await form.locator('select[name="forensicInformation"]').selectOption('A')
    await figure(
      page,
      ROLE,
      '07-fraud-form',
      'Register a fraud record',
      [
        { target: form.locator('select[name="fraudCategory"]'), tip: 'Choose the fraud category' },
        { target: form.locator('select[name="incident_day"]'), tip: 'Choose the incident date' },
        { target: money(form, 'loss_amount'), tip: 'Type the loss amount' },
        { target: form.locator('textarea[name="incidentDetails"]'), tip: 'Describe what happened' },
      ],
      { steps: ['Check the customer details copied from the profile further down the form.', 'Click Save at the bottom of the form.'] },
    )
    await form.getByRole('button', { name: 'Save' }).click()
    await expect(dialog(page)).toContainText('FRA Saved Successfully')
    message(ROLE, 'FRA Saved Successfully', 'The record is saved and goes in the next FRA file. Click OK.')
    await confirmDialog(page, 'OK')
    await expectAppReadable(page)
  })

  test('08 the institution, branches and PI stakeholders', async ({ page }) => {
    await page.goto('/institution')
    await expect(page.locator('input[name="InstitutionName"]')).not.toHaveValue('')
    await figure(
      page,
      ROLE,
      '08-institution',
      'The participating institution details',
      [
        { target: page.locator('input[name="IdentificationCode"]'), tip: 'The code the bureau gave the bank' },
        { target: page.locator('input[name="InstitutionName"]'), tip: 'The name as it goes in the PI file' },
        { target: page.locator('input[name="LicenseNumber"]'), tip: 'The licence number' },
      ],
      { steps: ['Change what is out of date.', 'Scroll down and click Save.'] },
    )

    await page.goto('/branches')
    await expect(page.getByRole('link', { name: /^Edit / }).first()).toBeVisible()
    await figure(page, ROLE, '08-branches', 'The branches of the bank', [
      { target: page.getByRole('link', { name: 'New Branch' }), tip: 'Click New Branch to add one', side: 'below' },
      { target: page.getByRole('button', { name: 'Transfer Branch Customers' }), tip: 'Move all customers of one branch to another', side: 'below' },
      { target: page.getByRole('link', { name: /^Edit / }).first(), tip: 'Click the pencil to change a branch', side: 'left' },
      { target: page.getByRole('button', { name: /^Request deletion of / }).first(), tip: 'Ask for a branch to be deleted', side: 'left' },
    ])

    await page.getByRole('link', { name: 'New Branch' }).click()
    await expect(page.locator('input[name="BranchName"]')).toBeVisible()
    await figure(
      page,
      ROLE,
      '08-branch-new',
      'A new branch',
      [
        { target: page.locator('input[name="BranchName"]'), tip: 'Type the branch name' },
        { target: page.locator('input[name="bankBranchCode"]'), tip: 'The code the bank uses' },
        { target: page.locator('input[name="BranchIdentificationCode"]'), tip: 'The code the Bank of Uganda gave' },
        { target: page.locator('select[name="BranchType"]'), tip: 'Choose the branch type' },
      ],
      { steps: ['Fill in the date opened and the address.', 'Click Save. You change a branch the same way after clicking its pencil.'] },
    )

    await page.goto('/pis')
    await page.getByRole('button', { name: 'New PIS ▾' }).click()
    await expect(page.getByRole('menuitem', { name: 'Existing Profile' })).toBeVisible()
    await figure(page, ROLE, '08-pis', 'The PI stakeholders', [
      { target: page.getByRole('menuitem', { name: 'Existing Profile' }), tip: 'Use a customer already in Credit Analyst', side: 'left' },
      { target: page.getByRole('menuitem', { name: 'New Profile' }), tip: 'Or type a new person or company', side: 'left' },
    ])
    await page.keyboard.press('Escape')
  })

  test('09 CRB reports: a CB011 file and the CBA in the background', async ({ page }) => {
    test.setTimeout(600_000)
    await page.goto('/reports/crb')
    await page.locator('#file_name').selectOption('BC')
    await reportPeriod(page, { d: '1', m: '1', y: '2026' }, { d: '31', m: '10', y: '2026' })
    await figure(page, ROLE, '09-crb-reports', 'The CRB reports form', [
      { target: page.locator('#file_name'), tip: 'Choose the report type' },
      { target: page.getByTestId('from-block'), tip: 'The first day of the period' },
      { target: page.getByTestId('to-block'), tip: 'The last day: it is the date in the file name' },
      { target: page.getByTestId('download'), tip: 'Click Download Report to save the CB011 file', side: 'below' },
    ])
    const bc = page.waitForEvent('download')
    await page.getByTestId('download').click()
    expect((await bc).suggestedFilename()).toBe('CB01120261031BC.csv')
    await expect(page.locator('.iziToast').filter({ hasText: 'The report has been generated.' })).toBeVisible()
    message(ROLE, 'The report has been generated.', 'The CB011 file is in your downloads folder. Check it before you send it to the bureau.')

    // the CBA: the fixture loans were submitted for the end of September
    const api = await Api.as('crb')
    const before = await processIds(api)
    await page.locator('#file_name').selectOption('CBA')
    await reportPeriod(page, null, { d: '30', m: '9', y: '2026' })
    await expect(page.getByTestId('short-cba')).toBeVisible()
    await figure(page, ROLE, '09-cba-form', 'Ask for the CBA file', [
      { target: page.locator('#file_name'), tip: 'Choose CBA' },
      { target: page.getByTestId('to-block'), tip: 'Choose the month end you report' },
      { target: page.getByTestId('short-cba'), tip: 'Tick only to write the file from the table as it is now', side: 'below' },
      { target: page.getByTestId('download'), tip: 'Click Download Report to start', side: 'below' },
    ])
    await page.getByTestId('download').click()
    await expect(dialog(page)).toContainText('CBA report generation has been queued and is running in the background.')
    await figure(
      page,
      ROLE,
      '09-cba-queued',
      'The CBA file is built in the background',
      [{ target: page.getByRole('button', { name: 'View Progress →' }), tip: 'Click View Progress to follow it' }],
      { clip: dialog(page) },
    )
    message(
      ROLE,
      'CBA report generation has been queued and is running in the background.',
      'Click View Progress. Download the file from Background Processes when it shows Completed.',
    )
    message(ROLE, 'A CBA generation or cleanup is already running.', 'Wait for the run on Background Processes to finish, then ask again.')
    await page.getByRole('button', { name: 'View Progress →' }).click()
    await expect(page).toHaveURL(/\/background-processes/)
    await expectAppReadable(page)

    await waitForProcess(api, before, /^cba_generation$/, 400_000)
    const cleanup = await waitForProcess(api, before, /^cba_cleanup$/, 400_000)
    expect(cleanup.status, `${cleanup.error_message ?? cleanup.progress_label}`).toBe('completed')
    await page.reload()
    const row = page.getByTestId(`process-${cleanup.id}`)
    await expect(row.getByTestId('download')).toBeVisible()
    await figure(page, ROLE, '09-processes-download', 'Download the CBA file from Background Processes', [
      { target: row.getByTestId('badge'), tip: 'Completed when the file is ready', side: 'below' },
      { target: row.getByRole('progressbar'), tip: 'How far the run has got', side: 'below' },
      { target: row.getByTestId('download'), tip: 'Click Download to save the CBA file', side: 'left' },
    ])
    const cba = page.waitForEvent('download')
    await row.getByTestId('download').click()
    expect((await cba).suggestedFilename()).toBe('CB01120260930CBA.csv')
    await api.dispose()
  })

  test('10 output files: bureau feedback and the Excel to CSV converter', async ({ page }) => {
    await page.goto('/output-files')
    await page.locator('select[name="report_type"]').selectOption('bc')
    await page.locator('#output_file').setInputFiles({
      name: 'CB01120261031BC-feedback.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('"H"|"CB011"|"KCB Bank Uganda LTD"|"20261031"|"8.0"\n'),
    })
    await page.locator('#rule_name').fill('BC_GUIDE')
    await figure(page, ROLE, '10-feedback-upload', 'Find the records the bureau rejected', [
      { target: page.locator('select[name="report_type"]'), tip: 'Choose the report type of the feedback file' },
      { target: page.locator('#output_file'), tip: 'Choose the CSV file the bureau sent back' },
      { target: page.locator('#rule_name'), tip: 'Type the rule name, for example CBA_399' },
      { target: page.getByTestId('extract'), tip: 'Click Get Affected Records', side: 'below' },
    ])
    const extracted = page.waitForEvent('download')
    await page.getByTestId('extract').click()
    expect((await extracted).suggestedFilename()).toMatch(/BC_GUIDE/)

    const row = page.getByTestId('output-row').filter({ hasText: 'BC_GUIDE' }).first()
    await expect(row).toBeVisible()
    await figure(page, ROLE, '10-output-files', 'The output files', [
      { target: row.getByTestId('time-left'), tip: 'Files are kept for 15 days' },
      { target: row.getByRole('button', { name: /^Download / }), tip: 'Click the arrow to download the file again', side: 'left' },
      { target: page.getByTestId('convert'), tip: 'Turn an Excel sheet into the bureau CSV', side: 'below' },
    ])

    await page.getByLabel('Conversion version').selectOption('8.0')
    await page.locator('#excel_file').setInputFiles({
      name: 'corrections.xlsx',
      mimeType: xlsxType,
      buffer: buildXlsx([['Data', 'Code'], ['D', 'CB011']]),
    })
    const converted = page.waitForEvent('download')
    await page.getByTestId('convert').click()
    await converted
  })

  test('11 and 12 loans without securities and the submission analysis', async ({ page }) => {
    await page.goto('/reports/loans-without-cmc-bs-ccg')
    await page.getByLabel('Search contract code').fill('AA00UAT0')
    const listed = page.getByTestId('loan-row').filter({ hasText: 'AA00UAT01' })
    await expect(listed).toHaveCount(1)
    await figure(page, ROLE, '11-loans-without', 'Loans without CMC, CCG or BS', [
      { target: page.getByLabel('Search contract code'), tip: 'Search by contract code', side: 'below' },
      { target: listed.locator('span.rounded'), tip: 'What the loan lacks' },
      { target: listed.getByRole('link', { name: /^Open / }), tip: 'Open the loan to add the security', side: 'left' },
    ])

    await page.goto('/reports/submission-analysis')
    await expect(page.getByTestId('bounced')).toBeVisible()
    await figure(page, ROLE, '12-submission-analysis', 'The submission analysis', [
      { target: page.getByTestId('pdf'), tip: 'Click Download Report for a PDF', side: 'left' },
      { target: page.getByTestId('bounced').locator('h2'), tip: 'Each file with its count and dates' },
    ])
    const pdf = page.waitForEvent('download')
    await page.getByTestId('pdf').click()
    expect((await pdf).suggestedFilename()).toMatch(/\.pdf$/)
  })

  test('13 PR4 upload and analysis against the CBA', async ({ page }) => {
    test.setTimeout(600_000)
    const api = await Api.as('crb')
    const before = await processIds(api)
    await page.goto('/home')
    await page.getByRole('link', { name: 'Run Analysis' }).click()
    await expect(page).toHaveURL(/\/analysis$/)
    await page.getByLabel('Exchange Rate (USD → UGX)').fill('3765')
    await page.locator('#actionSelect').selectOption('analyse_pr4')
    await page.locator('#app input[type="file"]').setInputFiles({
      name: 'PR4-october.xlsx',
      mimeType: xlsxType,
      buffer: buildXlsx(
        [
          PR4_HEADER,
          pr4Row('UATPR0001', '9100010', '41000000'),
          pr4Row('UATPR0002', '9100012', '120000'),
          pr4Row('UATPR0003', '9100010', '1'),
          pr4Row(`AA${Date.now().toString().slice(-8)}`, '9100099', '500000'),
        ],
        'PR4',
      ),
    })
    await figure(
      page,
      ROLE,
      '13-pr4-form',
      'Upload the PR4 file',
      [
        { target: page.getByLabel('Exchange Rate (USD → UGX)'), tip: 'Type the USD rate of that month end' },
        { target: page.locator('#actionSelect'), tip: 'Choose ANALYZE PR4 AGAINST CBA' },
        { target: page.getByRole('button', { name: 'PR4-october.xlsx' }), tip: 'Drop the PR4 file here, or click to browse' },
        { target: page.getByTestId('submit'), tip: 'Click to upload', side: 'below' },
      ],
      { steps: ['Leave the Submission Date on the last day of the reporting month (it starts on the last month end).'] },
    )
    await page.getByTestId('submit').click()
    await expect(dialog(page)).toContainText('PR4 file queued for background processing.')
    message(ROLE, 'PR4 file queued for background processing.', 'Click View Background Process and wait until it shows Completed.')
    await page.getByRole('button', { name: 'View Background Process' }).click()
    await expect(page).toHaveURL(/\/background-processes/)

    const process = await waitForProcess(api, before, /pr4/i, 400_000)
    expect(process.status, `${process.error_message ?? process.progress_label}`).toBe('completed')
    await page.goto('/analysis/pr4/results')
    await expect(page.getByText('Pr4 Report File Analyzed against the CBA successfully!')).toBeVisible()
    await figure(page, ROLE, '13-pr4-results', 'The PR4 analysis results', [
      { target: page.getByRole('status'), tip: 'The analysis finished' },
      { target: page.getByTestId('month'), tip: 'The reporting month of the PR4 file' },
      { target: page.getByTestId('line-compared'), tip: 'How many PR4 records were compared with the CBA', side: 'below' },
    ])
    message(ROLE, 'Pr4 Report File Analyzed against the CBA successfully!', 'Read the results. Lines in red need a look before you send the CBA.')
    await api.dispose()
  })

  test('14 CBA fix tools', async ({ page }) => {
    await page.goto('/home')
    await cbaCardMenu(page).click()
    await page.getByRole('menuitem', { name: 'Update CBA Accounts' }).click()
    await expect(page).toHaveURL(/\/cba\/output/)
    await page.getByPlaceholder('Enter Account Reference or Client Number').fill('UATLN0001')
    await page.getByRole('button', { name: 'Load Account', exact: true }).first().click()
    await expect(page.getByTestId('page-status')).toContainText('account')
    await expect(page.getByTestId('validations')).not.toContainText('loading...')
    await figure(page, ROLE, '14-update-cba-accounts', 'Update CBA accounts', [
      { target: page.getByPlaceholder('Enter Account Reference or Client Number'), tip: 'Type an account reference or client number', side: 'above' },
      { target: page.getByRole('button', { name: 'Load Account', exact: true }).first(), tip: 'Click Load Account, then change the cells', side: 'above' },
      { target: page.getByTestId('save'), tip: 'Click Save Changes', side: 'below' },
      { target: page.getByTestId('validations'), tip: 'The CBA rules: View lists the accounts that break one', side: 'left' },
    ])

    await page.getByTestId('download-short').click()
    const short = page.getByRole('dialog').filter({ hasText: 'Download Short CBA' })
    await expect(short).toBeVisible()
    await figure(
      page,
      ROLE,
      '14-download-short-cba',
      'Download the short CBA',
      [
        { target: short.getByPlaceholder('dd/mm/yyyy'), tip: 'Choose the report date' },
        { target: short.locator('#cba-version'), tip: 'Choose the DSM version, 8.0 or 7.0' },
        { target: short.getByTestId('download-confirm'), tip: 'Click Download, then follow it on Background Processes' },
      ],
      { clip: short },
    )
    await short.getByRole('button', { name: 'Cancel' }).click()

    await page.goto('/cba/fix')
    await expect(page.getByRole('tab', { name: /Delete Reported Records/ })).toBeVisible()
    await figure(page, ROLE, '14-fix-delete', 'Fix CBA issues: delete reported records', [
      { target: page.getByRole('tab', { name: /Delete Reported Records/ }), tip: 'Remove records from the CBA', side: 'below' },
      { target: page.getByRole('link', { name: 'Download template' }), tip: 'Download the template: one contractCode column', side: 'left' },
      { target: page.locator('label.form-input[for="delete-file"]'), tip: 'Choose the filled file', side: 'below' },
      { target: page.getByTestId('submit').first(), tip: 'Click Delete Records: this cannot be undone', side: 'right' },
    ])
    await page.getByRole('tab', { name: /Fix Customer Details/ }).click()
    await expect(page.getByText('Upload Customer Details to Fix')).toBeVisible()
    await figure(page, ROLE, '14-fix-customer', 'Fix CBA issues: customer details', [
      { target: page.getByRole('tab', { name: /Fix Customer Details/ }), tip: 'Correct date of birth, NIN or gender', side: 'below' },
      { target: page.getByRole('link', { name: 'Download template' }), tip: 'Download the template: clientNumber, dob, nin, gender', side: 'left' },
      { target: page.locator('label.form-input[for="customer-file"]'), tip: 'Choose the filled file', side: 'below' },
    ])
    message(ROLE, 'Delete job queued. Track progress in Background Processes.', 'Click View Background Process and check that it completes.')
    message(ROLE, 'Customer details fix job queued. Track progress in Background Processes.', 'Click View Background Process and check that it completes.')
  })
})
