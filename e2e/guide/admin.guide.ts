import { expect, test } from '@playwright/test'
import { figure, message } from './support/guide'
import { Api } from '../uat/support/api'
import { authFile } from '../uat/support/auth'
import { confirmDialog, dialog, expectAppReadable, toasts, unique } from '../uat/support/ui'

/**
 * Administrator Guide (role id `admin`, persona uat.admin@kcb.test): users and their permissions, logs and statistics, the
 * configuration, the T24 page without a warehouse, background processes, and what the read-only (uat.readonly) and
 * permission-less (uat.noaccess) users see. Runs on a freshly seeded stack with no T24 warehouse.
 */
const ROLE = 'admin'
// a local password that passes the policy: 12 or more characters, upper and lower case, a digit and a special character
const GOOD_PASSWORD = 'Guide#Start2026'

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

/** Wait until a process started after `before` has ended; returns it. */
async function waitForNewProcess(api: Api, before: Set<number>, timeout = 120_000): Promise<Proc> {
  let found: Proc | undefined
  await expect
    .poll(
      async () => {
        const list = await api.get('/api/v1/background-processes')
        found = ((list.body?.data ?? []) as Proc[]).find((p) => !before.has(p.id))
        return found?.status
      },
      { timeout, intervals: [2000] },
    )
    .toMatch(/completed|failed/)
  return found!
}

test.describe('Administrator Guide', () => {
  test.describe('as the administrator', () => {
    test.use({ storageState: authFile('admin') })

    test('01 the admin dashboard', async ({ page }) => {
      await page.goto('/admin')
      await expect(page.getByRole('link', { name: 'Users', exact: true })).toBeVisible()
      await figure(page, ROLE, '01-admin-dashboard', 'The admin dashboard', [
        { target: page.getByRole('link', { name: 'Users', exact: true }), tip: 'Users: create, change and disable accounts' },
        { target: page.getByRole('link', { name: 'Statistics', exact: true }), tip: 'Logs and statistics' },
        { target: page.getByRole('link', { name: 'Configurations', exact: true }), tip: 'T24 credentials and CRB charges' },
        { target: page.getByRole('link', { name: 'Sync T24', exact: true }), tip: 'The T24 page: imports, commands, forex rates', side: 'below' },
      ])
    })

    test('02 users: create, edit, disable and ask for deletion', async ({ page }) => {
      const stamp = unique()
      const email = `uat.guide.${stamp}@kcb.test`
      const lastName = 'Namuli'
      await page.goto('/users')
      await expect(page.getByRole('row').nth(1)).toBeVisible()
      await figure(page, ROLE, '02-users', 'The users', [
        { target: page.getByLabel('Search users'), tip: 'Search by name or the exact e-mail', side: 'below' },
        { target: page.getByRole('link', { name: '+ New User' }), tip: 'Click + New User to add an account', side: 'below' },
        { target: page.getByRole('link', { name: 'Edit' }).first(), tip: 'Change a user', side: 'left' },
        { target: page.getByRole('button', { name: /^Request deletion of / }).first(), tip: 'Ask for a user to be deleted', side: 'left' },
      ])

      await page.getByRole('link', { name: '+ New User' }).click()
      await expect(page).toHaveURL(/\/users\/new/)
      await page.getByLabel('First name').fill('Grace')
      await page.getByLabel('Last name').fill(lastName)
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Authentication').selectOption('credit_analyst')
      await page.locator('input[type="password"]').fill('Short#1')
      await page.getByLabel('Role').selectOption('crb')
      await figure(
        page,
        ROLE,
        '02-user-new',
        'A new user',
        [
          { target: page.getByLabel('Email'), tip: 'The e-mail is the user ID for a Credit Analyst account' },
          { target: page.getByLabel('Authentication'), tip: 'Active Directory, or Credit Analyst with a password' },
          { target: page.locator('input[type="password"]'), tip: 'Only for Credit Analyst accounts' },
          { target: page.getByLabel('Role'), tip: 'Choose the role' },
        ],
        { steps: ['Choose a branch only for a branch user, who then sees only the applications they create.'] },
      )

      // the permissions, grouped by area
      await page.getByRole('checkbox', { name: 'View Profiles', exact: true }).check()
      await page.getByRole('checkbox', { name: 'View Credit Applications', exact: true }).check()
      const groupBox = page.getByRole('checkbox', { name: /^Select all .* permissions$/ }).first()
      await groupBox.scrollIntoViewIfNeeded()
      await figure(
        page,
        ROLE,
        '02-user-permissions',
        'Tick what the user may do',
        [
          { target: groupBox, tip: 'Tick a group heading to tick all of its permissions' },
          { target: page.getByRole('checkbox', { name: 'View Profiles', exact: true }), tip: 'Or tick permissions one by one' },
        ],
        { steps: ['Scroll down and click Create User.'] },
      )

      // the password rules: a short password is refused under the box
      await page.getByRole('button', { name: 'Create User' }).click()
      const rule = page.locator('span.text-danger').filter({ hasText: /password/i }).first()
      await expect(rule).toBeVisible()
      await page.locator('input[type="password"]').scrollIntoViewIfNeeded()
      await figure(page, ROLE, '02-password-rules', 'A password that breaks the rules', [
        { target: rule, tip: 'What the password still needs' },
      ])
      message(ROLE, (await rule.innerText()).trim(), 'Type a longer password with upper and lower case letters, a digit and a special character, then click Create User again.')

      await page.locator('input[type="password"]').fill(GOOD_PASSWORD)
      await page.getByRole('button', { name: 'Create User' }).click()
      await expect(toasts(page).filter({ hasText: 'User Created Successfully' })).toBeVisible()
      message(ROLE, 'User Created Successfully', 'The user can sign in now. Give them the password in person or by phone, never by e-mail.')
      await expect(page).toHaveURL(/\/users$/)

      // change and disable
      await page.getByLabel('Search users').fill(email)
      const row = page.getByRole('row', { name: new RegExp(email.replaceAll('.', '\\.')) })
      await expect(row).toContainText('crb')
      await row.getByRole('link', { name: 'Edit' }).click()
      await expect(page.getByRole('heading', { name: 'Edit User' })).toBeVisible()
      await page.getByLabel('Status').selectOption('disabled')
      await figure(
        page,
        ROLE,
        '02-user-edit',
        'Change or disable a user',
        [
          { target: page.getByLabel('Status'), tip: 'Choose Disabled to stop the user signing in' },
          { target: page.locator('input[type="password"]'), tip: 'Leave blank to keep the current password' },
          { target: page.getByLabel('Role'), tip: 'Change the role if needed' },
        ],
        { steps: ['Scroll down and click Update User.'] },
      )
      await page.getByRole('button', { name: 'Update User' }).click()
      await expect(toasts(page).filter({ hasText: 'Updated Successfully' })).toBeVisible()
      message(ROLE, 'Updated Successfully', 'The change applies the next time the user opens a page.')
      await expect(page).toHaveURL(/\/users$/)

      // deletion is a request a checker decides on
      await page.getByLabel('Search users').fill(email)
      await expect(page.getByRole('row', { name: new RegExp(email.replaceAll('.', '\\.')) })).toContainText('disabled')
      await page.getByRole('button', { name: `Request deletion of Grace ${lastName}` }).click()
      await page.locator('.swal2-textarea').fill('Left the bank on 31 October 2026')
      await figure(
        page,
        ROLE,
        '02-user-delete',
        'Ask for a user to be deleted',
        [
          { target: page.locator('.swal2-textarea'), tip: 'Type why the user should be deleted' },
          { target: page.locator('.swal2-confirm'), tip: 'Click Yes, Proceed!' },
        ],
        { clip: dialog(page) },
      )
      await confirmDialog(page, 'Yes, Proceed!')
      await expect(dialog(page)).toContainText('Request to Delete the Record has been submitted successfully!')
      message(ROLE, 'Request to Delete the Record has been submitted successfully!', 'A checker approves or declines the request on the Requests page. The user is deleted only then.')
      await confirmDialog(page, 'OK')
      await expectAppReadable(page)
      await expect(page.locator('[title="This user has been requested to be deleted!"]')).toBeVisible()

      await page.goto('/requests')
      const request = page.getByTestId('requests').locator('tbody tr').filter({ hasText: 'Left the bank on 31 October 2026' }).first()
      await expect(request).toBeVisible()
      await figure(page, ROLE, '02-requests', 'The deletion request waits for a checker', [
        { target: request.getByTestId('pending-badge'), tip: 'Pending until a checker decides' },
        { target: request.getByTestId('view'), tip: 'View the record the request is about' },
        { target: request.getByTestId('waiting'), tip: 'You cannot decide on your own request', side: 'left' },
      ])
    })

    test('03 logs and statistics, and the export', async ({ page }) => {
      await page.goto('/admin')
      await page.getByRole('link', { name: 'Statistics', exact: true }).click()
      await expect(page).toHaveURL(/\/logs/)
      await page.getByLabel('Search logs').fill('created user')
      await expect(page.getByRole('row', { name: /created user/ }).first()).toBeVisible()
      await figure(page, ROLE, '03-activity-logs', 'The activity log', [
        { target: page.getByRole('tab', { name: 'Activity Logs' }), tip: 'What users did, newest first', side: 'below' },
        { target: page.getByRole('tab', { name: 'Login Logs' }), tip: 'Who signed in, and when', side: 'below' },
        { target: page.getByLabel('Search logs'), tip: 'Search the log', side: 'below' },
        { target: page.getByRole('button', { name: 'Export' }), tip: 'Export a log to CSV or Excel', side: 'left' },
      ])

      await page.getByRole('tab', { name: 'Login Logs' }).click()
      await page.getByLabel('Search logs').fill('uat.admin')
      await expect(page.getByRole('row').nth(1)).toBeVisible()
      await page.getByRole('tab', { name: 'Deleted Records' }).click()
      await expect(page.getByRole('cell', { name: 'Collaterals', exact: true })).toBeVisible()
      await figure(page, ROLE, '03-deleted-records', 'Deleted records, counted by table', [
        { target: page.getByRole('tab', { name: 'Deleted Records' }), tip: 'How many records were deleted in each table', side: 'below' },
      ])

      await page.getByRole('button', { name: 'Export' }).click()
      const exportDialog = page.getByRole('dialog')
      await expect(exportDialog).toContainText('Export logs')
      const kind = exportDialog.locator('select').filter({ hasText: 'Login logs' })
      await kind.selectOption('activity-logs')
      await figure(
        page,
        ROLE,
        '03-export',
        'Export the logs',
        [
          { target: kind, tip: 'Choose the log: login, activity, deleted records or users' },
          { target: exportDialog.locator('input[type="date"]').first(), tip: 'Choose the dates' },
          { target: exportDialog.locator('select').filter({ hasText: 'CSV' }), tip: 'CSV or Excel (xlsx)' },
          { target: exportDialog.getByRole('button', { name: 'Download' }), tip: 'Click Download' },
        ],
        { clip: exportDialog },
      )
      const csv = page.waitForEvent('download')
      await exportDialog.getByRole('button', { name: 'Download' }).click()
      expect((await csv).suggestedFilename()).toMatch(/\.csv$/)

      await page.getByRole('button', { name: 'Export' }).click()
      await page.getByRole('dialog').locator('select').filter({ hasText: 'CSV' }).selectOption('xlsx')
      const xlsx = page.waitForEvent('download')
      await page.getByRole('dialog').getByRole('button', { name: 'Download' }).click()
      expect((await xlsx).suggestedFilename()).toMatch(/\.xlsx$/)
    })

    test('04 the admin configuration', async ({ page }) => {
      await page.goto('/admin')
      await page.getByRole('link', { name: 'Configurations', exact: true }).click()
      await expect(page).toHaveURL(/\/admin\/configuration/)
      await expect(page.getByTestId('expiry-line')).toBeVisible()
      await figure(page, ROLE, '04-configuration-t24', 'Configuration: the T24 credentials', [
        { target: page.getByRole('tab', { name: 'T24 Credentials' }), tip: 'The login Credit Analyst uses for the T24 warehouse', side: 'below' },
        { target: page.getByTestId('expiry-line'), tip: 'Whether a login is saved and when its password expires' },
        { target: page.locator('input[name="expiry_date"]'), tip: 'The date the warehouse password expires' },
        { target: page.getByRole('tab', { name: 'CRB Application Charges' }), tip: 'The CRB charge on applications', side: 'below' },
      ])

      await page.getByRole('tab', { name: 'CRB Application Charges' }).click()
      await expect(page.locator('input[name="crb_suspense_account"]')).toBeVisible()
      await figure(page, ROLE, '04-configuration-charges', 'Configuration: the CRB application charges', [
        { target: page.locator('input[name="crb_suspense_account"]'), tip: 'The CRB suspense account' },
        { target: page.locator('input[name="credit_amount"]'), tip: 'The amount charged' },
        { target: page.getByRole('button', { name: 'SAVE CHANGES' }), tip: 'Click SAVE CHANGES' },
      ])
    })

    test('05 the T24 page without a warehouse', async ({ page }) => {
      const api = await Api.as('admin')
      await page.goto('/admin')
      await page.getByRole('link', { name: 'Sync T24', exact: true }).click()
      await expect(page).toHaveURL(/\/t24/)
      await expect(page.getByRole('tab', { name: 'T24 Imports' })).toBeVisible()
      await figure(page, ROLE, '05-t24-imports', 'The T24 page', [
        { target: page.getByRole('tab', { name: 'T24 Imports' }), tip: 'What the extracts brought in over the last 2 days', side: 'below' },
        { target: page.getByRole('tab', { name: 'T24 Commands' }), tip: 'Run an extract or a merge now', side: 'below' },
        { target: page.getByRole('tab', { name: 'Map Client Numbers' }), tip: 'Give local clients their T24 number', side: 'below' },
        { target: page.getByRole('tab', { name: 'Forex Rates' }), tip: 'The month-end exchange rates', side: 'below' },
      ])

      // a command: without a warehouse it starts and then fails with the reason
      await page.getByRole('tab', { name: 'T24 Commands' }).click()
      const command = page.getByLabel('Command')
      await expect(command.locator('option').filter({ hasText: 'loan-balances' })).toHaveCount(1)
      await command.selectOption('loan-balances')
      await figure(page, ROLE, '05-t24-commands', 'Run a T24 command', [
        { target: command, tip: 'Choose the command' },
        { target: page.getByRole('button', { name: 'Run Command' }), tip: 'Click Run Command and confirm', side: 'below' },
        { target: page.getByTestId('command-status'), tip: 'Running while it starts', side: 'below' },
      ])
      const before = await processIds(api)
      await page.getByRole('button', { name: 'Run Command' }).click()
      await expect(dialog(page)).toContainText('Are you sure you want to run this command?')
      await confirmDialog(page, 'Yes, run command.')
      await expect(dialog(page)).toContainText('The command has been started')
      await figure(
        page,
        ROLE,
        '05-t24-command-started',
        'The command runs in the background',
        [{ target: page.locator('.swal2-confirm'), tip: 'Click OK, then follow it on Background Processes' }],
        { clip: dialog(page) },
      )
      message(ROLE, 'The command has been started. Follow its progress on the Background Processes page.', 'Open Background Processes to see whether it completed or failed.')
      await confirmDialog(page, 'OK')
      await expectAppReadable(page)
      const failed = await waitForNewProcess(api, before)
      expect(failed.status).toBe('failed')
      if (failed.error_message) {
        message(ROLE, String(failed.error_message), 'Credit Analyst has no connection to the T24 warehouse. Ask IT to set the warehouse service and save the warehouse login. Then run the command again.')
      }

      // the warehouse login
      await page.getByRole('tab', { name: 'T24 Password' }).click()
      await expect(page.getByTestId('expiry-line')).toBeVisible()
      await figure(page, ROLE, '05-t24-password', 'The T24 warehouse login', [
        { target: page.getByTestId('expiry-line'), tip: 'No login is saved yet on this copy' },
        { target: page.locator('input[name="username"]'), tip: 'The warehouse user name' },
        { target: page.locator('input[name="password"]'), tip: 'The warehouse password: it is never shown again' },
        { target: page.getByRole('button', { name: 'UPDATE CREDENTIALS' }), tip: 'Click UPDATE CREDENTIALS', side: 'below' },
      ])

      // client numbers
      await page.getByRole('tab', { name: 'Map Client Numbers' }).click()
      await page.getByRole('button', { name: 'MAP CLIENTS' }).click()
      const guard = page.getByRole('alert').filter({ hasText: 'Please select a client to map' })
      await expect(guard).toBeVisible()
      await figure(page, ROLE, '05-t24-map', 'Map client numbers', [
        { target: page.getByLabel('Client to map'), tip: 'Choose a client created in Credit Analyst' },
        { target: page.locator('input[name="t24ClientNumber"]'), tip: 'Type the client number T24 gave them' },
        { target: page.locator('input[name="autoMap"]'), tip: 'Or tick Auto Map to match all by NIN' },
        { target: page.getByRole('button', { name: 'MAP CLIENTS' }), tip: 'Click MAP CLIENTS', side: 'below' },
      ])
      message(ROLE, (await guard.innerText()).trim(), 'Choose a client and type their T24 client number, or tick Auto Map, then click MAP CLIENTS.')

      // forex rates
      await page.getByRole('tab', { name: 'Forex Rates' }).click()
      await expect(page.getByTestId('forex-row').first()).toBeVisible()
      await figure(page, ROLE, '05-t24-forex', 'Forex rates', [
        { target: page.getByRole('button', { name: /Add Rate/ }), tip: 'Click Add Rate for a new month end', side: 'left' },
        { target: page.getByRole('button', { name: /^Edit .* rate$/ }).first(), tip: 'Click a rate to change it; Enter saves, Esc cancels' },
      ])
      await api.dispose()
    })

    test('06 background processes: mark a failed process complete', async ({ page }) => {
      const api = await Api.as('admin')
      const list = ((await api.get('/api/v1/background-processes')).body?.data ?? []) as Proc[]
      const failed = list.find((p) => p.status === 'failed')
      if (!failed) throw new Error('no failed process to show: section 05 (the T24 command) did not run first')
      await page.goto('/background-processes')
      const row = page.getByTestId(`process-${failed.id}`)
      await expect(row.getByTestId('error')).toBeVisible()
      await figure(page, ROLE, '06-processes', 'Background Processes', [
        { target: row.getByTestId('badge'), tip: 'The state of the process', side: 'below' },
        { target: row.getByTestId('error'), tip: 'Why it failed', side: 'below' },
        { target: row.getByTestId('override'), tip: 'Mark Complete closes a process you have checked', side: 'left' },
      ])
      await row.getByTestId('override').click()
      await expect(dialog(page)).toContainText('Mark as Complete')
      await figure(
        page,
        ROLE,
        '06-mark-complete',
        'Mark a process as complete',
        [{ target: page.locator('.swal2-confirm'), tip: 'Click Yes, Mark Complete only if the work is done' }],
        { clip: dialog(page) },
      )
      await confirmDialog(page, 'Yes, Mark Complete')
      await expect(dialog(page)).toContainText('Process marked as complete.')
      message(ROLE, 'Process marked as complete.', 'The process shows as Completed. Nothing was run again.')
      await confirmDialog(page, 'OK')
      await expectAppReadable(page)
      await api.dispose()
    })
  })

  test.describe('read-only and audit access', () => {
    test.use({ storageState: authFile('readonly') })

    test('07 what the read-only user sees', async ({ page }) => {
      await page.goto('/loans')
      const row = page.getByTestId('loan-row').first()
      await expect(row).toBeVisible()
      await expect(async () => {
        await row.hover()
        await row.getByRole('button', { name: 'More actions' }).click()
        await expect(page.getByRole('menuitem', { name: 'Repayments' })).toBeVisible({ timeout: 5_000 })
      }).toPass({ timeout: 40_000 })
      await expect(page.getByRole('menuitem', { name: 'Write Off Account' })).toHaveCount(0)
      await figure(page, ROLE, '07-readonly-loans', 'A read-only user on the CBA loans list', [
        { target: page.getByRole('menuitem', { name: 'Repayments' }), tip: 'Looking is allowed: details and repayments' },
      ], { steps: ['Write Off Account and Ignore Account are not offered.'] })
      await page.keyboard.press('Escape')

      await page.goto('/fraud')
      await expect(page.getByRole('row').nth(1)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Register Fraud' })).toHaveCount(0)
      await figure(page, ROLE, '07-readonly-fraud', 'A read-only user on the fraud list', [
        { target: page.getByRole('row').nth(1), tip: 'The records, with no Register Fraud button and no pencil', side: 'below' },
      ])
    })
  })

  test.describe('no access', () => {
    test.use({ storageState: authFile('noaccess') })

    test('07 the page a user without the permission sees', async ({ page }) => {
      await page.goto('/loans')
      await expect(page).toHaveURL(/\/errors\/403/)
      const heading = page.getByRole('heading', { name: "You don't have access to this page" })
      await expect(heading).toBeVisible()
      await figure(page, ROLE, '07-noaccess-403', 'The page a user without the permission sees', [
        { target: heading, tip: 'The account lacks the permission for this page' },
        { target: page.getByRole('link', { name: 'Go to Home' }), tip: 'Click Go to Home', side: 'below' },
      ])
      message(ROLE, "You don't have access to this page", 'The account lacks the permission. If the user needs it, tick it on their account (Users, Edit).')
    })
  })
})
