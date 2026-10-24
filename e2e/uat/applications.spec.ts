import { expect, test, type Page } from '@playwright/test'
import { Api } from './support/api'
import { authFile } from './support/auth'
import { CUSTOMER } from './support/env'
import { application, createApplication, nextPoolLoan, profile } from './support/data'
import {
  confirmDialog,
  dialog,
  expectDialogText,
  fillProfile,
  rowMenu,
  toasts,
  today,
  unique,
  uniqueAmount,
} from './support/ui'

test.use({ storageState: authFile('officer') })

const money = (n: string) => Number(n).toLocaleString('en-US')
/** The visible box of the money input (the named one next to it is hidden). */
const amountInput = (page: Page) => page.locator('input[name="amount"] >> xpath=preceding-sibling::input')

/** The row of the CAP list for a reference (the list is filtered by the search box first). */
async function findRow(page: Page, reference: string) {
  await page.goto('/applications')
  await page.getByPlaceholder('search...').fill(reference)
  const row = page.locator('div.group', { hasText: reference })
  await expect(row).toHaveCount(1)
  return row
}

/** Fill the "Loan Details" section of the CAP form. */
async function fillLoan(
  page: Page,
  loan: { amount: string; type?: string; purpose?: string; term?: string; period?: string },
) {
  await amountInput(page).fill(loan.amount)
  await page.locator('#cap-type').selectOption(loan.type ?? '2')
  await page.locator('#cap-term').fill(loan.term ?? '12')
  await page.getByLabel('Term period').selectOption(loan.period ?? 'Month')
  await page.locator('#cap-purpose').selectOption(loan.purpose ?? '1')
  await page.locator('#cap-branch').selectOption('001')
}

test.describe('UAT-06: create a loan application', () => {
  test('a borrower is found, +New CAP is opened and the application is saved with a success message', async ({
    page,
  }) => {
    const amount = uniqueAmount()
    await page.goto('/profiles')
    await page.getByPlaceholder('Search by name, client no, FCS no...').fill(CUSTOMER.main)
    await page.getByRole('link', { name: 'Okello James Peter' }).click()
    await page.getByRole('link', { name: '+ New Cap' }).click()
    await expect(page).toHaveURL(/\/applications\/create\/9100001/)
    await fillLoan(page, { amount })
    await page.getByRole('button', { name: 'Proceed' }).click()
    await expect(dialog(page)).toContainText('Application Created Successfully')
    await confirmDialog(page, 'OK')
    await expect(page).toHaveURL(/\/applications\/show\/\d+/)
    await expect(page.getByText(`UGX ${money(amount)}`).first()).toBeVisible()
    await expect(page.getByText('Pending').first()).toBeVisible()
    await expect(page.getByText(/KCB\/CAP\/\d{6}\/\d{6}/).first()).toBeVisible()

    // the same application again is refused as a duplicate and nothing is saved
    await page.goto(`/applications/create/${CUSTOMER.main}`)
    await fillLoan(page, { amount })
    await page.getByRole('button', { name: 'Proceed' }).click()
    await expect(dialog(page)).toContainText('Duplicate credit application!')
    await confirmDialog(page, 'OK')
    const api = await Api.as('officer')
    const list = await api.get('/api/v1/applications', { search: CUSTOMER.main })
    expect(list.body.data.filter((a: any) => a.Amount === amount)).toHaveLength(1)
    await api.dispose()
  })

  test('the mandatory loan fields are marked and nothing is saved when they are empty', async ({ page }) => {
    await page.goto(`/applications/create/${CUSTOMER.main}`)
    await amountInput(page).fill('1000000')
    await page.getByRole('button', { name: 'Proceed' }).click()
    await expect(toasts(page).filter({ hasText: 'Kindly check inputs with a red border' })).toBeVisible()
    await expect(page.locator('#cap-type')).toHaveClass(/is-invalid/)
    await expect(page.locator('#cap-branch')).toHaveClass(/is-invalid/)
    await expect(page).toHaveURL(/\/applications\/create\//)
  })

  test('a non-existing customer is captured from the dashboard and then given a CAP', async ({ page }) => {
    const id = unique()
    const nin = `CMUAT${Date.now().toString().slice(-9)}`
    const clientNumber = `UATNEC${id}`.slice(0, 15)
    await page.goto('/home')
    const cap = page.locator('div.shadow-md', { hasText: 'Credit Applications' }).first()
    await cap.getByRole('button', { name: 'More' }).click()
    await page.getByRole('menuitem', { name: 'Non Existing Customer' }).click()
    await page.locator('#nec-class').selectOption('0')
    await page.locator('#nec-name').fill('Uatsurname Uatforename')
    await page.locator('#nec-nin').fill(nin)
    await page.locator('#nec-cn').fill(clientNumber)
    await page.getByRole('button', { name: 'PROCEED' }).click()
    // the confirmation asks the user to tick that IT confirmed the account does not exist
    await expect(dialog(page)).toContainText('non existing customer')
    await confirmDialog(page, 'Proceed')
    await expect(dialog(page)).toContainText('Please confirm the existence of the account')
    await page.locator('.swal2-checkbox input').check()
    await confirmDialog(page, 'Proceed')
    await expect(page).toHaveURL(new RegExp(`/applications/create/${clientNumber}`))
    // the page must be readable by assistive technology again once the dialogs are gone (it stayed aria-hidden before the fix)
    await expect(page.locator('#app')).not.toHaveAttribute('aria-hidden', 'true')
    // the placeholder profile is incomplete: it must be completed before the CAP is saved
    await page.getByRole('button', { name: 'Proceed' }).click()
    await expect(toasts(page).filter({ hasText: 'Kindly check inputs with a red border' })).toBeVisible()
    await fillProfile(page)
    await fillLoan(page, { amount: uniqueAmount() })
    await page.getByRole('button', { name: 'Proceed' }).click()
    await expect(dialog(page)).toContainText('Application Created Successfully')
    await confirmDialog(page, 'OK')
    await expect(page).toHaveURL(/\/applications\/show\/\d+/)
    // the same NIN is refused the second time
    const api = await Api.as('officer')
    const again = await api.post('/api/v1/non-existing-customers', {
      classification: 0,
      name: 'Uatsurname Other',
      nin,
      clientNumber: `${clientNumber}B`.slice(0, 15),
    })
    expect(again.status).toBe(409)
    expect(JSON.stringify(again.body)).toContain('same NIN already exists')
    await api.dispose()
  })
})

test.describe('UAT-07: edit a pending application', () => {
  test('the row menu opens Edit Loan, the loan is changed and saved', async ({ page }) => {
    const api = await Api.as('officer')
    const created = await createApplication(api, { clientNumber: CUSTOMER.main })
    const row = await findRow(page, created.creditApplicationReference)
    await rowMenu(page, row, 'Edit Loan')
    await expect(page).toHaveURL(new RegExp(`/applications/edit/${created.id}`))
    const newAmount = uniqueAmount()
    await amountInput(page).fill(newAmount)
    await page.locator('#cap-purpose').selectOption('2')
    await page.getByRole('button', { name: 'Proceed' }).click()
    await expect(dialog(page)).toContainText('Application Created Successfully')
    await confirmDialog(page, 'OK')
    await expect(page).toHaveURL(new RegExp(`/applications/show/${created.id}`))
    const saved = await application(api, created.id)
    expect(saved.Amount).toBe(newAmount)
    expect(saved.loanPurpose).toBe('2')
    expect(saved.creditApplicationStatus).toBe('2')
    await api.dispose()
  })

  test('an application that is no longer pending cannot be edited', async ({ page }) => {
    const officer = await Api.as('officer')
    const approver = await Api.as('approver')
    const created = await createApplication(officer, { clientNumber: CUSTOMER.spare[0] })
    await approver.must(
      approver.post(`/api/v1/applications/${created.id}/decision`, {
        creditApplicationStatus: '0',
        amount: created.Amount,
        term: '12',
      }),
      'approve',
    )
    await page.goto(`/applications/edit/${created.id}`)
    await expectDialogText(page, 'You can only edit pending applications')
    const direct = await officer.put(`/api/v1/applications/${created.id}`, {
      creditApplicationDate: today(),
      amount: '1000',
      currency: 'UGX',
      CreditAccountLoanProductType: '2',
      loanPurpose: '1',
      branch: '001',
      Term: '12',
      Term_Period: 'Month',
    })
    expect(direct.status).toBe(409)
    await officer.dispose()
    await approver.dispose()
  })

  test('a user without Edit Applications gets no Edit Loan item and the API refuses', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile('readonly') })
    const page = await ctx.newPage()
    const officer = await Api.as('officer')
    const created = await createApplication(officer, { clientNumber: CUSTOMER.spare[1] })
    await page.goto(`/applications/edit/${created.id}`)
    await expect(page).toHaveURL(/\/errors\/403/)
    const readonly = await Api.as('readonly')
    expect((await readonly.put(`/api/v1/applications/${created.id}`, {})).status).toBe(403)
    await readonly.dispose()
    await officer.dispose()
    await ctx.close()
  })
})

test.describe('UAT-17 and UAT-18: approve and reject', () => {
  test.use({ storageState: authFile('approver') })

  test('UAT-17 an application is approved with a loan account number', async ({ page }) => {
    const officer = await Api.as('officer')
    const approver = await Api.as('approver')
    const created = await createApplication(officer, { clientNumber: CUSTOMER.spare[2] })
    const loan = await nextPoolLoan(await Api.as('crb'))
    const row = await findRow(page, created.creditApplicationReference)
    await rowMenu(page, row, 'Approve Loan')
    await expect(page).toHaveURL(new RegExp(`/applications/change-status/${created.id}`))
    await page.getByLabel('Application Status').selectOption('0')
    await page.getByLabel(/Loan Account Number/).fill(loan)
    await page.getByRole('button', { name: 'Update Application Status' }).click()
    await expect(dialog(page)).toContainText('Loan Application Approved Successfully')
    await confirmDialog(page, 'OK')
    await expect(page).toHaveURL(/\/applications$/)
    const saved = await application(approver, created.id)
    expect(saved.creditApplicationStatus).toBe('0')
    expect(saved.approval.contractCode).toBe(loan)
    expect(saved.approval.createdby).toBe('uat.approver@kcb.test')
    expect(saved.creditAmountApproved).toBe(Number(created.Amount))

    // the same loan cannot approve a second application
    const second = await createApplication(officer, { clientNumber: CUSTOMER.spare[2] })
    await page.goto(`/applications/change-status/${second.id}`)
    await page.getByLabel('Application Status').selectOption('0')
    await page.getByLabel(/Loan Account Number/).fill(loan)
    await page.getByRole('button', { name: 'Update Application Status' }).click()
    await expect(dialog(page)).toContainText(
      `Loan Account ${loan} has already been used to approve an application`,
    )
    await confirmDialog(page, 'OK')
    expect((await application(approver, second.id)).creditApplicationStatus).toBe('2')
    await officer.dispose()
    await approver.dispose()
  })

  test('UAT-17 an application can be approved before the loan exists, and an unknown loan number is refused', async ({
    page,
  }) => {
    const officer = await Api.as('officer')
    const approver = await Api.as('approver')
    const created = await createApplication(officer, { clientNumber: CUSTOMER.spare[3] })
    await page.goto(`/applications/change-status/${created.id}`)
    await page.getByLabel('Application Status').selectOption('0')
    await page.getByLabel(/Loan Account Number/).fill('NOSUCHLOAN1')
    await page.getByRole('button', { name: 'Update Application Status' }).click()
    await expect(dialog(page)).toContainText('Loan account NOSUCHLOAN1 was not found.')
    await confirmDialog(page, 'OK')
    await page.getByLabel(/Loan Account Number/).fill('')
    await page.getByRole('button', { name: 'Update Application Status' }).click()
    await expect(dialog(page)).toContainText('Loan Application Approved Successfully')
    await confirmDialog(page, 'OK')
    const saved = await application(approver, created.id)
    expect(saved.creditApplicationStatus).toBe('0')
    expect(saved.approval.contractCode).toBeFalsy()
    await officer.dispose()
    await approver.dispose()
  })

  test('UAT-18 an application is rejected with a reason from the list', async ({ page }) => {
    const officer = await Api.as('officer')
    const approver = await Api.as('approver')
    const created = await createApplication(officer, { clientNumber: CUSTOMER.spare[4] })
    const row = await findRow(page, created.creditApplicationReference)
    await rowMenu(page, row, 'Reject Loan')
    await page.getByLabel('Application Status').selectOption('5')
    await page.getByLabel(/Rejection Reason/).selectOption('3')
    await page.getByRole('button', { name: 'Update Application Status' }).click()
    await expect(dialog(page)).toContainText('Declined Successfully')
    await confirmDialog(page, 'OK')
    const saved = await application(approver, created.id)
    expect(saved.creditApplicationStatus).toBe('5')
    expect(saved.rejection.rejectionReason).toBe('3')
    expect(saved.approval).toBeNull()
    // a decided application cannot be decided again
    const again = await approver.post(`/api/v1/applications/${created.id}/decision`, {
      creditApplicationStatus: '0',
    })
    expect(again.status).toBe(409)
    // the list shows it as rejected
    await page.goto('/applications')
    await page.getByPlaceholder('search...').fill(created.creditApplicationReference)
    await expect(page.locator('div.group', { hasText: created.creditApplicationReference })).toContainText(
      'Rejected',
    )
    await officer.dispose()
    await approver.dispose()
  })

  test('UAT-18 a rejection without a reason is refused', async () => {
    const officer = await Api.as('officer')
    const approver = await Api.as('approver')
    const created = await createApplication(officer, { clientNumber: CUSTOMER.spare[5] })
    const r = await approver.post(`/api/v1/applications/${created.id}/decision`, {
      creditApplicationStatus: '5',
    })
    expect(r.status).toBe(422)
    expect(JSON.stringify(r.body)).toContain('The rejection reason field is required.')
    await officer.dispose()
    await approver.dispose()
  })

  test('the Change Status page and the decision are not available to a user without Approve/Reject Applications', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: authFile('officer') })
    const page = await ctx.newPage()
    const officer = await Api.as('officer')
    const created = await createApplication(officer, { clientNumber: CUSTOMER.spare[5] })
    await page.goto(`/applications/change-status/${created.id}`)
    await expect(page).toHaveURL(/\/errors\/403/)
    expect(
      (await officer.post(`/api/v1/applications/${created.id}/decision`, { creditApplicationStatus: '0' }))
        .status,
    ).toBe(403)
    await officer.dispose()
    await ctx.close()
  })
})
