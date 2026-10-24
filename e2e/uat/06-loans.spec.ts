import { expect, test, type Page } from '@playwright/test'
import { Api } from './support/api'
import { authFile } from './support/auth'
import { CUSTOMER } from './support/env'
import { nextFromPool, uniqueName } from './support/data'
import { buildXlsx, readXlsx } from './support/xlsx'
import { confirmDialog, dialog, expectAppReadable, rowMenu, today, unique } from './support/ui'

test.use({ storageState: authFile('crb') })

/** The row of a list of loans (the list is searched first). */
async function loanRow(page: Page, path: string, code: string) {
  await page.goto(path)
  await page.getByLabel('Search loans').fill(code)
  const row = page.getByTestId('loan-row').filter({ hasText: code })
  await expect(row).toHaveCount(1)
  return row
}

test.describe('CBA loans: list, details and repayments', () => {
  test('a borrower is found in the loan list and the details and repayments of a loan are shown', async ({
    page,
  }) => {
    await page.goto('/home')
    await page.getByRole('link', { name: 'Review Credit Accounts' }).click()
    await expect(page).toHaveURL(/\/loans$/)
    await page.getByLabel('Search loans').fill('Kiggundu')
    await expect(page.getByTestId('loan-row').filter({ hasText: 'UATLN0001' })).toHaveCount(1)
    await expect(page.getByTestId('loan-row').filter({ hasText: 'UATLN0002' })).toHaveCount(1)
    const row = page.getByTestId('loan-row').filter({ hasText: 'UATLN0001' })
    await expect(row).toContainText('UGX 50,000,000')
    await row.hover()
    await row.getByRole('link', { name: 'Loan Details' }).click()
    await expect(page).toHaveURL(/\/loans\/show\/\d+/)
    await expect(page.getByText('UATLN0001').first()).toBeVisible()
    await page.getByRole('button', { name: 'Show / Hide' }).click()
    await expect(page.getByTestId('loan-groups')).toContainText('UATLN0001')
    // repayments come from the extract, newest first
    await page.getByRole('link', { name: 'Repayments' }).click()
    await expect(page.getByTestId('repayment-count')).toHaveText('2')
    await expect(page.getByRole('row').nth(1)).toContainText('20260915')
  })

  test('a loan without repayments says so', async ({ page }) => {
    const row = await loanRow(page, '/loans', 'UATLN0003')
    await row.hover()
    await row.getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('menuitem', { name: 'Repayments' }).click()
    await expect(page.getByText('No repayments found at the moment!')).toBeVisible()
  })

  test('the loan list and its details need View CBA Loans and CBA Loans Details', async ({ browser }) => {
    const noaccess = await browser.newContext({ storageState: authFile('noaccess') })
    const page = await noaccess.newPage()
    await page.goto('/loans')
    await expect(page).toHaveURL(/\/errors\/403/)
    const api = await Api.as('noaccess')
    expect((await api.get('/api/v1/loans')).status).toBe(403)
    await api.dispose()
    await noaccess.close()
    const readonly = await Api.as('readonly')
    const list = await readonly.get('/api/v1/loans', { search: 'UATLN0001' })
    expect(list.status).toBe(200)
    // the read-only user may look but not write off or ignore
    expect(
      (
        await readonly.post(`/api/v1/loans/${list.body.data[0].id}/write-off`, {
          written_off_amt: '1',
          closure_date: today(),
          closure_reason: '3',
        })
      ).status,
    ).toBe(403)
    expect((await readonly.post('/api/v1/ignored-accounts', { contractCodes: ['UATLN0001'] })).status).toBe(
      403,
    )
    await readonly.dispose()
  })

  test('securities can be added to a loan account from its page', async ({ page }) => {
    const row = await loanRow(page, '/loans', 'UATLN0004')
    await row.hover()
    await row.getByRole('link', { name: 'Loan Details' }).click()
    await expect(page.getByRole('button', { name: 'Add Collateral' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Add Guarantors/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Add Stakeholder/ })).toBeVisible()
  })
})

test.describe('write-offs', () => {
  test('a loan is written off from the loan list and then shows in the write-offs', async ({ page }) => {
    const api = await Api.as('crb')
    const loan = await nextFromPool(api, 'UATWO', 40)
    const row = await loanRow(page, '/loans', loan.code)
    await rowMenu(page, row, 'Write Off Account')
    await expect(page).toHaveURL(new RegExp(`/loans/write-off/${loan.id}`))
    await page.getByRole('button', { name: 'Write Off Loan' }).click()
    await expect(dialog(page)).toContainText(/written off/i)
    await confirmDialog(page, 'OK')
    await expectAppReadable(page)

    await page.goto('/write-offs')
    await page.getByLabel('Search loans').fill(loan.code)
    const written = page.getByTestId('loan-row').filter({ hasText: loan.code })
    await expect(written).toHaveCount(1)
    const saved = await api.get('/api/v1/write-offs', { search: loan.code })
    expect(saved.body.data[0].contractCode).toBe(loan.code)
    // writing the same loan off again is refused by the form
    await page.goto(`/loans/write-off/${loan.id}`)
    await page.getByRole('button', { name: 'Write Off Loan' }).click()
    await expect(page.getByRole('alert').or(dialog(page))).toBeVisible()
    await api.dispose()
  })

  test('a write-off with an amount above the balance or a future date is refused', async () => {
    const api = await Api.as('crb')
    const loan = await nextFromPool(api, 'UATWO', 40)
    const tooMuch = await api.post(`/api/v1/loans/${loan.id}/write-off`, {
      written_off_amt: '999999999',
      closure_date: today(),
      closure_reason: '3',
    })
    expect(tooMuch.status).toBe(422)
    const future = await api.post(`/api/v1/loans/${loan.id}/write-off`, {
      written_off_amt: '1000',
      closure_date: today(400),
      closure_reason: '3',
    })
    expect(future.status).toBe(422)
    await api.dispose()
  })
})

test.describe('ignored and force closed accounts, open accounts and credit cards', () => {
  test('accounts are ignored by contract code and removed from the ignored list again', async ({ page }) => {
    const api = await Api.as('crb')
    const loan = await nextFromPool(api, 'UATFC', 30)
    await page.goto('/ignored-accounts')
    await page.getByRole('button', { name: '+ Add Accounts' }).click()
    await page.getByLabel('Contract codes').fill(loan.code)
    await page.getByRole('button', { name: 'Submit Accounts' }).click()
    await expect(dialog(page)).toContainText(/Ignored|ignored/)
    await confirmDialog(page, 'OK')
    await expectAppReadable(page)
    const row = await loanRow(page, '/ignored-accounts', loan.code)
    await rowMenu(page, row, 'Remove')
    await confirmDialog(page, 'Yes, Proceed')
    await expect(dialog(page)).toContainText(/removed|Removed/)
    await confirmDialog(page, 'OK')
    await page.getByLabel('Search loans').fill(loan.code)
    await expect(page.getByTestId('loan-row')).toHaveCount(0)
    // an unknown contract code is reported, not ignored silently
    const unknown = await api.post('/api/v1/ignored-accounts', { contractCodes: [`NOSUCH${unique()}`] })
    expect(unknown.status).toBeGreaterThanOrEqual(400)
    await api.dispose()
  })

  test('loans are force closed by hand and by a template of contract codes', async ({ page }) => {
    const api = await Api.as('crb')
    const manual = await nextFromPool(api, 'UATFC', 30)
    await page.goto('/force-closed-accounts')
    await page.getByRole('button', { name: '+ Force Close Accounts' }).click()
    await page.getByLabel('Contract code, row 1').fill(manual.code)
    await page.getByLabel('Closure date, row 1').fill(today())
    await page.getByLabel('Closure reason, row 1').fill('2')
    await page.getByLabel('Last payment date, row 1').fill(today(-3))
    await page.getByLabel('Last payment amount, row 1').fill('150000')
    await page.getByRole('button', { name: /^Save/ }).click()
    await expect(dialog(page)).toContainText('You are about to force close loan accounts')
    await confirmDialog(page, 'Yes, Proceed')
    await expect(dialog(page)).toContainText(/force closed|Force Closed|closed/i)
    await confirmDialog(page, 'OK')
    const row = await loanRow(page, '/force-closed-accounts', manual.code)
    await expect(row).toBeVisible()

    // a one-column template of contract codes
    const viaFile = await nextFromPool(api, 'UATFC', 30)
    await page.goto('/force-closed-accounts')
    await page.getByRole('button', { name: 'Upload Template' }).click()
    await page.locator('#fc-template-file').setInputFiles({
      name: 'closed-loans.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: buildXlsx([['contractCode'], [viaFile.code]]),
    })
    await page
      .getByRole('button', { name: /Upload|Submit|Process/ })
      .last()
      .click()
    await expect(dialog(page)).toBeVisible()
    await confirmDialog(page, 'OK')
    await expectAppReadable(page)
    await api.dispose()
  })

  test('the open accounts report contains the loans of the uploaded contract codes', async ({ page }) => {
    await page.goto('/open-accounts')
    await page.locator('input[type="file"]').setInputFiles({
      name: 'open-accounts.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: buildXlsx([['contractCode'], ['UATLN0001'], ['UATLN0002']]),
    })
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'GENERATE REPORT' }).click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(/\.xlsx$/)
    const rows = readXlsx(
      Buffer.from(await (await import('node:fs/promises')).readFile((await file.path()) as string)),
    )
    const flat = rows.flat().join('|')
    expect(flat).toContain('UATLN0001')
    expect(flat).toContain('UATLN0002')
    expect(flat).not.toContain('UATLN0003')
  })

  test('a credit card template creates a loan account and a bad template is refused', async ({ page }) => {
    const code = `UATCC${Date.now().toString().slice(-8)}`
    const header = Array.from({ length: 46 }, (_, i) => (i === 0 ? 'MG/AccountNumber' : `col${i}`))
    const row = Array.from({ length: 46 }, () => '')
    Object.assign(row, {
      0: CUSTOMER.loans,
      1: code,
      2: '20260801',
      4: '2000000',
      9: 'UGX',
      10: '3',
      12: '20281231',
      22: '1500000',
      28: '5',
    })
    await page.goto('/upload-credit-cards')
    await page.locator('input[type="file"]').setInputFiles({
      name: 'cards.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: buildXlsx([header, row]),
    })
    await page.getByRole('button', { name: 'UPLOAD' }).click()
    await expect(dialog(page)).toContainText('1 Credit Cards Uploaded Successfully')
    await confirmDialog(page, 'OK')
    const api = await Api.as('crb')
    const found = await api.get('/api/v1/loans', { search: code })
    expect(found.body.data.map((l: any) => l.contractCode)).toContain(code)

    await page.reload()
    await page.locator('input[type="file"]').setInputFiles({
      name: 'wrong.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: buildXlsx([
        ['a', 'b'],
        ['1', '2'],
      ]),
    })
    await page.getByRole('button', { name: 'UPLOAD' }).click()
    await expect(dialog(page)).toContainText('Invalid Credit Card Template!')
    await confirmDialog(page, 'OK')
    await api.dispose()
  })
})

test.describe('off balance sheet items', () => {
  test('a client number is filled in for an item and another item is deleted', async ({ page }) => {
    const api = await Api.as('crb')
    const fill = await nextFromPool(api, 'UATOBX', 40)
    const drop = await nextFromPool(api, 'UATOBX', 40)
    await page.goto('/off-balance-sheet/items')
    await page.getByLabel('Search by contract code').fill(fill.code)
    const row = page.getByTestId('item-row').filter({ hasText: fill.code })
    await expect(row).toHaveCount(1)
    await row.getByRole('textbox').fill(CUSTOMER.loansCompany)
    await page
      .getByRole('button', { name: /Save|Update/ })
      .first()
      .click()
    await expect(dialog(page)).toContainText('update the client numbers')
    await confirmDialog(page, 'Yes, Proceed!')
    await expect(dialog(page)).toBeVisible()
    await confirmDialog(page, 'OK')
    await expectAppReadable(page)

    await page.getByLabel('Search by contract code').fill(drop.code)
    const doomed = page.getByTestId('item-row').filter({ hasText: drop.code })
    await expect(doomed).toHaveCount(1)
    await doomed.getByRole('button', { name: /Delete|Remove/ }).click()
    await expect(dialog(page)).toContainText('This action can not be undone')
    await confirmDialog(page, 'Yes, Proceed!')
    await confirmDialog(page, 'OK')
    expect((await api.get('/api/v1/off-balance-sheet-items', { search: drop.code })).body.data).toHaveLength(
      0,
    )
    await api.dispose()
    void uniqueName
  })
})
