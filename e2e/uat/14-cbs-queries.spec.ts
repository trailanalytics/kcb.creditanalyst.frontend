import { expect, test, type Browser, type Page } from '@playwright/test'
import { Api } from './support/api'
import { authFile } from './support/auth'
import { confirmDialog, dialog, toasts } from './support/ui'

/**
 * CBS Query Configuration (M10): a database administrator (DBA) writes and submits a version of one of the 14 extract and PR4
 * queries, an analyst reviews it, the DBA activates it. The module used here is one no other case touches.
 */
const MODULE = 'extract-letters-of-credit'
const BASE = '/api/v1/cbs-queries'

async function asUser(browser: Browser, persona: Parameters<typeof authFile>[0]): Promise<Page> {
  const ctx = await browser.newContext({ storageState: authFile(persona) })
  return ctx.newPage()
}

async function activeVersion(api: Api): Promise<{ id: number; versionNo: number }> {
  const modules = (await api.get(`${BASE}/modules`)).body as any[]
  const m = modules.find((x) => x.code === MODULE)
  const t24 = m.coreSystems.find((c: any) => c.coreSystem === 'T24')
  expect(t24.activeVersion, 'the shipped T24 query is active').toBeTruthy()
  return t24.activeVersion
}

/** A new draft of the module, copied from the active version (what "Start draft" does). */
async function newDraft(api: Api): Promise<any> {
  const from = await activeVersion(api)
  const created = await api.must(
    api.post(`${BASE}/versions`, { coreSystem: 'T24', module: MODULE, fromVersionId: from.id }),
    'new draft',
  )
  expect(created.status).toBe(201)
  expect(created.body.status).toBe('DRAFT')
  return created.body
}

async function submitted(api: Api): Promise<any> {
  const draft = await newDraft(api)
  const sent = await api.must(api.post(`${BASE}/versions/${draft.id}/submit`), 'submit')
  expect(sent.body.status).toBe('VALIDATED')
  return sent.body
}

const badge = (page: Page) => page.getByTestId('status-badge').first()

test.describe('CBS queries: draft, review and activation', () => {
  test('the overview lists the 14 modules and a DBA starts a draft from the active query, edits, saves and submits it', async ({
    browser,
  }) => {
    const page = await asUser(browser, 'dba')
    await page.goto('/cbs-queries')
    await expect(page.getByTestId('modules').locator('tbody tr')).toHaveCount(14)
    const row = page.getByTestId(`module-${MODULE}`)
    await expect(row.getByTestId('active-no')).toContainText('Version')
    await expect(row.getByTestId('validation')).toBeVisible()

    await row.getByTestId('start-draft').click()
    // an earlier run may have left a draft in progress: the screen asks before it starts another one
    const another = page.locator('.swal2-confirm', { hasText: 'Yes, start a draft' })
    await Promise.race([page.waitForURL(/\/cbs-queries\/versions\/\d+\/edit/), another.waitFor()])
    if (await another.isVisible()) await another.click()
    await expect(page).toHaveURL(/\/cbs-queries\/versions\/(\d+)\/edit/)
    const id = Number(/versions\/(\d+)\/edit/.exec(page.url())![1])

    // the draft holds the text of the active version; the check beside the editor runs on it
    const sql = page.getByTestId('sql')
    await expect(sql).not.toHaveValue('')
    await expect(page.getByTestId('live-passed')).toBeVisible()
    const note = `UAT note ${Date.now()}`
    await page.getByTestId('note').fill(note)
    await page.getByTestId('save').click()
    await expect(toasts(page).filter({ hasText: 'Draft saved.' })).toBeVisible()

    await page.getByTestId('submit').click()
    await expect(toasts(page).filter({ hasText: 'Submitted. The query passed validation' })).toBeVisible()

    const api = await Api.as('dba')
    const stored = (await api.get(`${BASE}/versions/${id}`)).body
    expect(stored.status).toBe('VALIDATED')
    expect(stored.note).toBe(note)
    expect(stored.latestValidation.passed).toBe(true)
    expect(stored.events.map((e: any) => e.event)).toEqual(
      expect.arrayContaining(['CREATED', 'EDITED', 'SUBMITTED']),
    )
    // the text is fixed once it is submitted
    const locked = await api.put(`${BASE}/versions/${id}`, { sql: stored.sql })
    expect(locked.status).toBe(409)
    expect(locked.body.code).toBe('TEXT_LOCKED')
    await api.dispose()
  })

  test('an analyst recommends changes, the DBA revises, the analyst approves and the DBA activates; the old query is superseded', async ({
    browser,
  }) => {
    const dba = await Api.as('dba')
    const before = await activeVersion(dba)
    const first = await submitted(dba)

    // 1. the analyst opens the version and recommends a change
    const analyst = await asUser(browser, 'analyst')
    await analyst.goto(`/cbs-queries/versions/${first.id}`)
    await expect(badge(analyst)).toContainText('Validated')
    await expect(analyst.getByTestId('start-draft')).toHaveCount(0)
    await expect(analyst.getByTestId('edit')).toHaveCount(0)
    await analyst.getByTestId('review').click()
    await expect(analyst).toHaveURL(new RegExp(`/cbs-queries/versions/${first.id}/review`))
    await analyst.getByTestId('outcome-changes').check()
    // asking for changes without saying which is refused on the form
    await analyst.getByTestId('send-review').click()
    await expect(analyst.getByTestId('form-error')).toContainText('Add at least one recommendation')
    await analyst.getByTestId('recommendation-input').first().fill('Keep the column order of the sample')
    await analyst.getByTestId('comment').fill('Looks fine, one request')
    await analyst.getByTestId('send-review').click()
    await expect(toasts(analyst).filter({ hasText: 'Changes recommended.' })).toBeVisible()
    await expect(analyst).toHaveURL(new RegExp(`/cbs-queries/versions/${first.id}$`))
    await expect(badge(analyst)).toContainText('Changes recommended')
    await expect(analyst.getByTestId('recommendation').first()).toContainText(
      'Keep the column order of the sample',
    )

    // 2. the DBA revises: a new draft that remembers where it came from; the recommendation counts as applied in it
    const dbaPage = await asUser(browser, 'dba')
    await dbaPage.goto(`/cbs-queries/versions/${first.id}`)
    await dbaPage.getByTestId('revise').click()
    await confirmDialog(dbaPage, 'Yes, revise')
    await expect(dbaPage).toHaveURL(/\/cbs-queries\/versions\/\d+\/edit/)
    const secondId = Number(/versions\/(\d+)\/edit/.exec(dbaPage.url())![1])
    await expect(dbaPage.getByTestId('live-passed')).toBeVisible()
    await dbaPage.getByTestId('submit').click()
    await expect(toasts(dbaPage).filter({ hasText: 'Submitted. The query passed validation' })).toBeVisible()
    const second = (await dba.get(`${BASE}/versions/${secondId}`)).body
    expect(second.parentVersionId).toBe(first.id)
    expect(second.status).toBe('VALIDATED')
    const reviewed = (await dba.get(`${BASE}/versions/${first.id}`)).body
    expect(reviewed.reviews[0].recommendations[0].appliedInVersionId).toBe(secondId)
    expect((await dba.post(`${BASE}/versions/${first.id}/revise`)).status).toBe(409)

    // 3. the analyst approves the revision
    await analyst.goto(`/cbs-queries/versions/${secondId}/review`)
    await analyst.getByTestId('outcome-approved').check()
    await analyst.getByTestId('send-review').click()
    await confirmDialog(analyst, 'Yes, approve')
    await expect(toasts(analyst).filter({ hasText: 'Query approved.' })).toBeVisible()
    await expect(badge(analyst)).toContainText('Approved')

    // 4. the DBA activates it: it is the active query of the module and the previous one is superseded
    await dbaPage.goto(`/cbs-queries/versions/${secondId}`)
    await expect(badge(dbaPage)).toContainText('Approved')
    await dbaPage.getByTestId('activate').click()
    await confirmDialog(dbaPage, 'Yes, activate')
    await expect(toasts(dbaPage).filter({ hasText: /activated/i })).toBeVisible()
    await expect(badge(dbaPage)).toContainText('Active')
    const now = await activeVersion(dba)
    expect(now.id).toBe(secondId)
    expect((await dba.get(`${BASE}/versions/${before.id}`)).body.status).toBe('SUPERSEDED')
    const kinds = ((await dba.get(`${BASE}/events`, { module: MODULE, size: 50 })).body.data as any[])
      .filter((e) => e.versionId === secondId)
      .map((e) => e.event)
    expect(kinds).toEqual(expect.arrayContaining(['CREATED', 'SUBMITTED', 'REVIEWED', 'ACTIVATED']))

    // the overview shows the new active version
    await dbaPage.goto('/cbs-queries')
    await expect(dbaPage.getByTestId(`module-${MODULE}`).getByTestId('active-no')).toContainText(
      `Version ${second.versionNo}`,
    )

    // 5. rolling back is activating the superseded version again
    const back = await dba.post(`${BASE}/versions/${before.id}/activate`)
    expect(back.status).toBe(200)
    expect((await activeVersion(dba)).id).toBe(before.id)
    expect((await dba.get(`${BASE}/versions/${secondId}`)).body.status).toBe('SUPERSEDED')
    await dba.dispose()
  })

  test('a query that fails validation is stored as validation failed with its findings, then corrected and submitted again', async ({
    browser,
  }) => {
    const dba = await Api.as('dba')
    const draft = await newDraft(dba)
    const good = draft.sql as string
    await dba.must(
      dba.put(`${BASE}/versions/${draft.id}`, { sql: 'select 1 as WRONG from dual' }),
      'break the text',
    )
    const failed = await dba.must(dba.post(`${BASE}/versions/${draft.id}/submit`), 'submit')
    expect(failed.body.status).toBe('VALIDATION_FAILED')
    expect(failed.body.latestValidation.errorCount).toBeGreaterThan(0)
    expect(failed.body.latestValidation.findings.map((f: any) => f.code)).toContain('MISSING_COLUMN')
    // a failed version cannot be reviewed
    const review = await (
      await Api.as('analyst')
    ).post(`${BASE}/versions/${draft.id}/reviews`, { outcome: 'APPROVED' })
    expect(review.status).toBe(409)
    expect(review.body.code).toBe('INVALID_STATE')

    const page = await asUser(browser, 'dba')
    await page.goto(`/cbs-queries/versions/${draft.id}`)
    await expect(badge(page)).toContainText('Validation failed')
    await expect(page.getByTestId('findings')).toBeVisible()
    await expect(page.getByTestId('finding-1')).toBeVisible()
    await expect(page.getByTestId('review')).toHaveCount(0)

    // the same version is edited and submitted again
    await dba.must(dba.put(`${BASE}/versions/${draft.id}`, { sql: good }), 'restore the text')
    const again = await dba.must(dba.post(`${BASE}/versions/${draft.id}/submit`), 'submit again')
    expect(again.body.status).toBe('VALIDATED')
    expect(again.body.versionNo).toBe(draft.versionNo)
    await page.reload()
    await expect(badge(page)).toContainText('Validated')
    await dba.dispose()
  })

  test('the workflow refuses what is not allowed: roles, states, self review and bad reviews', async () => {
    const dba = await Api.as('dba')
    const analyst = await Api.as('analyst')
    const manager = await Api.as('querymanager')
    const from = await activeVersion(dba)

    // holding Manage CBS Queries is not enough: the database-administrator role is needed
    const notDba = await manager.post(`${BASE}/versions`, {
      coreSystem: 'T24',
      module: MODULE,
      fromVersionId: from.id,
    })
    expect(notDba.status).toBe(403)
    expect(notDba.body.code).toBe('NOT_DBA')
    expect((await manager.get(`${BASE}/versions`, { size: 1 })).status).toBe(200)
    // an analyst reads and reviews but does not write
    expect((await analyst.get(`${BASE}/modules`)).status).toBe(200)
    expect(
      (await analyst.post(`${BASE}/versions`, { coreSystem: 'T24', module: MODULE, fromVersionId: from.id }))
        .status,
    ).toBe(403)

    const draft = await newDraft(dba)
    // a draft is not activatable and cannot be reviewed
    const early = await dba.post(`${BASE}/versions/${draft.id}/activate`)
    expect(early.status).toBe(409)
    expect(early.body.code).toBe('NOT_ACTIVATABLE')
    const sent = await dba.must(dba.post(`${BASE}/versions/${draft.id}/submit`), 'submit')
    expect(sent.body.status).toBe('VALIDATED')
    // the submitter may not review it, nor may somebody without Review CBS Queries
    const self = await dba.post(`${BASE}/versions/${draft.id}/reviews`, { outcome: 'APPROVED' })
    expect(self.status).toBe(409)
    expect(self.body.code).toBe('SELF_REVIEW')
    expect((await manager.post(`${BASE}/versions/${draft.id}/reviews`, { outcome: 'APPROVED' })).status).toBe(
      403,
    )
    // validated is not approved: activation needs the analyst first
    const unapproved = await dba.post(`${BASE}/versions/${draft.id}/activate`)
    expect(unapproved.status).toBe(409)
    expect(unapproved.body.code).toBe('NOT_ACTIVATABLE')
    // the analyst cannot activate, and a review has to be consistent
    expect((await analyst.post(`${BASE}/versions/${draft.id}/activate`)).status).toBe(403)
    const noRec = await analyst.post(`${BASE}/versions/${draft.id}/reviews`, {
      outcome: 'CHANGES_RECOMMENDED',
      comment: 'x',
    })
    expect(noRec.status).toBe(422)
    expect(JSON.stringify(noRec.body.errors)).toContain('at least one recommendation')
    const withRec = await analyst.post(`${BASE}/versions/${draft.id}/reviews`, {
      outcome: 'APPROVED',
      recommendations: ['a'],
    })
    expect(withRec.status).toBe(422)
    // nothing above changed the version
    expect(((await dba.get(`${BASE}/versions/${draft.id}`)).body as any).status).toBe('VALIDATED')
    // an unknown version is 404 and the module list is the same for everybody who may read
    expect((await dba.get(`${BASE}/versions/999999999`)).status).toBe(404)
    await Promise.all([dba.dispose(), analyst.dispose(), manager.dispose()])
  })

  test('the screens follow the permissions: no access, analyst, query manager and DBA', async ({
    browser,
  }) => {
    const dba = await Api.as('dba')
    const draft = await submitted(dba)

    // somebody with neither permission gets the 403 page and a 403 from the API
    const none = await asUser(browser, 'officer')
    await none.goto('/cbs-queries')
    await expect(none).toHaveURL(/\/errors\/403/)
    const noaccess = await Api.as('noaccess')
    expect((await noaccess.get(`${BASE}/versions`)).status).toBe(403)
    await noaccess.dispose()
    const anonymous = await fetch(`${process.env.UAT_BASE_URL ?? 'http://localhost:5242'}${BASE}/versions`)
    expect(anonymous.status).toBe(401)

    // the analyst reads the overview, has no Start draft button and no editor
    const analyst = await asUser(browser, 'analyst')
    await analyst.goto('/cbs-queries')
    await expect(analyst.getByTestId('modules').locator('tbody tr')).toHaveCount(14)
    await expect(analyst.getByTestId('start-draft')).toHaveCount(0)
    await analyst.goto(`/cbs-queries/versions/${draft.id}/edit`)
    await expect(analyst).toHaveURL(/\/errors\/403/)

    // the DBA has no review page for the own version: the screen says why
    const own = await asUser(browser, 'dba')
    await own.goto(`/cbs-queries/versions/${draft.id}/review`)
    await expect(own.getByTestId('cannot-review')).toBeVisible()
    await expect(own.getByTestId('review-form')).toHaveCount(0)

    // the query manager sees Start draft (the permission is there) and the server refuses it with the reason
    const manager = await asUser(browser, 'querymanager')
    await manager.goto('/cbs-queries')
    await manager.getByTestId(`module-${MODULE}`).getByTestId('start-draft').click()
    const another = manager.locator('.swal2-confirm', { hasText: 'Yes, start a draft' })
    await Promise.race([dialog(manager).waitFor(), another.waitFor()])
    if (await another.isVisible()) await another.click()
    await expect(dialog(manager)).toContainText(/Database Administrator/)
    await dba.dispose()
  })

  test('the samples and events pages show the shipped queries and the trail of what was done', async ({
    browser,
  }) => {
    const page = await asUser(browser, 'analyst')
    await page.goto(`/cbs-queries/samples?coreSystem=T24&module=${MODULE}`)
    await expect(page.getByTestId(`group-${MODULE}`)).toBeVisible()
    await page.getByTestId(`group-${MODULE}`).getByTestId('view-sql').first().click()
    await expect(page.getByTestId('sample-sql').getByTestId('sql')).toHaveValue(/select/i)
    // an analyst may look but not copy a sample into a draft
    await expect(page.getByTestId('use-as-draft')).toHaveCount(0)

    await page.goto('/cbs-queries/events')
    await expect(page.getByTestId('events')).toBeVisible()
    await expect(page.getByTestId('event').first()).toBeVisible()
    // the bank runs T24: the Finacle set is stored but not read, and says so
    await page.goto('/cbs-queries')
    await page.getByTestId('core-system').selectOption('FINACLE')
    await expect(page.getByTestId('not-configured')).toContainText('does not run FINACLE')
    await expect(page.getByTestId(`module-${MODULE}`).getByTestId('no-active')).toBeVisible()
  })
})
