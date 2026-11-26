import { expect, test, type Page } from '@playwright/test'
import { figure, message } from './support/guide'
import { authFile } from '../uat/support/auth'
import { confirmDialog, dialog, toasts } from '../uat/support/ui'

/**
 * CBS Query Validator Guide (role id `dba`): the database administrator (uat.dba@kcb.test) writes, submits and activates a
 * version of a core banking query; the reviewer (uat.analyst@kcb.test) approves it or recommends changes. Uses the module
 * spec 14 uses, extract-letters-of-credit. Leaves a newer version of it active (its text is the shipped one).
 */
const ROLE = 'dba'
const MODULE = 'extract-letters-of-credit'

test.use({ storageState: authFile('dba') })

const badge = (page: Page) => page.getByTestId('status-badge').first()
const idFrom = (url: string) => Number(/versions\/(\d+)/.exec(url)![1])

test.describe('CBS Query Validator Guide', () => {
  test('01 the overview and the active version of a module', async ({ page }) => {
    await page.goto('/home')
    await page.getByRole('link', { name: 'CBS Query Configuration', exact: true }).click()
    await expect(page).toHaveURL(/\/cbs-queries$/)
    await expect(page.getByTestId('modules').locator('tbody tr')).toHaveCount(14)
    const row = page.getByTestId(`module-${MODULE}`)
    await expect(row.getByTestId('active-no')).toContainText('Version')
    await figure(page, ROLE, '01-overview', 'The CBS query overview', [
      { target: page.getByTestId('core-system'), tip: 'The core banking system: T24 at KCB Uganda', side: 'below' },
      { target: row.getByTestId('active-no'), tip: 'The version the extractors read now' },
      { target: row.getByTestId('validation'), tip: 'Whether that version passed the check' },
      { target: row.getByTestId('start-draft'), tip: 'Start draft copies the active query into a new version', side: 'left' },
    ])

    await row.getByTestId('open-active').click()
    await expect(page).toHaveURL(/\/cbs-queries\/versions\/\d+$/)
    await expect(badge(page)).toContainText('Active')
    await figure(page, ROLE, '01-active-version', 'The active version of a module', [
      { target: page.getByTestId('status-banner'), tip: 'Where the version stands and what comes next', side: 'below' },
      { target: page.getByTestId('facts'), tip: 'Who created, submitted and activated it', side: 'below' },
      { target: page.getByTestId('sql-editor'), tip: 'The query, read only', side: 'left' },
    ])
  })

  test('02 to 07 a draft is checked, submitted, reviewed, revised, approved and activated', async ({ page, browser }) => {
    // ---- 02 the DBA starts a draft from the active version and edits it ----
    await page.goto('/cbs-queries')
    const row = page.getByTestId(`module-${MODULE}`)
    await row.getByTestId('start-draft').click()
    // a draft left in progress makes the screen ask before it starts another one
    const another = page.locator('.swal2-confirm', { hasText: 'Yes, start a draft' })
    await Promise.race([
      page.waitForURL(/\/cbs-queries\/versions\/\d+\/edit/).catch(() => {}),
      another.waitFor().catch(() => {}),
    ])
    if (await another.isVisible()) await another.click()
    await expect(page).toHaveURL(/\/cbs-queries\/versions\/\d+\/edit/)
    const firstId = idFrom(page.url())

    const sql = page.getByTestId('sql')
    await expect(sql).not.toHaveValue('')
    await expect(page.getByTestId('live-passed')).toHaveText('Passes')
    await figure(page, ROLE, '02-editor', 'The editor of a draft', [
      { target: page.getByTestId('sql-editor'), tip: 'Edit the query here', side: 'below' },
      { target: page.getByTestId('expected-columns'), tip: 'The columns the module needs: a tick for each one the query gives', side: 'left' },
      { target: page.getByTestId('note'), tip: 'Say what you changed and why', side: 'above' },
    ])

    // a typo in one alias: the live check finds it and offers the fix
    const original = await sql.inputValue()
    const broken = original.includes('AS CUST_NAME,')
      ? original.replace('AS CUST_NAME,', 'AS CUSTNAME,')
      : original.replace(/\bAS\s+([A-Z][A-Z0-9_]+)/, 'AS $1X')
    await sql.fill(broken)
    await expect(page.getByTestId('live-passed')).toHaveText('Does not pass')
    const apply = page.getByTestId('live-check').getByTestId('apply').first()
    await expect(apply).toBeEnabled()
    const finding = page.getByTestId('live-check').locator('tr').filter({ has: apply })
    await figure(page, ROLE, '02-finding', 'The live check finds a wrong alias', [
      { target: page.getByTestId('live-passed'), tip: 'The check runs as you type', side: 'below' },
      { target: finding, tip: 'What is wrong and what the alias should be', side: 'below' },
      { target: apply, tip: 'Click Apply suggestion to put the right alias in', side: 'left' },
    ])
    await apply.click()
    await expect(sql).toHaveValue(original)
    await expect(page.getByTestId('live-passed')).toHaveText('Passes')
    await page.getByTestId('note').fill('Letters of credit: aliases checked for the November run')
    await figure(page, ROLE, '02-ready', 'The draft passes the check', [
      { target: page.getByTestId('live-passed'), tip: 'Passes: no errors left' },
      { target: page.getByTestId('save'), tip: 'Click Save draft to keep your work', side: 'below' },
      { target: page.getByTestId('submit'), tip: 'Click Submit when it is ready for review', side: 'below' },
    ])
    await page.getByTestId('save').click()
    await expect(toasts(page).filter({ hasText: 'Draft saved.' })).toBeVisible()
    message(ROLE, 'Draft saved.', 'Your text and note are kept. You can come back to the draft later from the overview.')
    await page.getByTestId('submit').click()
    await expect(toasts(page).filter({ hasText: 'Submitted. The query passed validation' })).toBeVisible()
    message(ROLE, 'Submitted. The query passed validation and waits for review.', 'Nothing more to do until a reviewer has looked at it. The text cannot be changed now.')

    await page.goto(`/cbs-queries/versions/${firstId}`)
    await expect(badge(page)).toContainText('Validated')
    await figure(page, ROLE, '02-validated', 'A submitted version waits for review', [
      { target: page.getByTestId('status-banner'), tip: 'Validated: it waits for a reviewer', side: 'below' },
      { target: page.getByTestId('facts'), tip: 'Your note and who submitted it', side: 'below' },
    ])

    await page.goto('/cbs-queries')
    await expect(row.getByTestId('open-progress')).toBeVisible()
    await figure(page, ROLE, '02-module-versions', "A module's versions on the overview", [
      { target: row.getByTestId('active-no'), tip: 'The active version' },
      { target: row.getByTestId('open-active'), tip: 'Open the active version', side: 'below' },
      { target: row.getByTestId('open-progress'), tip: 'Open the newest version still in progress', side: 'below' },
    ])

    // ---- 03 the DBA may not review an own version ----
    await page.goto(`/cbs-queries/versions/${firstId}/review`)
    const refused = page.getByTestId('cannot-review')
    await expect(refused).toBeVisible()
    await expect(page.getByTestId('review-form')).toHaveCount(0)
    await figure(page, ROLE, '03-self-review', 'You cannot review your own version', [
      { target: refused, tip: 'Another person has to review it', side: 'above' },
    ])
    message(ROLE, (await refused.innerText()).trim(), 'Ask a reviewer (a credit analyst) to review the version.')

    // ---- 04 the reviewer recommends a change ----
    const ctx = await browser.newContext({ storageState: authFile('analyst') })
    const analyst = await ctx.newPage()
    await analyst.goto(`/cbs-queries/versions/${firstId}`)
    await expect(badge(analyst)).toContainText('Validated')
    await expect(analyst.getByTestId('edit')).toHaveCount(0)
    await figure(analyst, ROLE, '04-reviewer-version', 'The reviewer opens a submitted version', [
      { target: analyst.getByTestId('status-banner'), tip: 'Validated: it waits for your review', side: 'below' },
      { target: analyst.getByTestId('review'), tip: 'Click Review', side: 'right' },
    ])
    await analyst.getByTestId('review').click()
    await expect(analyst).toHaveURL(new RegExp(`/cbs-queries/versions/${firstId}/review`))
    await expect(analyst.getByTestId('review-form')).toBeVisible()
    await figure(analyst, ROLE, '04-review-page', 'The review page', [
      { target: analyst.getByTestId('sql-editor'), tip: 'The query under review, read only', side: 'below' },
      { target: analyst.getByTestId('expected-columns'), tip: 'The columns the module needs, each ticked', side: 'left' },
    ])
    await analyst.getByTestId('outcome-changes').check()
    await analyst.getByTestId('recommendation-input').first().fill('Keep the column order of the sample')
    await analyst.getByTestId('comment').fill('The aliases are right. One request before approval.')
    await analyst.getByTestId('send-review').scrollIntoViewIfNeeded()
    await figure(analyst, ROLE, '04-recommend-changes', 'Recommend changes', [
      { target: analyst.getByTestId('outcome-changes'), tip: 'Choose Approve or Recommend changes' },
      { target: analyst.getByTestId('comment'), tip: 'Add a comment' },
      { target: analyst.getByTestId('recommendation-input').first(), tip: 'One line for each change you ask for' },
      { target: analyst.getByTestId('send-review'), tip: 'Click Save review' },
    ])
    await analyst.getByTestId('send-review').click()
    await expect(toasts(analyst).filter({ hasText: 'Changes recommended.' })).toBeVisible()
    message(ROLE, 'Changes recommended.', 'The Database Administrator sees your recommendations on the version and revises it.')
    await expect(analyst).toHaveURL(new RegExp(`/cbs-queries/versions/${firstId}$`))
    await expect(badge(analyst)).toContainText('Changes recommended')
    await figure(analyst, ROLE, '04-changes-recommended', 'The recommendation on the version', [
      { target: analyst.getByTestId('review-outcome').first(), tip: 'The outcome of the review' },
      { target: analyst.getByTestId('recommendation').first(), tip: 'What the Database Administrator has to change' },
    ])

    // ---- 05 the DBA revises: a new draft with the text copied ----
    await page.goto(`/cbs-queries/versions/${firstId}`)
    await expect(page.getByTestId('revise')).toBeVisible()
    await figure(page, ROLE, '05-revise', 'Revise the version', [
      { target: page.getByTestId('status-banner'), tip: 'Changes recommended: revise it', side: 'below' },
      { target: page.getByTestId('revise'), tip: 'Click Revise (new draft) and confirm', side: 'right' },
    ])
    await page.getByTestId('revise').click()
    await confirmDialog(page, 'Yes, revise')
    await expect(page).toHaveURL(/\/cbs-queries\/versions\/\d+\/edit/)
    const secondId = idFrom(page.url())
    await expect(page.getByTestId('live-passed')).toHaveText('Passes')
    await page.getByTestId('submit').click()
    await expect(toasts(page).filter({ hasText: 'Submitted. The query passed validation' })).toBeVisible()

    // ---- 06 the reviewer approves the revision ----
    await analyst.goto(`/cbs-queries/versions/${secondId}/review`)
    await analyst.getByTestId('outcome-approved').check()
    await analyst.getByTestId('send-review').click()
    await expect(dialog(analyst)).toContainText('Approving stays valid for exactly this text')
    await figure(
      analyst,
      ROLE,
      '06-approve',
      'Approve the query',
      [{ target: analyst.locator('.swal2-confirm'), tip: 'Click Yes, approve' }],
      { clip: dialog(analyst) },
    )
    await confirmDialog(analyst, 'Yes, approve')
    await expect(toasts(analyst).filter({ hasText: 'Query approved.' })).toBeVisible()
    message(ROLE, 'Query approved.', 'The Database Administrator can now activate the version.')
    await ctx.close()

    // ---- 07 the DBA activates it ----
    await page.goto(`/cbs-queries/versions/${secondId}`)
    await expect(badge(page)).toContainText('Approved')
    await figure(page, ROLE, '07-activate', 'Activate the approved version', [
      { target: page.getByTestId('status-banner'), tip: 'Approved: it can be activated', side: 'below' },
      { target: page.getByTestId('activate'), tip: 'Click Activate and confirm', side: 'right' },
    ])
    await page.getByTestId('activate').click()
    await confirmDialog(page, 'Yes, activate')
    await expect(toasts(page).filter({ hasText: 'Version activated.' })).toBeVisible()
    message(ROLE, 'Version activated.', 'The extractors read this version from their next run. The version that was active before is now superseded.')
    await expect(badge(page)).toContainText('Active')
    const marks = [{ target: page.getByTestId('status-banner'), tip: 'Active: the extractors read this query now', side: 'below' as const }]
    if (await page.getByTestId('promote').isVisible()) {
      marks.push({ target: page.getByTestId('promote'), tip: 'Promote a version that has run well to the sample library', side: 'below' })
    }
    await figure(page, ROLE, '07-active', 'The new version is active', marks)
  })

  test('08 and 09 the sample library and the events', async ({ page }) => {
    await page.goto(`/cbs-queries/samples?coreSystem=T24&module=${MODULE}`)
    const group = page.getByTestId(`group-${MODULE}`)
    await expect(group).toBeVisible()
    await group.getByTestId('view-sql').first().click()
    await expect(page.getByTestId('sample-sql')).toBeVisible()
    await figure(page, ROLE, '08-samples', 'The sample library', [
      { target: page.getByTestId('module'), tip: 'Choose the module', side: 'below' },
      { target: group.getByTestId('view-sql').first(), tip: 'View SQL shows a query known to work', side: 'left' },
      { target: group.getByTestId('use-as-draft').first(), tip: 'Use as draft starts a new version from it', side: 'left' },
    ])

    await page.goto('/cbs-queries/events')
    await expect(page.getByTestId('event').first()).toBeVisible()
    await page.getByTestId('module').selectOption(MODULE)
    await expect(page.getByTestId('event').first()).toBeVisible()
    await figure(page, ROLE, '09-events', 'The events of a module', [
      { target: page.getByTestId('module'), tip: 'Choose a module to see only its versions', side: 'below' },
      { target: page.getByTestId('event').first(), tip: 'Each step: who, what and when', side: 'below' },
    ])
  })
})
