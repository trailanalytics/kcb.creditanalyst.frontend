import { expect, test } from '@playwright/test'
import { Api } from '../uat/support/api'
import { authFile } from '../uat/support/auth'
import { CUSTOMER } from '../uat/support/env'
import { application, createApplication } from '../uat/support/data'
import { confirmDialog, dialog, modal } from '../uat/support/ui'
import { buildXlsx } from '../uat/support/xlsx'
import { figure, message } from './support/guide'
import { capTile, findApplicationRow, openCapTileMenu, openRowMenu } from './support/steps'

/**
 * Credit Approver Guide (role id "approver"): decides pending applications one at a time or as an uploaded list. Signed in as
 * uat.approver. The applications it decides are created by uat.officer through the API inside each test, so the tests do not
 * depend on each other or on the order of the run. No loan account of the UAT pools is used: approvals are made without one.
 */
const ROLE = 'approver'
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

test.use({ storageState: authFile('approver') })

test.describe('Credit Approver Guide', () => {
  test('01 pending applications and approving one', async ({ page }) => {
    const officer = await Api.as('officer')
    const approver = await Api.as('approver')
    const app = await createApplication(officer, { clientNumber: CUSTOMER.spare[5] }) // 9100024 Kabuye Henry

    await page.goto('/home')
    await expect(capTile(page)).toBeVisible()
    await figure(page, ROLE, '01-dashboard', 'Your dashboard: the CAP card is where your work starts', [
      {
        target: capTile(page).getByRole('link', { name: 'Manage Credit Applications' }),
        tip: 'Open the list of credit applications',
        side: 'below',
      },
      {
        target: capTile(page).getByRole('button', { name: 'More' }),
        tip: 'Bulk Approval and the Applications Report',
        side: 'below',
      },
    ])

    await capTile(page).getByRole('link', { name: 'Manage Credit Applications' }).click()
    await expect(page).toHaveURL(/\/applications$/)
    await page.getByLabel('Filter applications').selectOption('2')
    await expect(page.locator('div.group').first()).toBeVisible()
    await figure(page, ROLE, '02-pending-list', 'The applications waiting for a decision', [
      { target: page.getByLabel('Filter applications'), tip: 'Choose Pending', side: 'below' },
      {
        target: page.getByPlaceholder('search...'),
        tip: 'Search by name, client number or CAP reference',
        side: 'below',
      },
      { target: page.locator('div.group').first(), tip: 'Point at a row to see its buttons', side: 'below' },
    ])

    const row = await findApplicationRow(page, app.creditApplicationReference)
    await openRowMenu(page, row)
    await figure(page, ROLE, '03-row-menu', 'Point at the row and open the arrow menu', [
      {
        target: row.getByRole('link', { name: 'Loan Details' }),
        tip: 'Look at the application first',
        side: 'left',
      },
      {
        target: page.getByRole('menuitem', { name: 'Approve Loan' }),
        tip: 'Approve the application',
        side: 'left',
      },
      {
        target: page.getByRole('menuitem', { name: 'Reject Loan' }),
        tip: 'Reject it with a reason',
        side: 'left',
      },
    ])
    await page.keyboard.press('Escape')

    await page.goto(`/applications/show/${app.id}`)
    await expect(page.getByRole('link', { name: 'Change Status' })).toBeVisible()
    await page.getByRole('button', { name: 'Show / Hide' }).click()
    await expect(page.getByRole('cell', { name: app.creditApplicationReference }).first()).toBeVisible()
    await figure(page, ROLE, '04-application-page', 'Loan Details: everything about the application', [
      {
        target: page.getByRole('link', { name: 'Change Status' }),
        tip: 'Approve or reject from here as well',
        side: 'left',
      },
      {
        target: page.getByRole('button', { name: 'Show / Hide' }),
        tip: 'Show every detail of the loan and the borrower',
        side: 'left',
      },
    ])

    await page.getByRole('link', { name: 'Change Status' }).click()
    await expect(page).toHaveURL(new RegExp(`/applications/change-status/${app.id}`))
    await page.getByLabel('Application Status').selectOption('0')
    await expect(page.getByLabel(/Loan Account Number/)).toBeVisible()
    await figure(
      page,
      ROLE,
      '05-approve-form',
      'Approve: choose Approved and update the status',
      [
        { target: page.getByLabel('Application Status'), tip: 'Choose Approved' },
        {
          target: page.getByLabel(/Loan Account Number/),
          tip: 'Optional: the T24 loan account, if the loan is already booked',
        },
        {
          target: page.locator('label', { hasText: 'Amount Approved' }),
          tip: 'The amount approved (the amount applied for unless you change it)',
        },
        {
          target: page.getByRole('button', { name: 'Update Application Status' }),
          tip: 'Click Update Application Status',
        },
      ],
      {
        steps: [
          'The table on the right lists the borrower’s loan accounts, to help you find the loan account number.',
        ],
      },
    )
    await page.getByRole('button', { name: 'Update Application Status' }).click()
    await expect(dialog(page)).toContainText('Loan Application Approved Successfully')
    await figure(page, ROLE, '06-approved', 'The application is approved', [
      { target: page.locator('.swal2-confirm'), tip: 'Click OK: you are back on the list' },
    ])
    message(
      ROLE,
      'Loan Application Approved Successfully',
      'Click OK. The application is now Approved and can no longer be edited.',
    )
    await confirmDialog(page, 'OK')
    await page.getByPlaceholder('search...').fill(app.creditApplicationReference)
    const approvedRow = page.locator('div.group', { hasText: app.creditApplicationReference })
    await expect(approvedRow).toContainText('Approved')
    await figure(page, ROLE, '07-approved-in-list', 'The list shows the decision', [
      { target: approvedRow.getByText('Approved', { exact: true }), tip: 'Status Approved', side: 'left' },
    ])
    expect((await application(approver, app.id)).creditApplicationStatus).toBe('0')

    // an unknown loan account is refused; the application stays pending
    const second = await createApplication(officer, { clientNumber: CUSTOMER.spare[5] })
    await page.goto(`/applications/change-status/${second.id}`)
    await page.getByLabel('Application Status').selectOption('0')
    await page.getByLabel(/Loan Account Number/).fill('AA00NOTBOOKED')
    await page.getByRole('button', { name: 'Update Application Status' }).click()
    await expect(dialog(page)).toContainText('Loan account AA00NOTBOOKED was not found.')
    await figure(
      page,
      ROLE,
      '08-loan-not-found',
      'A loan account that is not in Credit Analyst is refused',
      [],
      { clip: dialog(page) },
    )
    message(
      ROLE,
      'Loan account … was not found.',
      'Check the loan account number. If the loan is not booked yet, leave the box empty and approve.',
    )
    message(
      ROLE,
      'Loan Account … has already been used to approve an application',
      'One loan account approves one application only. Check the number, or leave the box empty.',
    )
    await confirmDialog(page, 'OK')
    expect((await application(approver, second.id)).creditApplicationStatus).toBe('2')
    await officer.dispose()
    await approver.dispose()
  })

  test('02 rejecting an application', async ({ page }) => {
    const officer = await Api.as('officer')
    const approver = await Api.as('approver')
    const app = await createApplication(officer, { clientNumber: CUSTOMER.spare[4] }) // 9100023 Achieng Lilian

    const row = await findApplicationRow(page, app.creditApplicationReference)
    await openRowMenu(page, row)
    await page.getByRole('menuitem', { name: 'Reject Loan' }).click()
    await expect(page).toHaveURL(new RegExp(`/applications/change-status/${app.id}`))
    await page.getByLabel('Application Status').selectOption('5')
    await page.getByLabel(/Rejection Reason/).selectOption('3')
    await figure(page, ROLE, '09-reject-form', 'Reject: choose the status and the reason', [
      { target: page.getByLabel('Application Status'), tip: 'Choose Rejected (or another refusal status)' },
      { target: page.getByLabel(/Rejection Reason/), tip: 'A reason is required' },
      {
        target: page.getByRole('button', { name: 'Update Application Status' }),
        tip: 'Click Update Application Status',
      },
    ])
    await page.getByRole('button', { name: 'Update Application Status' }).click()
    await expect(dialog(page)).toContainText('Declined Successfully')
    await figure(page, ROLE, '10-declined', 'The application is rejected', [
      { target: page.locator('.swal2-confirm'), tip: 'Click OK' },
    ])
    message(
      ROLE,
      'Declined Successfully',
      'Click OK. The application is rejected and the reason is stored with it.',
    )
    message(
      ROLE,
      'The rejection reason field is required.',
      'Choose a rejection reason, then click Update Application Status again.',
    )
    message(
      ROLE,
      'Only pending applications can be approved or declined.',
      'Somebody has already decided this application. Look at its status in the list.',
    )
    await confirmDialog(page, 'OK')
    await page.getByPlaceholder('search...').fill(app.creditApplicationReference)
    const rejectedRow = page.locator('div.group', { hasText: app.creditApplicationReference })
    await expect(rejectedRow).toContainText('Rejected')
    await figure(page, ROLE, '11-rejected-in-list', 'The list shows the rejection', [
      { target: rejectedRow.getByText('Rejected', { exact: true }), tip: 'Status Rejected', side: 'left' },
    ])
    const saved = await application(approver, app.id)
    expect(saved.creditApplicationStatus).toBe('5')
    expect(saved.rejection.rejectionReason).toBe('3')
    await officer.dispose()
    await approver.dispose()
  })

  test('03 bulk approval: upload a list and decide it on one screen', async ({ page }) => {
    const officer = await Api.as('officer')
    const approver = await Api.as('approver')
    const a = await createApplication(officer, { clientNumber: CUSTOMER.spare[0] }) // 9100019 Mukasa Francis
    const b = await createApplication(officer, { clientNumber: CUSTOMER.spare[1] }) // 9100020 Ochieng Brian
    const unknown = 'KCB/CAP/000000/999999'

    await page.goto('/home')
    await openCapTileMenu(page)
    await figure(page, ROLE, '12-cap-card-menu', 'The arrow menu of the CAP card', [
      {
        target: page.getByRole('menuitem', { name: 'Bulk Approval' }),
        tip: 'Decide many applications at once',
        side: 'left',
      },
      {
        target: page.getByRole('menuitem', { name: 'Applications Report' }),
        tip: 'Export applications to Excel',
        side: 'left',
      },
      {
        target: page.getByRole('menuitem', { name: 'Auto-Approval Reviews' }),
        tip: 'Not built yet: coming in a later release',
        side: 'left',
      },
    ])
    await page.getByRole('menuitem', { name: 'Bulk Approval' }).click()
    await expect(page).toHaveURL(/\/applications\/bulk-approve/)
    await figure(page, ROLE, '13-bulk-approval', 'Bulk Approval: your own list of applications', [
      {
        target: page.getByRole('button', { name: 'Upload New List' }),
        tip: 'Upload the list of CAP references to decide',
        side: 'below',
      },
      {
        target: page.getByRole('button', { name: 'SAVE CHANGES' }),
        tip: 'Save every decision on the screen',
        side: 'below',
      },
      {
        target: page.getByRole('button', { name: 'Download List' }),
        tip: 'Download your list as an Excel file',
        side: 'below',
      },
    ])

    await page.getByRole('button', { name: 'Upload New List' }).click()
    const upload = modal(page)
    await upload.locator('input[type="file"]').setInputFiles({
      name: 'applications to decide.xlsx',
      mimeType: XLSX,
      buffer: buildXlsx([
        ['creditApplicationReference'],
        [a.creditApplicationReference],
        [b.creditApplicationReference],
        [unknown],
      ]),
    })
    await expect(upload.getByText('applications to decide.xlsx')).toBeVisible()
    await figure(
      page,
      ROLE,
      '14-bulk-upload',
      'Upload New List: a workbook with the CAP references in the first column',
      [
        {
          target: upload.getByRole('link', { name: /Download credit applications template/ }),
          tip: 'The template, if you need one',
        },
        {
          target: upload.getByText('applications to decide.xlsx'),
          tip: 'Drop the file here or click to browse',
        },
        { target: upload.getByRole('button', { name: 'UPLOAD' }), tip: 'Click UPLOAD' },
      ],
      { clip: upload },
    )
    await upload.getByRole('button', { name: 'UPLOAD' }).click()
    await expect(dialog(page)).toContainText('Record Uploaded Successfully')
    await expect(dialog(page)).toContainText(unknown)
    await figure(
      page,
      ROLE,
      '15-bulk-uploaded',
      'The list is loaded; references that do not exist are named',
      [],
      { clip: dialog(page) },
    )
    message(
      ROLE,
      'Record Uploaded Successfully. Not found: …',
      'The references named were not found and are left out. Check them; the others are on your list.',
    )
    await confirmDialog(page, 'OK')
    await expect(page.getByText(a.creditApplicationReference)).toBeVisible()
    await expect(page.getByText(b.creditApplicationReference)).toBeVisible()

    await page.getByLabel(`Status of ${a.creditApplicationReference}`).selectOption('0')
    await page.getByLabel(`Status of ${b.creditApplicationReference}`).selectOption('5')
    await page.getByLabel(`Rejection reason of ${b.creditApplicationReference}`).selectOption('4')
    await figure(page, ROLE, '16-bulk-decide', 'Choose a decision for each application on the list', [
      {
        target: page.getByLabel(`Loan account of ${a.creditApplicationReference}`),
        tip: 'Approved needs the loan account number',
        side: 'left',
      },
      {
        target: page.getByLabel(`Rejection reason of ${b.creditApplicationReference}`),
        tip: 'A refusal needs a reason',
        side: 'left',
      },
      {
        target: page.getByRole('button', { name: 'SAVE CHANGES' }),
        tip: 'Click SAVE CHANGES. Rows left Pending are not touched',
        side: 'below',
      },
    ])
    // the first stays pending (no loan is booked for it); only the rejection is saved
    await page.getByLabel(`Status of ${a.creditApplicationReference}`).selectOption('2')
    await page.getByRole('button', { name: 'SAVE CHANGES' }).click()
    await expect(dialog(page)).toContainText('Saved Successfully: 0 approved, 1 declined.')
    await figure(page, ROLE, '17-bulk-saved', 'The decisions are saved', [], { clip: dialog(page) })
    message(
      ROLE,
      'Saved Successfully: … approved, … declined.',
      'Nothing to do: the counts say how many applications were decided.',
    )
    message(
      ROLE,
      'Not approved (loan not found, already used or reason missing): …',
      'The applications named were not decided. Give each a loan account that exists and is unused, or a rejection reason, and save again.',
    )
    message(
      ROLE,
      'Choose a status for at least one application.',
      'Choose Approved or a refusal status on at least one row before you click SAVE CHANGES.',
    )
    await confirmDialog(page, 'OK')
    expect((await application(approver, a.id)).creditApplicationStatus).toBe('2')
    expect((await application(approver, b.id)).creditApplicationStatus).toBe('5')

    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download List' }).click()
    expect((await download).suggestedFilename()).toBe('pending-applications.xlsx')
    await officer.dispose()
    await approver.dispose()
  })

  test('04 the applications report', async ({ page }) => {
    await page.goto('/home')
    await openCapTileMenu(page)
    await page.getByRole('menuitem', { name: 'Applications Report' }).click()
    await expect(page).toHaveURL(/\/applications\/report/)
    await page.getByLabel('Status').selectOption({ label: 'Approved' })
    await figure(page, ROLE, '18-applications-report', 'Applications Report: choose, then Download', [
      { target: page.getByLabel('Status'), tip: 'All, Pending, Approved or Rejected' },
      { target: page.getByPlaceholder('From'), tip: 'Optional: the application dates to include' },
      { target: page.getByLabel('Branch'), tip: 'Optional: one branch' },
      {
        target: page.getByRole('button', { name: 'Download' }),
        tip: 'Click Download: an Excel file is saved',
      },
    ])
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download' }).click()
    expect((await download).suggestedFilename()).toMatch(/^CB011CAE\d+\.xlsx$/)
  })
})
