import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { Api } from './support/api'
import { authFile } from './support/auth'
import { CUSTOMER } from './support/env'
import { application, createApplication, nextFromPool, nextPoolLoan } from './support/data'
import { buildXlsx, readXlsx } from './support/xlsx'
import { confirmDialog, dialog, expectAppReadable, uniqueAmount } from './support/ui'

const xlsxType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

test.describe('credit applications: list, filters and the detail page', () => {
  test.use({ storageState: authFile('officer') })

  test('the list is searched by client number and name and filtered by status', async ({ page }) => {
    const officer = await Api.as('officer')
    const approver = await Api.as('approver')
    const pending = await createApplication(officer, { clientNumber: CUSTOMER.spare[0] })
    const rejected = await createApplication(officer, { clientNumber: CUSTOMER.spare[0] })
    await approver.must(
      approver.post(`/api/v1/applications/${rejected.id}/decision`, {
        creditApplicationStatus: '5',
        rejectionReason: '1',
      }),
      'reject',
    )
    await page.goto('/applications')
    await page.getByPlaceholder('search...').fill(CUSTOMER.spare[0])
    const rows = page.locator('div.group')
    await expect(rows.filter({ hasText: pending.creditApplicationReference })).toHaveCount(1)
    await expect(rows.filter({ hasText: rejected.creditApplicationReference })).toHaveCount(1)

    await page.getByLabel('Filter applications').selectOption('2')
    await expect(rows.filter({ hasText: pending.creditApplicationReference })).toHaveCount(1)
    await expect(rows.filter({ hasText: rejected.creditApplicationReference })).toHaveCount(0)
    await page.getByLabel('Filter applications').selectOption('rejected')
    await expect(rows.filter({ hasText: rejected.creditApplicationReference })).toHaveCount(1)
    await expect(rows.filter({ hasText: pending.creditApplicationReference })).toHaveCount(0)
    await page.getByPlaceholder('search...').fill('Mukasa')
    await page.getByLabel('Filter applications').selectOption('')
    await expect(rows.filter({ hasText: 'Mukasa' }).first()).toBeVisible()
    await officer.dispose()
    await approver.dispose()
  })

  test('the details of an application show its loan, amount, term and status', async ({ page }) => {
    const officer = await Api.as('officer')
    const amount = uniqueAmount()
    const app = await createApplication(officer, {
      clientNumber: CUSTOMER.main,
      amount,
      term: '2',
      termPeriod: 'Year',
    })
    await page.goto(`/applications/show/${app.id}`)
    await expect(page.getByText(`UGX ${Number(amount).toLocaleString('en-US')}`).first()).toBeVisible()
    await expect(page.getByText('2 Years').first()).toBeVisible()
    await page.getByRole('button', { name: 'Show / Hide' }).click()
    await expect(page.getByRole('cell', { name: app.creditApplicationReference }).first()).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Term Loan (2)' })).toBeVisible()
    await officer.dispose()
  })

  test('a user without View All Credit Applications sees only the applications they created', async ({
    browser,
  }) => {
    const branch = await Api.as('branch')
    const mine = await createApplication(branch, { clientNumber: CUSTOMER.nakawa, branch: '002' })
    const officer = await Api.as('officer')
    const others = await createApplication(officer, { clientNumber: CUSTOMER.nakawa, branch: '002' })
    const ctx = await browser.newContext({ storageState: authFile('branch') })
    const page = await ctx.newPage()
    await page.goto('/applications')
    await page.getByPlaceholder('search...').fill(CUSTOMER.nakawa)
    await expect(page.locator('div.group', { hasText: mine.creditApplicationReference })).toHaveCount(1)
    await expect(page.locator('div.group', { hasText: others.creditApplicationReference })).toHaveCount(0)
    const list = await branch.get('/api/v1/applications', { search: CUSTOMER.nakawa })
    expect(list.body.data.map((a: any) => a.createdby)).toEqual(
      expect.arrayContaining(['uat.branch@kcb.test']),
    )
    expect(list.body.data.every((a: any) => a.createdby === 'uat.branch@kcb.test')).toBe(true)
    await ctx.close()
    await branch.dispose()
    await officer.dispose()
  })
})

test.describe('UAT-24: export loan applications', () => {
  test.use({ storageState: authFile('officer') })

  test('the pending applications are exported to an Excel workbook', async ({ page }) => {
    const officer = await Api.as('officer')
    const approver = await Api.as('approver')
    const pending = await createApplication(officer, { clientNumber: CUSTOMER.spare[1] })
    const rejected = await createApplication(officer, { clientNumber: CUSTOMER.spare[1] })
    await approver.must(
      approver.post(`/api/v1/applications/${rejected.id}/decision`, {
        creditApplicationStatus: '5',
        rejectionReason: '2',
      }),
      'reject',
    )
    await page.goto('/home')
    await page.getByRole('button', { name: 'More' }).first().click()
    await page.getByRole('menuitem', { name: 'Applications Report' }).click()
    await expect(page).toHaveURL(/\/applications\/report/)
    await page.getByLabel('Status').selectOption({ label: 'Pending' })
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download' }).click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(/^CB011CAE\d+\.xlsx$/)
    const rows = readXlsx(await readFile((await file.path()) as string))
    const text = rows.flat().join('|')
    // the Pending choice must give the pending applications, not the rejected ones
    expect(text, 'the Pending export holds the pending application').toContain(
      pending.creditApplicationReference,
    )
    expect(text, 'the Pending export does not hold the rejected application').not.toContain(
      rejected.creditApplicationReference,
    )
    await officer.dispose()
    await approver.dispose()
  })

  test('the export is limited by status, date range and branch and needs Applications Report', async ({
    page,
    browser,
  }) => {
    const officer = await Api.as('officer')
    const approver = await Api.as('approver')
    const pending = await createApplication(officer, { clientNumber: CUSTOMER.spare[2], date: '2026-10-02' })
    const approved = await createApplication(officer, { clientNumber: CUSTOMER.spare[2], date: '2026-10-03' })
    await approver.must(
      approver.post(`/api/v1/applications/${approved.id}/decision`, {
        creditApplicationStatus: '0',
        amount: approved.Amount,
        term: '12',
      }),
      'approve',
    )
    const names = async (params: Record<string, string>) => {
      const r = await officer.raw('/api/v1/applications/export', params)
      expect(r.status).toBe(200)
      return readXlsx(r.buffer).flat().join('|')
    }
    const onlyApproved = await names({ status: 'Approved', from_date: '2026-10-01', to_date: '2026-10-31' })
    expect(onlyApproved).toContain(approved.creditApplicationReference)
    expect(onlyApproved).not.toContain(pending.creditApplicationReference)
    const dateWindow = await names({ status: 'All', from_date: '2026-10-02', to_date: '2026-10-02' })
    expect(dateWindow).toContain(pending.creditApplicationReference)
    expect(dateWindow).not.toContain(approved.creditApplicationReference)
    const rows = readXlsx((await officer.raw('/api/v1/applications/export', { status: 'All' })).buffer)
    // the header keeps the spellings the bureau tools expect
    expect(rows[0].join('|')).toMatch(/amunt|credit_applicatin_date|rejectin_reasn/)

    const ctx = await browser.newContext({ storageState: authFile('readonly') })
    const denied = await ctx.newPage()
    await denied.goto('/applications/report')
    await expect(denied).toHaveURL(/\/errors\/403/)
    await ctx.close()
    void page
    await officer.dispose()
    await approver.dispose()
  })
})

test.describe('joint application and bulk approval', () => {
  test.use({ storageState: authFile('officer') })

  test('two customers are chosen on the dashboard and one application is saved for each under a joint account number', async ({
    page,
  }) => {
    const api = await Api.as('officer')
    const amountA = uniqueAmount()
    const amountB = uniqueAmount()
    await page.goto('/home')
    await page
      .locator('div.shadow-md', { hasText: 'Credit Applications' })
      .first()
      .getByRole('button', { name: 'More' })
      .click()
    await page.getByRole('menuitem', { name: 'Joint Application' }).click()
    const pickBox = page.getByPlaceholder('search customer by name')
    await pickBox.fill('Nantongo Judith')
    await page.getByRole('button', { name: /Nantongo Judith/ }).click()
    await pickBox.fill('Ssemwogerere Paul')
    await page.getByRole('button', { name: /Ssemwogerere Paul/ }).click()
    await page.getByRole('button', { name: 'PROCEED' }).click()
    await expect(page).toHaveURL(/\/applications\/joint\/create\//)
    for (const [i, amount] of [amountA, amountB].entries()) {
      await page.locator(`#cap${i}-type`).selectOption('2')
      await page.locator(`#cap${i}-term`).fill('12')
      await page.locator('select[aria-label="Term period"]').nth(i).selectOption('Month')
      await page.locator(`#cap${i}-purpose`).selectOption('1')
      await page.locator(`#cap${i}-branch`).selectOption('001')
      await page.locator('input[name="amount"] >> xpath=preceding-sibling::input').nth(i).fill(amount)
    }
    await page.getByRole('button', { name: 'Proceed' }).click()
    await expect(dialog(page)).toContainText('Joint Application Saved Successfully')
    await confirmDialog(page, 'OK')
    await expectAppReadable(page)
    await expect(page).toHaveURL(/\/applications$/)
    const joint = await api.get('/api/v1/applications', { queryFilter: 'joint' })
    const mine = joint.body.data.filter((a: any) => a.Amount === amountA || a.Amount === amountB)
    expect(mine).toHaveLength(2)
    expect(mine[0].jointAccountNumber).toBe(mine[1].jointAccountNumber)
    expect(mine[0].jointAccountNumber).toMatch(/^\d{11}$/)
    // fewer than two customers are refused
    await page.goto('/home')
    await page
      .locator('div.shadow-md', { hasText: 'Credit Applications' })
      .first()
      .getByRole('button', { name: 'More' })
      .click()
    await page.getByRole('menuitem', { name: 'Joint Application' }).click()
    await page.getByRole('button', { name: 'PROCEED' }).click()
    await expect(dialog(page)).toContainText('Select at least 2 customers to proceed!')
    await confirmDialog(page, 'OK')
    await api.dispose()
  })

  test('a joint application with a duplicate borrower saves nothing at all', async () => {
    const api = await Api.as('officer')
    const amountA = uniqueAmount()
    const amountB = String(Number(amountA) + 1)
    const first = await createApplication(api, { clientNumber: CUSTOMER.spare[3], amount: amountA })
    const dup = await api.post('/api/v1/applications/joint', {
      borrowers: [
        {
          clientNumber: CUSTOMER.spare[3],
          creditApplicationDate: first.creditApplicationDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
          amount: amountA,
          currency: 'UGX',
          CreditAccountLoanProductType: '2',
          loanPurpose: '1',
          branch: '001',
          Term: '12',
          Term_Period: 'Month',
        },
        {
          clientNumber: CUSTOMER.spare[4],
          creditApplicationDate: first.creditApplicationDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
          amount: amountB,
          currency: 'UGX',
          CreditAccountLoanProductType: '2',
          loanPurpose: '1',
          branch: '001',
          Term: '12',
          Term_Period: 'Month',
        },
      ],
    })
    expect(dup.status).toBe(409)
    const list = await api.get('/api/v1/applications', { search: CUSTOMER.spare[4] })
    expect(list.body.data.filter((a: any) => a.Amount === amountB)).toHaveLength(0)
    await api.dispose()
  })

  test('a list of references is uploaded and decided together: one approved, one rejected, one left pending', async ({
    page,
  }) => {
    const officer = await Api.as('officer')
    const approver = await Api.as('approver')
    const a = await createApplication(officer, { clientNumber: CUSTOMER.spare[0] })
    const b = await createApplication(officer, { clientNumber: CUSTOMER.spare[1] })
    const c = await createApplication(officer, { clientNumber: CUSTOMER.spare[2] })
    const loan = await nextPoolLoan(await Api.as('crb'))
    const ctx = await page
      .context()
      .browser()!
      .newContext({ storageState: authFile('approver') })
    const bulk = await ctx.newPage()
    await bulk.goto('/applications/bulk-approve')
    await bulk.getByRole('button', { name: 'Upload New List' }).click()
    await bulk.locator('input[type="file"]').setInputFiles({
      name: 'list.xlsx',
      mimeType: xlsxType,
      buffer: buildXlsx([
        ['creditApplicationReference'],
        [a.creditApplicationReference],
        [b.creditApplicationReference],
        [c.creditApplicationReference],
        ['KCB/CAP/000000/999999'],
      ]),
    })
    await bulk.getByRole('button', { name: 'UPLOAD' }).click()
    await expect(dialog(bulk)).toContainText('Record Uploaded Successfully')
    await expect(dialog(bulk)).toContainText('KCB/CAP/000000/999999')
    await confirmDialog(bulk, 'OK')
    await expectAppReadable(bulk)
    for (const ref of [a, b, c]) await expect(bulk.getByText(ref.creditApplicationReference)).toBeVisible()

    await bulk.getByLabel(`Status of ${a.creditApplicationReference}`).selectOption('0')
    await bulk.getByLabel(`Loan account of ${a.creditApplicationReference}`).fill(loan)
    await bulk.getByLabel(`Status of ${b.creditApplicationReference}`).selectOption('5')
    await bulk.getByLabel(`Rejection reason of ${b.creditApplicationReference}`).selectOption('4')
    await bulk.getByRole('button', { name: 'SAVE CHANGES' }).click()
    await expect(dialog(bulk)).toBeVisible()
    await confirmDialog(bulk, 'OK')
    expect((await application(approver, a.id)).creditApplicationStatus).toBe('0')
    expect((await application(approver, a.id)).approval.contractCode).toBe(loan)
    expect((await application(approver, b.id)).creditApplicationStatus).toBe('5')
    expect((await application(approver, b.id)).rejection.rejectionReason).toBe('4')
    expect((await application(approver, c.id)).creditApplicationStatus).toBe('2')

    // the downloadable list holds the same three applications
    const download = bulk.waitForEvent('download')
    await bulk.getByRole('button', { name: 'Download List' }).click()
    const file = await download
    const text = readXlsx(await readFile((await file.path()) as string))
      .flat()
      .join('|')
    expect(text).toContain(c.creditApplicationReference)
    await ctx.close()
    await officer.dispose()
    await approver.dispose()
  })

  test('bulk approval is closed to a user without Approve/Reject Applications', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile('readonly') })
    const page = await ctx.newPage()
    await page.goto('/applications/bulk-approve')
    await expect(page).toHaveURL(/\/errors\/403/)
    const api = await Api.as('readonly')
    expect((await api.get('/api/v1/applications/pending')).status).toBe(403)
    expect((await api.post('/api/v1/applications/bulk-approve', { items: [] })).status).toBe(403)
    await api.dispose()
    await ctx.close()
  })
})

test.describe('profiles: deletion request of a whole profile', () => {
  test.use({ storageState: authFile('officer') })

  test('a profile is requested for deletion as a whole and the checker removes the customer', async ({
    page,
  }) => {
    const officer = await Api.as('officer')
    const checker = await Api.as('checker')
    const crb = await Api.as('crb')
    const victim = await nextFromPool(crb, 'CUSTDEL')
    await page.goto('/profiles')
    await page.getByPlaceholder('Search by name, client no, FCS no...').fill(victim.code)
    await expect(page.getByRole('button', { name: /Request deletion of/ })).toHaveCount(1)
    await page.getByRole('button', { name: /Request deletion of/ }).click()
    // the first question: a customer with one record can only be removed as a whole profile
    await expect(dialog(page)).toContainText('Delete Customer Profile')
    await expect(page.getByRole('radio', { name: /Delete entire profile/ })).toBeChecked()
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(dialog(page)).toContainText('permanently delete the entire profile')
    await page.locator('.swal2-textarea').fill('Captured by mistake')
    await page.getByRole('button', { name: 'Yes, Submit Request' }).click()
    await expect(dialog(page)).toBeVisible()
    await confirmDialog(page, 'OK')
    await expect(page.getByRole('img', { name: 'Deletion requested' })).toBeVisible()
    await expectAppReadable(page)

    const requests = await officer.get('/api/v1/deletion-requests', { search: String(victim.id), status: 0 })
    const request = requests.body.data.find(
      (r: any) => r.table_name === 'customers' && r.record_id === victim.id,
    )
    expect(request.deletion_scope).toBe('customer_full')
    // still there until the checker decides; asking again is refused
    expect((await officer.get('/api/v1/profiles', { search: victim.code })).body.data).toHaveLength(1)
    expect(
      (
        await officer.post('/api/v1/deletion-requests', {
          record_id: victim.id,
          table_name: 'customers',
          deletion_scope: 'customer_full',
          comment: 'again',
        })
      ).status,
    ).toBe(409)
    expect((await checker.post(`/api/v1/deletion-requests/${request.id}/approve`, {})).status).toBe(200)
    expect((await officer.get('/api/v1/profiles', { search: victim.code })).body.data).toHaveLength(0)
    await officer.dispose()
    await checker.dispose()
    await crb.dispose()
  })
})
