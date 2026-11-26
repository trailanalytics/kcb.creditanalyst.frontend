import { expect, test } from '@playwright/test'
import { Api } from '../uat/support/api'
import { authFile } from '../uat/support/auth'
import { CUSTOMER } from '../uat/support/env'
import { createApplication, createCollateral } from '../uat/support/data'
import { confirmDialog, dialog } from '../uat/support/ui'
import { figure, message } from './support/guide'
import { askDeletion } from './support/steps'

/**
 * Deletion Checker Guide (role id "checker"): decides the deletion requests other users make (maker-checker). Signed in as
 * uat.checker. The requests are made by uat.officer through the API inside the test (as UAT-21 does), on collateral of new
 * applications of a spare fixture borrower, so nothing the UAT suite counts on is deleted.
 */
const ROLE = 'checker'
const BORROWER = CUSTOMER.spare[3] // 9100022 Ssemwogerere Paul

test.use({ storageState: authFile('checker') })

test.describe('Deletion Checker Guide', () => {
  test('01 the Requests page: approve and decline', async ({ page, browser }) => {
    const maker = await Api.as('officer')
    const app = await createApplication(maker, { clientNumber: BORROWER })
    const toDelete = await createCollateral(
      maker,
      app.creditApplicationReference,
      'Plot 30 Block 6 Wakiso (land title)',
    )
    const toKeep = await createCollateral(
      maker,
      app.creditApplicationReference,
      'Plot 31 Block 6 Wakiso (land title)',
    )
    const approveReq = await askDeletion(
      maker,
      'collaterals',
      toDelete.id,
      'Captured twice for the same plot',
    )
    const cancelReq = await askDeletion(maker, 'collaterals', toKeep.id, 'Valuation report withdrawn')

    await page.goto('/home')
    await figure(page, ROLE, '01-dashboard', 'Your work is on the Requests page', [
      {
        target: page.getByRole('link', { name: 'Requests', exact: true }),
        tip: 'Click Requests',
        side: 'below',
      },
    ])

    await page.getByRole('link', { name: 'Requests', exact: true }).click()
    await expect(page).toHaveURL(/\/requests/)
    // every pending request of another user offers both buttons; the first row is enough for the picture
    await expect(page.getByTestId('approve').first()).toBeVisible()
    await figure(page, ROLE, '02-requests', 'Requests: every deletion request waiting for a decision', [
      {
        target: page.getByTestId('status'),
        tip: 'Pending (the default), Approved or Canceled',
        side: 'below',
      },
      { target: page.getByTestId('search'), tip: 'Search by request number or record number', side: 'below' },
      { target: page.getByTestId('approve').first(), tip: 'Accept & Delete', side: 'left' },
      { target: page.getByTestId('cancel').first(), tip: 'Decline & Maintain', side: 'below' },
    ])

    await page.getByTestId('search').fill(approveReq.request_id)
    const row = page.getByTestId(`request-${approveReq.id}`)
    await expect(row).toContainText(toDelete.CollateralReferenceNumber)
    await figure(page, ROLE, '03-request-row', 'Read the request before you decide', [
      { target: row.getByTestId('request-id'), tip: 'The request number', side: 'below' },
      { target: row.getByTestId('view'), tip: 'Click View to see the record', side: 'below' },
      { target: row.locator('td').nth(4), tip: 'The maker’s reason', side: 'below' },
      { target: row.getByTestId('approve'), tip: 'Accept & Delete or Decline & Maintain', side: 'left' },
    ])

    await row.getByTestId('view').click()
    const record = page.getByTestId('record-modal')
    await expect(page.getByTestId('record-table')).toContainText(toDelete.CollateralReferenceNumber)
    await figure(
      page,
      ROLE,
      '04-request-record',
      'View: the record the request is about',
      [
        {
          target: page.getByTestId('record-table'),
          tip: 'Check that this is the record to delete',
          side: 'below',
        },
      ],
      { clip: record },
    )
    await page.keyboard.press('Escape')
    await expect(record).toHaveCount(0)

    await row.getByTestId('approve').click()
    await expect(dialog(page)).toContainText('the corresponding record will be deleted')
    await figure(
      page,
      ROLE,
      '05-approve-confirm',
      'Accept & Delete: confirm',
      [
        { target: page.locator('.swal2-confirm'), tip: 'Yes, Proceed! deletes the record' },
        { target: page.locator('.swal2-cancel'), tip: 'Cancel leaves the request pending', side: 'left' },
      ],
      { clip: dialog(page) },
    )
    await confirmDialog(page, 'Yes, Proceed!')
    await expect(dialog(page)).toContainText('Request Approved Successfully!')
    await figure(
      page,
      ROLE,
      '06-request-approved',
      'The request is approved and the record removed',
      [{ target: page.locator('.swal2-confirm'), tip: 'Click OK' }],
      { clip: dialog(page) },
    )
    message(
      ROLE,
      'Request Approved Successfully!',
      'Click OK. The record is removed from every list; the request moves to Approved.',
    )
    await confirmDialog(page, 'OK')

    await page.getByTestId('search').fill(cancelReq.request_id)
    const keepRow = page.getByTestId(`request-${cancelReq.id}`)
    await expect(keepRow).toContainText(toKeep.CollateralReferenceNumber)
    await keepRow.getByTestId('cancel').click()
    await expect(dialog(page)).toContainText('the corresponding record will not be deleted')
    await figure(
      page,
      ROLE,
      '07-decline-confirm',
      'Decline & Maintain: confirm',
      [{ target: page.locator('.swal2-confirm'), tip: 'Yes, Proceed! keeps the record' }],
      { clip: dialog(page) },
    )
    await confirmDialog(page, 'Yes, Proceed!')
    await expect(dialog(page)).toContainText('Request Canceled Successfully!')
    message(
      ROLE,
      'Request Canceled Successfully!',
      'Click OK. The record stays; the maker may ask again later.',
    )
    message(
      ROLE,
      'This request was not found or has already been actioned.',
      'Another checker has decided it already. The list is refreshed; look under Approved or Canceled.',
    )
    await confirmDialog(page, 'OK')

    await page.getByTestId('status').selectOption('1')
    await page.getByTestId('search').fill(approveReq.request_id)
    const decided = page.getByTestId(`request-${approveReq.id}`)
    await expect(decided.getByTestId('approved-badge')).toBeVisible()
    await figure(page, ROLE, '08-approved-filter', 'Approved requests show who decided and when', [
      { target: page.getByTestId('status'), tip: 'Choose Approved', side: 'below' },
      {
        target: decided.getByTestId('approved-badge'),
        tip: 'Request Approved: the record was deleted',
        side: 'left',
      },
      { target: decided.getByTestId('actioned'), tip: 'Your name and the date', side: 'left' },
    ])

    // what the maker sees afterwards
    const ctx = await browser.newContext({ storageState: authFile('officer') })
    const makerPage = await ctx.newPage()
    await makerPage.goto('/requests')
    await makerPage.getByTestId('status').selectOption('2')
    await makerPage.getByTestId('search').fill(cancelReq.request_id)
    const canceled = makerPage.getByTestId(`request-${cancelReq.id}`)
    await expect(canceled.getByTestId('canceled-badge')).toBeVisible()
    await figure(
      makerPage,
      ROLE,
      '09-maker-sees-canceled',
      'What the maker sees: the request was declined and the record kept',
      [
        {
          target: canceled.getByTestId('canceled-badge'),
          tip: 'Request Canceled: the record is kept',
          side: 'left',
        },
        { target: canceled.getByTestId('actioned'), tip: 'Who declined it and when', side: 'left' },
      ],
    )
    await makerPage.goto('/cmc-list')
    await makerPage.getByLabel('Search collateral').fill(toDelete.CollateralReferenceNumber)
    await expect(makerPage.getByText('No collateral found.')).toBeVisible()
    await figure(
      makerPage,
      ROLE,
      '10-maker-record-gone',
      'What the maker sees: an approved deletion removes the record from the list',
      [
        {
          target: makerPage.getByLabel('Search collateral'),
          tip: 'The deleted collateral is no longer found',
          side: 'below',
        },
      ],
    )
    await ctx.close()
    await maker.dispose()
  })

  test('02 nobody decides their own request', async ({ browser }) => {
    // the maker sees their own pending request with no buttons
    const maker = await Api.as('officer')
    const app = await createApplication(maker, { clientNumber: BORROWER })
    const collateral = await createCollateral(
      maker,
      app.creditApplicationReference,
      'Plot 32 Block 6 Wakiso (land title)',
    )
    const own = await askDeletion(maker, 'collaterals', collateral.id, 'Duplicate of an earlier entry')
    const ctx = await browser.newContext({ storageState: authFile('officer') })
    const page = await ctx.newPage()
    await page.goto('/requests')
    await page.getByTestId('search').fill(own.request_id)
    const row = page.getByTestId(`request-${own.id}`)
    await expect(row.getByTestId('waiting')).toBeVisible()
    await figure(
      page,
      ROLE,
      '11-own-request-waiting',
      'The maker’s own request: no buttons, another user decides',
      [
        { target: row.getByTestId('pending-badge'), tip: 'Pending Approval' },
        { target: row.getByTestId('waiting'), tip: 'Waiting for another user to decide', side: 'left' },
      ],
    )
    await ctx.close()

    // even a user who holds the checker permissions cannot decide a request they made (the server refuses)
    const admin = await Api.as('superadmin')
    const second = await createCollateral(
      maker,
      app.creditApplicationReference,
      'Plot 33 Block 6 Wakiso (land title)',
    )
    const mine = await askDeletion(admin, 'collaterals', second.id, 'Maker who is also a checker')
    const refused = await admin.post(`/api/v1/deletion-requests/${mine.id}/approve`, {})
    expect(refused.status).toBe(403)
    expect(JSON.stringify(refused.body)).toContain('You are not allowed to action this request!')
    message(
      ROLE,
      'You are not allowed to action this request!',
      'You made this request, so another user must decide it. The same rule applies whatever your permissions.',
    )
    message(
      ROLE,
      "You don't have permission to perform this action. Please contact Admin!",
      'Your account lacks the permission for this action (for example Approve Deletion Requests). Ask your administrator.',
    )
    // leave the list as it was: the checker declines both requests, so the collateral stays
    const checker = await Api.as('checker')
    for (const r of [own, mine])
      await checker.must(checker.post(`/api/v1/deletion-requests/${r.id}/cancel`, {}), 'decline')
    await checker.dispose()
    await admin.dispose()
    await maker.dispose()
  })
})
