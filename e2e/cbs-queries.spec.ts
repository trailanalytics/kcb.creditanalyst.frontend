import { expect, test, type Page, type Route } from '@playwright/test'

const me = (permissions: string[], role = 'crb-officer') => ({
  id: 1,
  firstname: 'Dan',
  lastname: 'Dba',
  name: 'Dan Dba',
  email: 'dan@kcb.test',
  role,
  branchId: null,
  permissions,
})

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

const paged = <T>(data: T[]) => ({
  data,
  current_page: 1,
  last_page: 1,
  per_page: 20,
  total: data.length,
  from: data.length ? 1 : null,
  to: data.length ? data.length : null,
})

const MANAGE = ['Manage CBS Queries']
const REVIEW = ['Review CBS Queries']

const COLUMNS = [
  { ordinal: 1, name: 'CUS_ID', required: true, description: 'Customer id' },
  { ordinal: 2, name: 'CUS_NAME', required: true, description: null },
]
const MODULE = {
  code: 'extract-customers',
  name: 'Extract customers',
  bindCount: 1,
  bindDescription: 'since date',
  columns: COLUMNS,
}

const finding = (extra: Record<string, unknown>) => ({
  ordinal: 1,
  severity: 'ERROR',
  code: 'MISSING_ALIAS',
  columnPosition: 1,
  foundText: null,
  expectedAlias: null,
  suggestedOffset: null,
  message: '',
  ...extra,
})

/** A stand-in for the backend validator that knows just the two shapes the specs use. */
function validateSql(sql: string) {
  const findings: Record<string, unknown>[] = []
  const missing = /SELECT A\.CUS_ID(?!\s+AS)/.exec(sql)
  if (missing) {
    findings.push(
      finding({
        ordinal: 1,
        code: 'MISSING_ALIAS',
        columnPosition: 1,
        foundText: 'A.CUS_ID',
        expectedAlias: 'CUS_ID',
        suggestedOffset: missing.index + 'SELECT A.CUS_ID'.length,
        message: 'Column 1 `A.CUS_ID` has no alias. Add `AS CUS_ID`.',
      }),
    )
  }
  const wrong = /AS CUSNAME/.exec(sql)
  if (wrong) {
    findings.push(
      finding({
        ordinal: findings.length + 1,
        code: 'WRONG_ALIAS',
        columnPosition: 2,
        foundText: 'CUSNAME',
        expectedAlias: 'CUS_NAME',
        message: 'Column 2 alias `CUSNAME` should be `CUS_NAME`.',
      }),
    )
  }
  const errorCount = findings.length
  return { passed: errorCount === 0, errorCount, warningCount: 0, findings }
}

const version = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 12,
  coreSystem: 'T24',
  module: MODULE,
  versionNo: 3,
  sql: 'SELECT A.CUS_ID, A.NAME AS CUSNAME\nFROM CUSTOMER A\nWHERE A.UPDATED > ?',
  status: 'DRAFT',
  isSample: false,
  note: null,
  parentVersionId: 2,
  createdBy: 'Dan Dba',
  createdAt: '2026-10-20T08:00:00Z',
  submittedBy: null,
  submittedAt: null,
  activatedBy: null,
  activatedAt: null,
  latestValidation: null,
  reviews: [],
  events: [
    {
      id: 1,
      event: 'CREATED',
      actor: 'Dan Dba',
      detail: 'from version 2',
      createdAt: '2026-10-20T08:00:00Z',
    },
  ],
  canEdit: true,
  canSubmit: true,
  canReview: false,
  canActivate: false,
  ...extra,
})

const CORE = [
  { code: 'T24', name: 'T24', configured: true },
  { code: 'FINACLE', name: 'Finacle', configured: false },
]

async function signIn(page: Page, permissions: string[], role?: string) {
  await page.route('**/api/v1/me', (r) => json(r, me(permissions, role)))
}

async function backendBasics(page: Page) {
  await page.route('**/api/v1/cbs-queries/core-systems', (r) => json(r, CORE))
}

test('a DBA edits, sees the findings, applies the suggestions and submits', async ({ page }) => {
  await signIn(page, MANAGE)
  await backendBasics(page)
  let v = version()
  const validations: string[] = []
  let saved: { sql: string; note: string } | null = null
  await page.route('**/api/v1/cbs-queries/versions/12', async (r) => {
    if (r.request().method() === 'PUT') {
      saved = r.request().postDataJSON()
      v = { ...v, sql: saved!.sql, note: saved!.note || null }
      return json(r, v)
    }
    return json(r, v)
  })
  await page.route('**/api/v1/cbs-queries/validate', (r) => {
    const body = r.request().postDataJSON() as { module: string; sql: string }
    expect(body.module).toBe('extract-customers')
    validations.push(body.sql)
    return json(r, validateSql(body.sql))
  })
  await page.route('**/api/v1/cbs-queries/versions/12/submit', (r) => {
    v = {
      ...v,
      status: 'VALIDATED',
      canEdit: false,
      canSubmit: false,
      submittedBy: 'Dan Dba',
      submittedAt: '2026-10-24T09:00:00Z',
      latestValidation: { passed: true, runAt: '2026-10-24T09:00:00Z', findings: [] },
      events: [
        ...(v.events as unknown[]),
        { id: 2, event: 'SUBMITTED', actor: 'Dan Dba', detail: null, createdAt: '2026-10-24T09:00:00Z' },
      ],
    }
    return json(r, v)
  })

  await page.goto('/cbs-queries/versions/12/edit')
  await expect(page.getByTestId('title')).toContainText('Extract customers, T24 version 3')
  await expect(page.getByTestId('status-banner')).toContainText('Draft')
  await expect(page.getByTestId('sql')).toHaveValue(/SELECT A\.CUS_ID, A\.NAME AS CUSNAME/)
  await expect(page.getByTestId('line-numbers')).toContainText('3')

  // findings of the loaded text: a missing alias and a wrong one, each says what the alias should be
  const missing = page.getByTestId('finding-1')
  await expect(missing).toContainText('Add `AS CUS_ID`')
  await expect(missing.getByTestId('finding-found')).toHaveText('A.CUS_ID')
  await expect(missing.getByTestId('finding-expected')).toHaveText('CUS_ID')
  await expect(missing.getByTestId('severity')).toHaveText('ERROR')
  await expect(page.getByTestId('finding-2')).toContainText('should be `CUS_NAME`')
  await expect(page.getByTestId('column-CUS_ID')).toHaveAttribute('data-state', 'missing')
  await expect(page.getByTestId('column-CUS_NAME')).toHaveAttribute('data-state', 'missing')
  await expect(page.getByTestId('live-passed')).toHaveText('Does not pass')

  await page.getByTestId('finding-1').getByTestId('apply').click()
  await expect(page.getByTestId('sql')).toHaveValue(/SELECT A\.CUS_ID AS CUS_ID, A\.NAME AS CUSNAME/)
  await expect(page.getByTestId('finding-1')).toContainText('CUS_NAME') // the wrong alias is now the first finding
  await page.getByTestId('finding-1').getByTestId('apply').click()
  await expect(page.getByTestId('sql')).toHaveValue(/A\.NAME AS CUS_NAME\n/)

  await expect(page.getByTestId('live-passed')).toHaveText('Passes')
  await expect(page.getByTestId('no-findings')).toBeVisible()
  await expect(page.getByTestId('column-CUS_ID')).toHaveAttribute('data-state', 'ok')
  await expect(page.getByTestId('column-CUS_NAME')).toHaveAttribute('data-state', 'ok')
  await expect(page.getByTestId('columns-summary')).toContainText('2 of 2 expected columns produced')
  expect(validations.at(-1)).toContain('AS CUS_ID, A.NAME AS CUS_NAME')

  await page.getByTestId('note').fill('aliases fixed')
  await page.getByTestId('save').click()
  await expect(page.getByText('Draft saved.')).toBeVisible()
  expect(saved).toMatchObject({ note: 'aliases fixed' })
  expect(saved!.sql).toContain('A.NAME AS CUS_NAME')

  await page.getByTestId('submit').click()
  await expect(page.getByTestId('status-banner')).toContainText('Validated')
  await expect(page.getByTestId('stored-passed')).toHaveText('Passed')
  await expect(page.getByTestId('stored-check')).toContainText('0 errors, 0 warnings')
  // submitted text is immutable: no buttons, read-only box
  await expect(page.getByTestId('submit')).toHaveCount(0)
  await expect(page.getByTestId('save')).toHaveCount(0)
  await expect(page.getByTestId('sql')).toHaveJSProperty('readOnly', true)
})

test('live validation waits for the typing to stop', async ({ page }) => {
  await signIn(page, MANAGE)
  await backendBasics(page)
  const v = version({ sql: 'SELECT A.CUS_ID AS CUS_ID, A.NAME AS CUS_NAME FROM CUSTOMER A' })
  await page.route('**/api/v1/cbs-queries/versions/12', (r) => json(r, v))
  const sent: string[] = []
  await page.route('**/api/v1/cbs-queries/validate', (r) => {
    sent.push((r.request().postDataJSON() as { sql: string }).sql)
    return json(r, validateSql(sent.at(-1)!))
  })
  await page.goto('/cbs-queries/versions/12/edit')
  await expect(page.getByTestId('live-passed')).toHaveText('Passes')
  const before = sent.length
  await page.getByTestId('sql').pressSequentially(' -- x', { delay: 50 })
  await page.getByTestId('sql').fill('SELECT A.CUS_ID, A.NAME AS CUS_NAME FROM CUSTOMER A')
  expect(sent.length).toBe(before)
  await expect(page.getByTestId('live-passed')).toHaveText('Does not pass')
  expect(sent.length).toBe(before + 1)
})

test('a failed submit is shown as the server worded it', async ({ page }) => {
  await signIn(page, MANAGE)
  await backendBasics(page)
  await page.route('**/api/v1/cbs-queries/versions/12', (r) =>
    json(r, version({ sql: 'SELECT A.CUS_ID AS CUS_ID, A.NAME AS CUS_NAME FROM CUSTOMER A' })),
  )
  await page.route('**/api/v1/cbs-queries/validate', (r) => json(r, validateSql('')))
  await page.route('**/api/v1/cbs-queries/versions/12/submit', (r) =>
    json(r, { title: 'Conflict', status: 409, detail: 'This version can no longer be submitted.' }, 409),
  )
  await page.goto('/cbs-queries/versions/12/edit')
  await page.getByTestId('submit').click()
  await expect(page.getByText('This version can no longer be submitted.')).toBeVisible()
})

const validated = (extra: Record<string, unknown> = {}) =>
  version({
    status: 'VALIDATED',
    submittedBy: 'Dan Dba',
    submittedAt: '2026-10-21T09:00:00Z',
    latestValidation: {
      passed: true,
      runAt: '2026-10-21T09:00:00Z',
      findings: [
        finding({
          severity: 'WARNING',
          code: 'EXTRA_COLUMN',
          columnPosition: 3,
          foundText: 'EXTRA',
          message: 'Column 3 `EXTRA` is not read by the module.',
        }),
      ],
    },
    reviews: [
      {
        outcome: 'CHANGES_RECOMMENDED',
        comment: 'Earlier round',
        reviewer: 'Amy Analyst',
        createdAt: '2026-10-19T09:00:00Z',
        recommendations: [{ id: 5, text: 'Drop the EXTRA column', appliedInVersionId: 11 }],
      },
    ],
    canEdit: false,
    canSubmit: false,
    canReview: true,
    ...extra,
  })

test('an analyst reviews a version and recommends changes', async ({ page }) => {
  await signIn(page, REVIEW)
  await backendBasics(page)
  let v = validated()
  let posted: unknown = null
  await page.route('**/api/v1/cbs-queries/versions/12', (r) => json(r, v))
  await page.route('**/api/v1/cbs-queries/versions/12/reviews', (r) => {
    posted = r.request().postDataJSON()
    v = validated({ status: 'CHANGES_RECOMMENDED', canReview: false })
    return json(r, { id: 7 }, 201)
  })

  await page.goto('/cbs-queries/versions/12/review')
  await expect(page.getByTestId('title')).toContainText('Review: Extract customers')
  await expect(page.getByTestId('sql')).toHaveJSProperty('readOnly', true)
  await expect(page.getByTestId('expected-columns')).toContainText('CUS_NAME')
  await expect(page.getByTestId('latest-findings')).toContainText(
    'Column 3 `EXTRA` is not read by the module.',
  )
  const history = page.getByTestId('history')
  await expect(history).toContainText('Amy Analyst')
  await expect(history).toContainText('Drop the EXTRA column')
  await expect(history.getByTestId('applied-in')).toContainText('version #11')

  // the form needs an outcome, and recommendations when changes are recommended
  await page.getByTestId('send-review').click()
  await expect(page.getByTestId('form-error')).toContainText('Choose an outcome')
  await page.getByTestId('outcome-changes').check()
  await page.getByTestId('send-review').click()
  await expect(page.getByTestId('form-error')).toContainText('at least one recommendation')

  await page.getByTestId('comment').fill('Close, but two things')
  await page.getByTestId('recommendation-input').first().fill('Alias A.CUS_ID')
  await page.getByTestId('add-recommendation').click()
  await page.getByTestId('recommendation-input').nth(1).fill('Remove the unused column')
  await page.getByTestId('send-review').click()

  await expect(page).toHaveURL(/\/cbs-queries\/versions\/12$/)
  expect(posted).toEqual({
    outcome: 'CHANGES_RECOMMENDED',
    comment: 'Close, but two things',
    recommendations: ['Alias A.CUS_ID', 'Remove the unused column'],
  })
  await expect(page.getByTestId('status-banner')).toContainText('Changes recommended')
})

test('an analyst approves after the confirmation, without recommendations', async ({ page }) => {
  await signIn(page, REVIEW)
  await backendBasics(page)
  let posted: unknown = null
  await page.route('**/api/v1/cbs-queries/versions/12', (r) => json(r, validated()))
  await page.route('**/api/v1/cbs-queries/versions/12/reviews', (r) => {
    posted = r.request().postDataJSON()
    return json(r, { id: 8 }, 201)
  })
  await page.goto('/cbs-queries/versions/12/review')
  await page.getByTestId('outcome-approved').check()
  await page.getByTestId('send-review').click()
  await page.getByRole('button', { name: 'Yes, approve' }).click()
  await expect(page).toHaveURL(/\/cbs-queries\/versions\/12$/)
  expect(posted).toEqual({ outcome: 'APPROVED', comment: '', recommendations: [] })
})

test('a refused review (self review) shows the server message', async ({ page }) => {
  await signIn(page, REVIEW)
  await backendBasics(page)
  await page.route('**/api/v1/cbs-queries/versions/12', (r) => json(r, validated()))
  await page.route('**/api/v1/cbs-queries/versions/12/reviews', (r) =>
    json(r, { title: 'Conflict', status: 409, detail: 'You cannot review a version you submitted.' }, 409),
  )
  await page.goto('/cbs-queries/versions/12/review')
  await page.getByTestId('outcome-changes').check()
  await page.getByTestId('recommendation-input').first().fill('Anything')
  await page.getByTestId('send-review').click()
  await expect(page.getByText('You cannot review a version you submitted.')).toBeVisible()
  await expect(page).toHaveURL(/\/review$/)
})

test('without the canReview flag the form is not offered', async ({ page }) => {
  await signIn(page, REVIEW)
  await backendBasics(page)
  await page.route('**/api/v1/cbs-queries/versions/12', (r) => json(r, validated({ canReview: false })))
  await page.goto('/cbs-queries/versions/12/review')
  await expect(page.getByTestId('cannot-review')).toBeVisible()
  await expect(page.getByTestId('review-form')).toHaveCount(0)
})

test('a plain user has no menu entry and is refused the pages', async ({ page }) => {
  await signIn(page, ['View Profiles'], 'admin')
  await backendBasics(page)
  await page.goto('/home')
  await expect(page.getByRole('link', { name: 'Profiles', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'CBS Query Configuration' })).toHaveCount(0)
  await page.goto('/admin')
  await expect(page.getByRole('link', { name: 'CBS Query Configuration' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'CBS Queries', exact: true })).toHaveCount(0)

  for (const path of [
    '/cbs-queries',
    '/cbs-queries/samples',
    '/cbs-queries/events',
    '/cbs-queries/versions/12',
    '/cbs-queries/versions/12/edit',
    '/cbs-queries/versions/12/review',
  ]) {
    await page.goto(path)
    await expect(page).toHaveURL(/errors\/403/)
  }
})

test('either permission shows the menu entry and opens the overview', async ({ page }) => {
  for (const permissions of [MANAGE, REVIEW]) {
    await page.unrouteAll({ behavior: 'ignoreErrors' })
    await signIn(page, permissions)
    await backendBasics(page)
    await page.route('**/api/v1/cbs-queries/modules', (r) => json(r, []))
    await page.route('**/api/v1/cbs-queries/versions?**', (r) => json(r, paged([])))
    await page.goto('/home')
    await page.getByRole('link', { name: 'CBS Query Configuration' }).click()
    await expect(page).toHaveURL(/\/cbs-queries$/)
    await expect(page.getByTestId('core-system')).toHaveValue('T24')
  }
})

test('the sample library says there is no validated sample yet for a core system without one', async ({
  page,
}) => {
  await signIn(page, MANAGE)
  await page.route('**/api/v1/cbs-queries/core-systems', (r) =>
    json(
      r,
      [CORE[1], CORE[0]].map((c) => ({ ...c, configured: c.code === 'FINACLE' })),
    ),
  )
  await page.route('**/api/v1/cbs-queries/modules', (r) => json(r, [{ ...MODULE, coreSystems: [] }]))
  const asked: string[] = []
  await page.route('**/api/v1/cbs-queries/samples?**', (r) => {
    const core = new URL(r.request().url()).searchParams.get('coreSystem') ?? ''
    asked.push(core)
    return json(
      r,
      core === 'T24'
        ? [
            {
              id: 2,
              coreSystem: 'T24',
              module: 'extract-customers',
              versionNo: 1,
              status: 'ACTIVE',
              isSample: true,
              activatedBy: 'System',
              activatedAt: '2026-09-01T00:00:00Z',
            },
          ]
        : [],
    )
  })
  await page.goto('/cbs-queries/samples')
  await expect(page.getByTestId('core-system')).toHaveValue('FINACLE')
  await expect(page.getByTestId('no-samples')).toContainText('No validated sample yet')
  expect(asked).toEqual(['FINACLE'])

  // the T24 sample can still serve as a reference for a Finacle draft
  await page.getByTestId('core-system').selectOption('T24')
  await expect(page.getByTestId('sample-2')).toContainText('T24 version 1')
  await expect(page.getByTestId('no-samples')).toHaveCount(0)
})

test('a DBA uses a sample as the draft of the configured core system', async ({ page }) => {
  await signIn(page, MANAGE)
  await page.route('**/api/v1/cbs-queries/core-systems', (r) =>
    json(
      r,
      CORE.map((c) => ({ ...c, configured: c.code === 'FINACLE' })),
    ),
  )
  await page.route('**/api/v1/cbs-queries/modules', (r) => json(r, [{ ...MODULE, coreSystems: [] }]))
  await page.route('**/api/v1/cbs-queries/samples?**', (r) =>
    json(r, [
      {
        id: 2,
        coreSystem: 'T24',
        module: 'extract-customers',
        versionNo: 1,
        status: 'ACTIVE',
        isSample: true,
        activatedBy: 'System',
        activatedAt: '2026-09-01T00:00:00Z',
      },
    ]),
  )
  await page.route('**/api/v1/cbs-queries/versions/2', (r) =>
    json(
      r,
      version({
        id: 2,
        versionNo: 1,
        status: 'ACTIVE',
        isSample: true,
        sql: 'SELECT A.ID AS CUS_ID FROM T A',
        canEdit: false,
        canSubmit: false,
      }),
    ),
  )
  let body: unknown = null
  await page.route('**/api/v1/cbs-queries/versions', (r) => {
    body = r.request().postDataJSON()
    return json(r, version({ id: 30, coreSystem: 'FINACLE', versionNo: 1, parentVersionId: 2 }), 201)
  })
  await page.route('**/api/v1/cbs-queries/versions/30', (r) =>
    json(r, version({ id: 30, coreSystem: 'FINACLE', versionNo: 1, parentVersionId: 2 })),
  )
  await page.route('**/api/v1/cbs-queries/validate', (r) => json(r, validateSql('')))
  await page.goto('/cbs-queries/samples?coreSystem=T24')
  await page.getByTestId('view-sql').click()
  await expect(page.getByTestId('sample-sql').getByTestId('sql')).toHaveValue(
    'SELECT A.ID AS CUS_ID FROM T A',
  )
  await page.getByTestId('use-as-draft').click()
  await expect(page).toHaveURL(/\/cbs-queries\/versions\/30\/edit$/)
  expect(body).toEqual({ coreSystem: 'FINACLE', module: 'extract-customers', fromVersionId: 2 })
})

test('an analyst does not get the draft buttons', async ({ page }) => {
  await signIn(page, REVIEW)
  await backendBasics(page)
  await page.route('**/api/v1/cbs-queries/modules', (r) => json(r, [{ ...MODULE, coreSystems: [] }]))
  await page.route('**/api/v1/cbs-queries/versions?**', (r) => json(r, paged([])))
  await page.route('**/api/v1/cbs-queries/samples?**', (r) =>
    json(r, [
      {
        id: 2,
        coreSystem: 'T24',
        module: 'extract-customers',
        versionNo: 1,
        status: 'ACTIVE',
        isSample: true,
      },
    ]),
  )
  await page.goto('/cbs-queries')
  await expect(page.getByTestId('module-extract-customers')).toBeVisible()
  await expect(page.getByTestId('start-draft')).toHaveCount(0)
  await page.goto('/cbs-queries/samples')
  await expect(page.getByTestId('sample-2')).toBeVisible()
  await expect(page.getByTestId('use-as-draft')).toHaveCount(0)
})

test('the overview shows the active version, validation badge, samples and the actions', async ({ page }) => {
  await signIn(page, MANAGE)
  await backendBasics(page)
  const second = { code: 'extract-loans', name: 'Extract loans', bindCount: 0, columns: [COLUMNS[0]] }
  await page.route('**/api/v1/cbs-queries/modules', (r) =>
    json(r, [
      {
        ...MODULE,
        coreSystems: [
          {
            coreSystem: 'T24',
            activeVersion: {
              id: 5,
              versionNo: 2,
              activatedAt: '2026-10-01T10:00:00Z',
              activatedBy: 'Dan Dba',
            },
            sampleCount: 2,
          },
          { coreSystem: 'FINACLE', activeVersion: null, sampleCount: 0 },
        ],
      },
      {
        ...second,
        coreSystems: [
          { coreSystem: 'T24', activeVersion: null, sampleCount: 0 },
          { coreSystem: 'FINACLE', activeVersion: null, sampleCount: 0 },
        ],
      },
    ]),
  )
  const lists: string[] = []
  await page.route('**/api/v1/cbs-queries/versions?**', (r) => {
    const core = new URL(r.request().url()).searchParams.get('coreSystem') ?? ''
    lists.push(core)
    return json(
      r,
      paged(
        core === 'T24'
          ? [
              { id: 9, coreSystem: 'T24', module: 'extract-customers', versionNo: 3, status: 'DRAFT' },
              { id: 5, coreSystem: 'T24', module: 'extract-customers', versionNo: 2, status: 'ACTIVE' },
              {
                id: 8,
                coreSystem: 'T24',
                module: 'extract-loans',
                versionNo: 1,
                status: 'VALIDATION_FAILED',
              },
            ]
          : [],
      ),
    )
  })
  let draftBody: unknown = null
  await page.route('**/api/v1/cbs-queries/versions', (r) => {
    draftBody = r.request().postDataJSON()
    return json(r, version({ id: 40, versionNo: 3 }), 201)
  })
  await page.route('**/api/v1/cbs-queries/versions/40', (r) => json(r, version({ id: 40, versionNo: 3 })))
  await page.route('**/api/v1/cbs-queries/validate', (r) => json(r, validateSql('')))

  await page.goto('/cbs-queries')
  await expect(page.getByTestId('core-system')).toHaveValue('T24')
  const customers = page.getByTestId('module-extract-customers')
  await expect(customers.getByTestId('active-no')).toHaveText('Version 2')
  await expect(customers.getByTestId('active-by')).toContainText('by Dan Dba, 1 Oct 2026')
  await expect(customers.getByTestId('validation')).toHaveText('Validated')
  await expect(customers.getByTestId('samples')).toHaveText('2')
  await expect(customers.getByTestId('open-active')).toHaveAttribute('href', '/cbs-queries/versions/5')
  await expect(customers.getByTestId('open-progress')).toHaveAttribute('href', '/cbs-queries/versions/9')
  await expect(customers.getByTestId('open-progress')).toContainText('v3')
  const loans = page.getByTestId('module-extract-loans')
  await expect(loans.getByTestId('no-active')).toBeVisible()
  await expect(loans.getByTestId('validation')).toHaveText('Validation failed, v1')
  await expect(loans.getByTestId('open-active')).toHaveCount(0)

  await page.getByTestId('core-system').selectOption('FINACLE')
  await expect(page.getByTestId('not-configured')).toContainText('does not run FINACLE')
  await expect(page.getByTestId('module-extract-customers').getByTestId('no-active')).toBeVisible()
  await expect(page.getByTestId('module-extract-customers').getByTestId('validation')).toHaveText(
    'No active query',
  )
  expect(lists).toEqual(['T24', 'FINACLE'])

  // start a draft from the active version of the configured system
  await page.getByTestId('core-system').selectOption('T24')
  await page.getByTestId('module-extract-customers').getByTestId('start-draft').click()
  await page.getByRole('button', { name: 'Yes, start a draft' }).click() // version 3 is still in progress
  await expect(page).toHaveURL(/\/cbs-queries\/versions\/40\/edit$/)
  expect(draftBody).toEqual({ coreSystem: 'T24', module: 'extract-customers', fromVersionId: 5 })
})

test('the version page offers the actions of its flags and status', async ({ page }) => {
  await signIn(page, MANAGE)
  await backendBasics(page)
  let v = version({
    id: 20,
    status: 'APPROVED',
    canEdit: false,
    canSubmit: false,
    canActivate: true,
    submittedBy: 'Dan Dba',
    submittedAt: '2026-10-21T09:00:00Z',
    latestValidation: { passed: true, runAt: '2026-10-21T09:00:00Z', findings: [] },
    reviews: [
      {
        outcome: 'APPROVED',
        comment: 'Looks right',
        reviewer: 'Amy Analyst',
        createdAt: '2026-10-22T09:00:00Z',
        recommendations: [],
      },
    ],
    events: [
      { id: 1, event: 'CREATED', actor: 'Dan Dba', detail: null, createdAt: '2026-10-20T08:00:00Z' },
      { id: 2, event: 'SUBMITTED', actor: 'Dan Dba', detail: null, createdAt: '2026-10-21T09:00:00Z' },
      {
        id: 3,
        event: 'REVIEWED',
        actor: 'Amy Analyst',
        detail: 'APPROVED',
        createdAt: '2026-10-22T09:00:00Z',
      },
    ],
  })
  await page.route('**/api/v1/cbs-queries/versions/20', (r) => json(r, v))
  await page.route('**/api/v1/cbs-queries/versions/20/activate', (r) => {
    v = {
      ...v,
      status: 'ACTIVE',
      canActivate: false,
      activatedBy: 'Dan Dba',
      activatedAt: '2026-10-24T10:00:00Z',
    }
    return json(r, v)
  })
  let promoted = false
  await page.route('**/api/v1/cbs-queries/versions/20/promote-sample', (r) => {
    promoted = true
    v = { ...v, isSample: true }
    return json(r, {})
  })
  let removed = false
  await page.route('**/api/v1/cbs-queries/versions/20/sample', (r) => {
    removed = true
    v = { ...v, isSample: false }
    return json(r, {}, 200)
  })

  await page.goto('/cbs-queries/versions/20')
  await expect(page.getByTestId('status-banner')).toContainText('Approved')
  await expect(page.getByTestId('audit')).toContainText('REVIEWED')
  await expect(page.getByTestId('reviews-card')).toContainText('Looks right')
  await expect(page.getByTestId('validation-history')).toContainText('submitted by Dan Dba')
  await expect(page.getByTestId('edit')).toHaveCount(0)
  await expect(page.getByTestId('submit')).toHaveCount(0)
  await expect(page.getByTestId('promote')).toHaveCount(0)

  await page.getByTestId('activate').click()
  await page.getByRole('button', { name: 'Yes, activate' }).click()
  await expect(page.getByTestId('status-banner')).toContainText('The extractors read this query now')
  await expect(page.getByTestId('activate')).toHaveCount(0)

  await page.getByTestId('promote').click()
  await page.getByRole('button', { name: 'Yes, promote' }).click()
  await expect(page.getByTestId('sample-badge')).toBeVisible()
  expect(promoted).toBe(true)

  await page.getByTestId('remove-sample').click()
  await page.getByRole('button', { name: 'Yes, remove' }).click()
  await expect(page.getByTestId('sample-badge')).toHaveCount(0)
  expect(removed).toBe(true)
})

test('revise opens the new draft and a refused activation shows the server message', async ({ page }) => {
  await signIn(page, MANAGE)
  await backendBasics(page)
  const changes = version({
    id: 21,
    status: 'CHANGES_RECOMMENDED',
    canEdit: false,
    canSubmit: false,
    reviews: [
      {
        outcome: 'CHANGES_RECOMMENDED',
        comment: '',
        reviewer: 'Amy Analyst',
        createdAt: '2026-10-22T09:00:00Z',
        recommendations: [{ id: 1, text: 'Alias it', appliedInVersionId: null }],
      },
    ],
  })
  await page.route('**/api/v1/cbs-queries/versions/21', (r) => json(r, changes))
  await page.route('**/api/v1/cbs-queries/versions/21/revise', (r) =>
    json(r, version({ id: 22, versionNo: 4, parentVersionId: 21 }), 201),
  )
  await page.route('**/api/v1/cbs-queries/versions/22', (r) =>
    json(r, version({ id: 22, versionNo: 4, parentVersionId: 21 })),
  )
  await page.route('**/api/v1/cbs-queries/validate', (r) => json(r, validateSql('')))
  await page.goto('/cbs-queries/versions/21')
  await expect(page.getByTestId('open-rec')).toHaveText('open')
  await page.getByTestId('revise').click()
  await page.getByRole('button', { name: 'Yes, revise' }).click()
  await expect(page).toHaveURL(/\/cbs-queries\/versions\/22\/edit$/)
  await expect(page.getByTestId('title')).toContainText('version 4')

  await page.route('**/api/v1/cbs-queries/versions/23', (r) =>
    json(r, version({ id: 23, status: 'APPROVED', canEdit: false, canSubmit: false, canActivate: true })),
  )
  await page.route('**/api/v1/cbs-queries/versions/23/activate', (r) =>
    json(
      r,
      {
        title: 'Conflict',
        status: 409,
        detail: 'The query no longer passes validation against the current columns.',
      },
      409,
    ),
  )
  await page.goto('/cbs-queries/versions/23')
  await page.getByTestId('activate').click()
  await page.getByRole('button', { name: 'Yes, activate' }).click()
  await expect(
    page.getByText('The query no longer passes validation against the current columns.'),
  ).toBeVisible()
})

test('the events page filters by module and core system', async ({ page }) => {
  await signIn(page, REVIEW)
  await backendBasics(page)
  await page.route('**/api/v1/cbs-queries/modules', (r) => json(r, [{ ...MODULE, coreSystems: [] }]))
  const asked: { module: string; core: string }[] = []
  await page.route('**/api/v1/cbs-queries/events?**', (r) => {
    const q = new URL(r.request().url()).searchParams
    asked.push({ module: q.get('module') ?? '', core: q.get('coreSystem') ?? '' })
    return json(
      r,
      paged([
        {
          id: 1,
          versionId: 12,
          versionNo: 3,
          coreSystem: 'T24',
          module: 'extract-customers',
          actor: 'Dan Dba',
          event: 'SUBMITTED',
          detail: null,
          createdAt: '2026-10-21T09:00:00Z',
        },
      ]),
    )
  })
  await page.goto('/cbs-queries/events')
  await expect(page.getByTestId('event-name')).toHaveText('SUBMITTED')
  await expect(page.getByTestId('event-version')).toHaveText('T24 / extract-customers / v3')
  await expect(page.getByTestId('event-version')).toHaveAttribute('href', '/cbs-queries/versions/12')
  expect(asked[0]).toEqual({ module: '', core: '' })
  await page.getByTestId('core-system').selectOption('FINACLE')
  await expect.poll(() => asked.at(-1)).toEqual({ module: '', core: 'FINACLE' })
  await page.getByTestId('module').selectOption('extract-customers')
  await expect.poll(() => asked.at(-1)).toEqual({ module: 'extract-customers', core: 'FINACLE' })
})
