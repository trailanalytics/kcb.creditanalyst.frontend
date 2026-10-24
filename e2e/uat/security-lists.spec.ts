import { expect, test } from '@playwright/test'
import { Api } from './support/api'
import { authFile } from './support/auth'
import { CUSTOMER } from './support/env'
import { createApplication, createCollateral, createGuarantor, createStakeholder } from './support/data'
import { confirmDialog, dialog, expectAppReadable, modal, money, toasts, unique } from './support/ui'

test.use({ storageState: authFile('officer') })

test.describe('UAT-20, UAT-25 and UAT-27: manage collateral, guarantors and stakeholders from their lists', () => {
  test('UAT-20 a collateral of the CMC list is edited and saved', async ({ page }) => {
    const description = `Printing press, edited ${unique()}`
    await page.goto('/home')
    await page.getByRole('link', { name: 'Manage Collateral' }).click()
    await expect(page).toHaveURL(/\/cmc-list/)
    await page.getByLabel('Search collateral').fill('UAT-CMC-0004')
    await expect(page.getByRole('row', { name: /UAT-CMC-0004/ })).toHaveCount(1)
    await page.getByRole('button', { name: 'Edit UAT-CMC-0004' }).click()
    const form = modal(page)
    await expect(form.locator('#cm-description')).toHaveValue('Printing press machinery')
    await form.locator('#cm-description').fill(description)
    await money(form, 'CollateralOpenMarketValue').fill('130000000')
    await form.getByRole('button', { name: 'Save' }).click()
    await expect(toasts(page).filter({ hasText: 'Collateral Saved Successfully' })).toBeVisible()
    await expectAppReadable(page)
    await expect(page.getByRole('row', { name: /UAT-CMC-0004/ })).toContainText('130,000,000')
    const api = await Api.as('officer')
    const rows = await api.get('/api/v1/collaterals', { search: 'UAT-CMC-0004' })
    expect(rows.body.data[0].CollateralDescription).toBe(description)
    expect(rows.body.data[0].CollateralOpenMarketValue).toBe('130000000')
    await api.dispose()
  })

  test('UAT-20 the mass instrument map changes every collateral of one instrument', async ({ page }) => {
    const api = await Api.as('officer')
    const app = await createApplication(api, { clientNumber: CUSTOMER.spare[0] })
    const made = await createCollateral(api, app.creditApplicationReference)
    // give it an instrument nobody else uses, so the map touches this record only
    const odd = 'Chattels Agreement'
    await api.must(
      api.put(`/api/v1/collaterals/${made.id}`, {
        CollateralType: '1',
        CollateralCurrency: 'UGX',
        CollateralForcedSaleValue: '4000000',
        CollateralOpenMarketValue: '5000000',
        valuationDate: '2026-10-01',
        expiryDate: '2030-12-31',
        InstrumentofClaim: odd,
        CollateralDescription: made.CollateralDescription,
      }),
      'set instrument',
    )
    await page.goto('/cmc-list')
    await page.getByRole('button', { name: 'Map Instruments Of Claim' }).click()
    const form = modal(page)
    await form.locator('#map-from').fill(odd)
    await form.locator('#map-to').selectOption('Insurance Policies')
    await form.getByRole('button', { name: 'Apply Changes' }).click()
    await expect(toasts(page).first()).toBeVisible()
    const after = await api.get('/api/v1/collaterals', { search: made.CollateralReferenceNumber })
    expect(after.body.data[0].InstrumentofClaim).toBe('Insurance Policies')
    // map nothing: the server says so
    const none = await api.post('/api/v1/collaterals/map-instruments', {
      change_from: `No such instrument ${unique()}`,
      change_to: 'Debentures',
    })
    expect(none.ok).toBe(true)
    expect(JSON.stringify(none.body)).toMatch(/0|No/)
    await api.dispose()
  })

  test('UAT-25 a guarantor of the CCG list is edited and saved', async ({ page }) => {
    const value = String(10_000_000 + Math.floor(Math.random() * 1_000_000))
    await page.goto('/home')
    await page.getByRole('link', { name: 'Manage Borrower Guarantor' }).click()
    await expect(page).toHaveURL(/\/ccg-list/)
    await page.getByLabel('Search guarantors').fill('Kiggundu')
    await expect(page.getByRole('row', { name: /Atim Grace/ })).toHaveCount(1)
    await page.getByRole('button', { name: `Edit guarantor ${CUSTOMER.stakeholderPerson}` }).click()
    const form = modal(page)
    await expect(form.getByLabel('Client number')).toHaveValue(CUSTOMER.stakeholderPerson)
    await form.locator('input[name="ValueOfGuarantorsCollateral"]').fill(value)
    await form.getByRole('button', { name: 'Save Guarantor' }).click()
    await expect(toasts(page).filter({ hasText: 'Guarantor Saved Successfully' })).toBeVisible()
    await expectAppReadable(page)
    await expect(page.getByRole('row', { name: /Atim Grace/ })).toContainText(
      Number(value).toLocaleString('en-US'),
    )
    const api = await Api.as('officer')
    const rows = await api.get('/api/v1/guarantors', { search: 'Kiggundu' })
    expect(
      rows.body.data.find((g: any) => g.GuarantorClientNumber === CUSTOMER.stakeholderPerson)
        .valueOfGuarantorCollateral,
    ).toBe(value)
    await api.dispose()
  })

  test('UAT-27 a stakeholder of the BS list is edited and saved', async ({ page }) => {
    const percentage = String(10 + Math.floor(Math.random() * 30))
    await page.goto('/home')
    await page
      .getByRole('link', { name: 'Manage Borrower Stakeholder' })
      .click()
      .catch(async () => page.goto('/bs-list'))
    await page.goto('/bs-list')
    await page.getByLabel('Search stakeholders').fill('Ssekandi')
    await expect(page.getByRole('row', { name: /Ssekandi David/ })).toHaveCount(1)
    await page.getByRole('button', { name: `Edit stakeholder ${CUSTOMER.jointPartner}` }).click()
    const form = modal(page)
    await expect(form.getByLabel('Client number')).toHaveValue(CUSTOMER.jointPartner)
    await form.locator('input[name="ShareholderPercentage"]').fill(percentage)
    await form.getByRole('button', { name: 'Save' }).click()
    await expect(toasts(page).filter({ hasText: 'Stakeholder Saved Successfully' })).toBeVisible()
    await expectAppReadable(page)
    await expect(page.getByRole('row', { name: /Ssekandi David/ })).toContainText(`${percentage}%`)
    const api = await Api.as('officer')
    const rows = await api.get('/api/v1/stakeholders', { search: 'Ssekandi' })
    expect(
      rows.body.data.find((s: any) => s.StakeholderClientNumber === CUSTOMER.jointPartner)
        .ShareholderPercentage,
    ).toBe(percentage)
    await api.dispose()
  })

  test('the lists are refused to a user without the Manage permissions and edit is hidden without Update', async ({
    browser,
  }) => {
    const noaccess = await browser.newContext({ storageState: authFile('noaccess') })
    const page = await noaccess.newPage()
    for (const path of ['/cmc-list', '/ccg-list', '/bs-list']) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/errors\/403/)
    }
    const api = await Api.as('noaccess')
    for (const path of ['/api/v1/collaterals', '/api/v1/guarantors', '/api/v1/stakeholders'])
      expect((await api.get(path)).status).toBe(403)
    await api.dispose()
    await noaccess.close()

    const readonly = await browser.newContext({ storageState: authFile('readonly') })
    const view = await readonly.newPage()
    await view.goto('/cmc-list')
    await view.getByLabel('Search collateral').fill('UAT-CMC-0001')
    await expect(view.getByRole('row', { name: /UAT-CMC-0001/ })).toHaveCount(1)
    await expect(view.getByRole('button', { name: 'Edit UAT-CMC-0001' })).toHaveCount(0)
    await expect(view.getByRole('button', { name: 'Map Instruments Of Claim' })).toHaveCount(0)
    await expect(view.getByRole('button', { name: /Request deletion/ })).toHaveCount(0)
    await readonly.close()
  })
})

/** The request of a record that was just asked to be deleted, read through the API as the user who asked. */
async function requestOf(api: Api, table: string, recordId: number) {
  const r = await api.get('/api/v1/deletion-requests', { search: String(recordId), status: 0 })
  return (r.body?.data ?? []).find((x: any) => x.table_name === table && x.record_id === recordId)
}

/** The maker-checker flow of the delete buttons: reason, request, flag, other user decides on the Requests page. */
test.describe('UAT-19, UAT-21, UAT-26 and UAT-28: deleting needs a request and a second user', () => {
  test('UAT-21 a collateral is not deleted by the click: the request is approved by the checker and only then it is gone', async ({
    page,
    browser,
  }) => {
    const maker = await Api.as('officer')
    const checker = await Api.as('checker')
    const app = await createApplication(maker, { clientNumber: CUSTOMER.spare[1] })
    const collateral = await createCollateral(maker, app.creditApplicationReference)
    const ref = collateral.CollateralReferenceNumber

    await page.goto('/cmc-list')
    await page.getByLabel('Search collateral').fill(ref)
    await page.getByRole('button', { name: `Request deletion of ${ref}` }).click()
    // an empty reason is refused and the question is asked again
    await expect(dialog(page)).toContainText('You are about to submit a request to delete this Collateral!')
    await confirmDialog(page, 'Yes, Proceed!')
    await expect(
      toasts(page).filter({ hasText: 'The reason for your request to delete this record is required!' }),
    ).toBeVisible()
    await page.locator('.swal2-textarea').fill('Entered against the wrong borrower')
    await confirmDialog(page, 'Yes, Proceed!')
    await expect(dialog(page)).toContainText(/request/i)
    await confirmDialog(page, 'OK')
    await expect(page.getByRole('img', { name: 'Deletion requested' })).toBeVisible()
    await expectAppReadable(page)

    // nothing was deleted
    expect((await maker.get('/api/v1/collaterals', { search: ref })).body.data).toHaveLength(1)
    const request = await requestOf(maker, 'collaterals', collateral.id)
    expect(request.request_comment).toBe('Entered against the wrong borrower')
    expect(request.requested_by_name).toMatch(/Olivia/)

    // the maker sees the request on the Requests page but has nothing to press
    await page.goto('/requests')
    await page.getByTestId('search').fill(request.request_id)
    const own = page.getByTestId(`request-${request.id}`)
    await expect(own).toContainText('Pending Approval')
    await expect(own.getByTestId('waiting')).toBeVisible()
    await expect(own.getByTestId('approve')).toHaveCount(0)
    // a second request for the same record is refused
    const again = await maker.post('/api/v1/deletion-requests', {
      record_id: collateral.id,
      table_name: 'collaterals',
      comment: 'again',
    })
    expect(again.status).toBe(409)

    // the checker approves it
    const ctx = await browser.newContext({ storageState: authFile('checker') })
    const checkerPage = await ctx.newPage()
    await checkerPage.goto('/requests')
    await checkerPage.getByTestId('search').fill(request.request_id)
    const row = checkerPage.getByTestId(`request-${request.id}`)
    await expect(row).toContainText(ref)
    await row.getByTestId('approve').click()
    await confirmDialog(checkerPage, 'Yes, Proceed!')
    await expect(dialog(checkerPage)).toContainText('Request Approved Successfully!')
    await confirmDialog(checkerPage, 'OK')
    await expectAppReadable(checkerPage)
    expect((await maker.get('/api/v1/collaterals', { search: ref })).body.data).toHaveLength(0)
    const decided = await checker.get('/api/v1/deletion-requests', { search: request.request_id, status: 1 })
    expect(decided.body.data.find((x: any) => x.id === request.id).actioned_by_name).toMatch(/Chidi/)
    await ctx.close()
    await maker.dispose()
    await checker.dispose()
  })

  test('UAT-21 a request that the checker declines leaves the record in place', async ({ browser }) => {
    const maker = await Api.as('officer')
    const checker = await Api.as('checker')
    const app = await createApplication(maker, { clientNumber: CUSTOMER.spare[2] })
    const collateral = await createCollateral(maker, app.creditApplicationReference)
    await maker.must(
      maker.post('/api/v1/deletion-requests', {
        record_id: collateral.id,
        table_name: 'collaterals',
        comment: 'Please remove',
      }),
      'request',
    )
    const request = await requestOf(maker, 'collaterals', collateral.id)
    const ctx = await browser.newContext({ storageState: authFile('checker') })
    const page = await ctx.newPage()
    await page.goto('/requests')
    await page.getByTestId('search').fill(request.request_id)
    await page.getByTestId(`request-${request.id}`).getByTestId('cancel').click()
    await confirmDialog(page, 'Yes, Proceed!')
    await expect(dialog(page)).toContainText('Request Canceled Successfully!')
    await confirmDialog(page, 'OK')
    expect(
      (await maker.get('/api/v1/collaterals', { search: collateral.CollateralReferenceNumber })).body.data,
    ).toHaveLength(1)
    const canceled = await checker.get('/api/v1/deletion-requests', { search: request.request_id, status: 2 })
    expect(canceled.body.data.map((x: any) => x.id)).toContain(request.id)
    // and the record can be asked for again
    const second = await maker.post('/api/v1/deletion-requests', {
      record_id: collateral.id,
      table_name: 'collaterals',
      comment: 'second attempt',
    })
    expect(second.status).toBe(201)
    await ctx.close()
    await maker.dispose()
    await checker.dispose()
  })

  test('UAT-26 a guarantor is requested for deletion from the CCG list and removed by the checker', async ({
    page,
  }) => {
    const maker = await Api.as('officer')
    const checker = await Api.as('checker')
    const app = await createApplication(maker, { clientNumber: CUSTOMER.spare[3] })
    const guarantor = await createGuarantor(maker, app.creditApplicationReference)
    await page.goto('/ccg-list')
    await page.getByLabel('Search guarantors').fill(guarantor.GuarantorClientNumber)
    await page
      .getByRole('button', { name: `Request deletion of guarantor ${guarantor.GuarantorClientNumber}` })
      .click()
    await page.locator('.swal2-textarea').fill('Guarantor withdrew')
    await confirmDialog(page, 'Yes, Proceed!')
    await confirmDialog(page, 'OK')
    await expect(page.getByRole('img', { name: 'Deletion requested' })).toBeVisible()
    const request = await requestOf(maker, 'borrower_guarantors', guarantor.id)
    const ok = await checker.post(`/api/v1/deletion-requests/${request.id}/approve`, {})
    expect(ok.status).toBe(200)
    expect(ok.body.message).toBe('Request Approved Successfully!')
    expect(
      (await maker.get('/api/v1/guarantors', { search: guarantor.GuarantorClientNumber })).body.data,
    ).toHaveLength(0)
    await maker.dispose()
    await checker.dispose()
  })

  test('UAT-28 a stakeholder is requested for deletion from the BS list and removed by the checker', async ({
    page,
  }) => {
    const maker = await Api.as('officer')
    const checker = await Api.as('checker')
    const app = await createApplication(maker, { clientNumber: CUSTOMER.company })
    const stakeholder = await createStakeholder(maker, app.creditApplicationReference)
    await page.goto('/bs-list')
    await page.getByLabel('Search stakeholders').fill(stakeholder.StakeholderClientNumber)
    await page
      .getByRole('button', { name: `Request deletion of stakeholder ${stakeholder.StakeholderClientNumber}` })
      .click()
    await page.locator('.swal2-textarea').fill('Shareholder sold the shares')
    await confirmDialog(page, 'Yes, Proceed!')
    await confirmDialog(page, 'OK')
    await expect(page.getByRole('img', { name: 'Deletion requested' })).toBeVisible()
    const request = await requestOf(maker, 'borrower_stakeholders', stakeholder.id)
    expect((await checker.post(`/api/v1/deletion-requests/${request.id}/approve`, {})).status).toBe(200)
    expect(
      (await maker.get('/api/v1/stakeholders', { search: stakeholder.StakeholderClientNumber })).body.data,
    ).toHaveLength(0)
    await maker.dispose()
    await checker.dispose()
  })

  test('UAT-19 a loan application is requested for deletion from the CAP list and removed by the checker', async ({
    page,
  }) => {
    const maker = await Api.as('officer')
    const checker = await Api.as('checker')
    const app = await createApplication(maker, { clientNumber: CUSTOMER.spare[4] })
    await page.goto('/applications')
    await page.getByPlaceholder('search...').fill(app.creditApplicationReference)
    const row = page.locator('div.group', { hasText: app.creditApplicationReference })
    await row.hover()
    await row.getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('menuitem', { name: 'Delete Loan' }).click()
    await expect(dialog(page)).toContainText(
      'You are about to submit a request to delete this Loan Application!',
    )
    await page.locator('.swal2-textarea').fill('Captured twice')
    await confirmDialog(page, 'Yes, Proceed!')
    await confirmDialog(page, 'OK')
    // the flag sits with the hover actions of the row
    await row.hover()
    await expect(row.locator('[title="This record has been requested to be deleted!"]')).toBeVisible()
    // the application is still there for everybody until the checker decides
    expect((await maker.get(`/api/v1/applications/${app.id}`)).status).toBe(200)
    const request = await requestOf(maker, 'loan_applications', app.id)
    expect((await checker.post(`/api/v1/deletion-requests/${request.id}/approve`, {})).status).toBe(200)
    expect((await maker.get(`/api/v1/applications/${app.id}`)).status).toBe(404)
    const list = await maker.get('/api/v1/applications', { search: app.creditApplicationReference })
    expect(list.body.data).toHaveLength(0)
    await maker.dispose()
    await checker.dispose()
  })

  test('the maker cannot approve or cancel their own request, whatever the permissions', async () => {
    const admin = await Api.as('superadmin') // holds every permission, including Approve Deletion Requests
    const officer = await Api.as('officer')
    const app = await createApplication(officer, { clientNumber: CUSTOMER.spare[5] })
    const collateral = await createCollateral(officer, app.creditApplicationReference)
    await admin.must(
      admin.post('/api/v1/deletion-requests', {
        record_id: collateral.id,
        table_name: 'collaterals',
        comment: 'maker is also an approver',
      }),
      'request',
    )
    const request = await requestOf(admin, 'collaterals', collateral.id)
    const approve = await admin.post(`/api/v1/deletion-requests/${request.id}/approve`, {})
    expect(approve.status).toBe(403)
    expect(JSON.stringify(approve.body)).toContain('You are not allowed to action this request!')
    const cancel = await admin.post(`/api/v1/deletion-requests/${request.id}/cancel`, {})
    expect(cancel.status).toBe(403)
    expect(
      (await officer.get('/api/v1/collaterals', { search: collateral.CollateralReferenceNumber })).body.data,
    ).toHaveLength(1)
    await admin.dispose()
    await officer.dispose()
  })

  test('only the delete permission of a page lets a user ask, and only checkers see what to decide', async ({
    browser,
  }) => {
    const checker = await Api.as('checker')
    const readonly = await Api.as('readonly')
    const officer = await Api.as('officer')
    const app = await createApplication(officer, { clientNumber: CUSTOMER.spare[5] })
    const collateral = await createCollateral(officer, app.creditApplicationReference)
    // the checker may decide but may not ask; a read-only user may do neither
    const asked = await checker.post('/api/v1/deletion-requests', {
      record_id: collateral.id,
      table_name: 'collaterals',
      comment: 'no permission',
    })
    expect(asked.status).toBe(403)
    expect(
      (
        await readonly.post('/api/v1/deletion-requests', {
          record_id: collateral.id,
          table_name: 'collaterals',
          comment: 'no permission',
        })
      ).status,
    ).toBe(403)
    expect((await readonly.get('/api/v1/deletion-requests')).status).toBe(403)
    // an unknown table is refused outright
    const odd = await officer.post('/api/v1/deletion-requests', {
      record_id: 1,
      table_name: 'user_permissions',
      comment: 'x',
    })
    expect(odd.status).toBe(422)
    // the Requests page is closed to a user without View Deletion Requests
    const ctx = await browser.newContext({ storageState: authFile('readonly') })
    const page = await ctx.newPage()
    await page.goto('/requests')
    await expect(page).toHaveURL(/\/errors\/403/)
    await ctx.close()
    for (const a of [checker, readonly, officer]) await a.dispose()
  })

  test('a trash icon is not offered to a user without the delete permission', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile('checker') })
    const page = await ctx.newPage()
    await page.goto('/cmc-list')
    await expect(page.getByRole('row').nth(1)).toBeVisible()
    await expect(page.getByRole('button', { name: /Request deletion/ })).toHaveCount(0)
    await ctx.close()
  })
})
