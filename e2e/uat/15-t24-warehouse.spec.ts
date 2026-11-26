import { expect, test, type Page } from '@playwright/test'
import { Api, type Reply } from './support/api'
import { authFile } from './support/auth'
import { confirmDialog, dialog, today } from './support/ui'

/**
 * UAT-97 and the warehouse half of UAT-22, UAT-92 and UAT-93: the T24 commands, Find in T24, the merges, the Mopesa step and the
 * off balance sheet extract against an Oracle warehouse, through the real OracleWarehouse code path. The warehouse is the stand-in
 * of the backend repo (docker/oracle, compose profile oracle, compose.warehouse.yaml; its README explains every count below).
 *
 * Off unless UAT_WAREHOUSE=1. The login is UAT_DWH_USER / UAT_DWH_PASSWORD (the stand-in's ORACLE_APP_USER / ORACLE_APP_PASSWORD).
 * Start from a reset database: backend scripts/uat/warehouse-reset.sql, then scripts/uat/seed.sh. The loans command rewrites
 * fixture loan rows (the Mopesa housekeeping), so reset and seed again after this file, before any other spec runs.
 */
test.skip(
  !process.env.UAT_WAREHOUSE,
  'needs the Oracle warehouse stand-in: set UAT_WAREHOUSE=1 (backend docker/oracle/README.md)',
)
test.skip(
  today().endsWith('-01'),
  'on the 1st the month-to-date customer window is empty, so the customer counts cannot hold',
)
test.use({ storageState: authFile('admin') })
test.describe.configure({ mode: 'serial' })

const DWH_USER = process.env.UAT_DWH_USER ?? ''
const DWH_PASSWORD = process.env.UAT_DWH_PASSWORD ?? ''

// Freeze after the first real run: what docker/oracle/03-data.sql gives on a database reset with warehouse-reset.sql and seeded
// again. A different number means the stored query, the fixture or the extractor changed (docker/oracle/README.md, "The data and
// the expected counts", says where each number comes from).
const EXPECTED = {
  /** customers: 9200001-9200006 opened this month before today (not the one opened today, the other bank's or the old ones) */
  customers: 6,
  /** merge-customers: those six become profiles (four people, two companies) */
  mergeCustomersCreated: 6,
  /** loans, Mopesa step: files 880001-880003 (active or overdue, opened before now) */
  mopesaLoans: 3,
  /**
   * loans: 12 PR4 rows of yesterday without the Airtel float loan, less the 3 overdrafts, less the PD twin: it carries the contract
   * code of its LD loan and production's unique key on loan_extracts.contractCode keeps the first row (Laravel's insertOrIgnore
   * and the Java INSERT IGNORE alike)
   */
  loans: 8,
  /** loan-balances: the 13 rows of yesterday less the Airtel float loan, counted as read (overdrafts included) */
  loanBalances: 12,
  /** loan-repayments: all 13 rows of yesterday */
  loanRepayments: 13,
  /** loans-dropped: AAUAT26801 (45 days ago) and AAUAT26802 (60 days ago) */
  loansDropped: 2,
  /** overdrafts: 2100910001 and 2100920003 (2100910099 has no limit) */
  overdrafts: 2,
  /** overdraft-balances: the rows of the latest loan balance date, counted as read */
  overdraftBalances: 12,
  /** merge-loans: the 8 contracts of the loan extracts */
  mergeLoansInserted: 8,
  /** off-balance-sheet-items: guarantees and letters of credit of the bank */
  guarantees: 3,
  lettersOfCredit: 3,
}

/** The customers the customers command extracts and merge-customers turns into profiles. */
const NEW_CUSTOMERS = [
  { clientNumber: '9200001', name: 'Mutebi Ronald Kato' },
  { clientNumber: '9200002', name: 'Nansubuga Agnes' },
  { clientNumber: '9200003', name: 'Lake Victoria Fisheries Ltd' },
  { clientNumber: '9200004', name: 'Rwenzori Coffee Ltd' },
  { clientNumber: '9200005', name: 'Namirembe Olivia Rose' },
  { clientNumber: '9200006', name: 'Okot Dennis Opiyo' },
]
/** Old accounts: only a single lookup finds them (Find in T24, and the loan merge pulling a missing borrower). */
const FOUND_BY_LOOKUP = { clientNumber: '9200007', name: 'Akena Patrick' }
const PULLED_BY_LOAN_MERGE = { clientNumber: '9200008', name: 'Birungi Esther' }

const MOPESA_LOANS = ['10UAT260001', '10UAT260002', '10UAT260003']
const MERGED_LOANS = [
  'AAUAT26001',
  'AAUAT26002',
  'AAUAT26003',
  'AAUAT26004',
  'AAUAT26005',
  'AAUAT26006',
  'LDUAT2600001',
  'LDUAT2600002',
]
const OVERDRAFTS = ['2100910001', '2100920003']
const OFF_BALANCE_ITEMS = [
  'MDUAT2600001',
  'MDUAT2600002',
  'MDUAT2600003',
  'TFUAT2600001',
  'TFUAT2600002',
  'TFUAT2600003',
]

interface ImportLog {
  id: number
  record_category: string
  imported_records: number
}

/** Every row of the T24 Imports tab (the runs that ended since the start of yesterday). */
async function importLogs(api: Api): Promise<ImportLog[]> {
  const r = await api.must(api.get('/api/v1/t24/imported-records'), 'read the T24 imports')
  return Object.values((r.body ?? {}) as Record<string, ImportLog[]>).flat()
}

async function lastLogId(api: Api): Promise<number> {
  return (await importLogs(api)).reduce((max, l) => Math.max(max, Number(l.id)), 0)
}

/** The count of the newest import log of the category written after `since` (the log id before the command started). */
async function logged(api: Api, since: number, category: string | RegExp): Promise<number> {
  const matches = (c: string) => (typeof category === 'string' ? c === category : category.test(c))
  const found = (await importLogs(api))
    .filter((l) => Number(l.id) > since && matches(l.record_category))
    .sort((a, b) => Number(b.id) - Number(a.id))
  expect(found.length, `a T24 import log "${String(category)}" written by this run`).toBeGreaterThan(0)
  return Number(found[0]!.imported_records)
}

/**
 * Runs a T24 command the way the page does and waits for its background process to end; it must end completed. A 409 (the same
 * task still running, for example one an earlier spec started) is waited out. Returns the last import log id before the start.
 */
async function runCommand(api: Api, name: string): Promise<number> {
  const since = await lastLogId(api)
  let started: Reply | undefined
  await expect
    .poll(
      async () => {
        started = await api.post(`/api/v1/t24/commands/${name}/run`, {})
        return started.status
      },
      { message: `start ${name}`, timeout: 120_000, intervals: [3000] },
    )
    .not.toBe(409)
  expect(started!.status, `start ${name}: ${JSON.stringify(started!.body)}`).toBe(202)
  const id = started!.body.process_id
  let proc: any
  await expect
    .poll(
      async () => {
        proc = (await api.get(`/api/v1/background-processes/${id}`)).body
        return proc?.status
      },
      { message: `${name} (process ${id}) ends`, timeout: 600_000, intervals: [2000] },
    )
    .toMatch(/completed|failed/)
  expect(proc.status, `${name} (process ${id}): ${proc.error_message ?? ''}`).toBe('completed')
  return since
}

async function profileOf(api: Api, clientNumber: string): Promise<any> {
  const r = await api.get('/api/v1/profiles', { search: clientNumber, page: 1 })
  return (r.body?.data ?? []).find((c: any) => c.clientNumber === clientNumber)
}

async function hasLoan(api: Api, contractCode: string): Promise<boolean> {
  const r = await api.get('/api/v1/loans', { search: contractCode })
  return (r.body?.data ?? []).some((l: any) => l.contractCode === contractCode)
}

/** The T24 Password tab: type the login and press the button. Returns the text of the message that answers. */
async function saveLoginViaUi(page: Page, password: string): Promise<string> {
  await page.goto('/t24')
  await page.getByRole('tab', { name: 'T24 Password' }).click()
  await page.locator('input[name="username"]').fill(DWH_USER)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: 'UPDATE CREDENTIALS' }).click()
  // the "processing..." loader is a popup too: the answer is the popup with an OK button
  await expect(dialog(page).locator('.swal2-confirm', { hasText: 'OK' })).toBeVisible({ timeout: 90_000 })
  const text = await dialog(page).innerText()
  await confirmDialog(page, 'OK')
  return text
}

test.describe('UAT-97: T24 extract and merge against an Oracle warehouse', () => {
  test('the run starts from a reset database and has the warehouse login to use', async () => {
    expect(
      DWH_USER && DWH_PASSWORD,
      'set UAT_DWH_USER and UAT_DWH_PASSWORD (the stand-in: edwh / edwh)',
    ).toBeTruthy()
    const api = await Api.as('admin')
    const database = await api.must(api.get('/api/v1/t24/database'), 'read the warehouse status')
    expect(
      database.body.configured,
      'no login saved yet: run backend scripts/uat/warehouse-reset.sql, then seed.sh',
    ).toBe(false)
    expect(
      await profileOf(api, NEW_CUSTOMERS[0]!.clientNumber),
      'no 92000xx profiles yet: run warehouse-reset.sql',
    ).toBeUndefined()
    await api.dispose()
  })

  test('UAT-93 with a warehouse: a wrong password is refused with the Oracle reason and nothing is saved', async ({
    page,
  }) => {
    test.setTimeout(15 * 60_000)
    const api = await Api.as('admin')
    const wrong = `${DWH_PASSWORD}-wrong`
    // Oracle may still be creating its database or loading the fixture: until then the answer is a refused connection or, for the
    // locked reader, ORA-28000. A wrong password is ORA-01017 once the database takes logins.
    await expect
      .poll(
        async () => {
          const r = await api.put('/api/v1/t24/credentials', { username: DWH_USER, password: wrong })
          return `${r.status} ${JSON.stringify(r.body)}`
        },
        { message: 'the warehouse answers a login', timeout: 12 * 60_000, intervals: [10_000] },
      )
      .toMatch(/^422 .*ORA-01017/)
    expect((await api.get('/api/v1/t24/database')).body.configured).toBe(false)

    // the same on the screen: the reason is shown and the status still says nothing is saved
    const text = await saveLoginViaUi(page, wrong)
    const form = page.locator('form').filter({ has: page.locator('input[name="password"]') })
    expect(`${text} ${await form.innerText()}`).toMatch(/ORA-01017/)
    await expect(page.getByTestId('expiry-line')).toHaveText('No credentials are saved yet.')
    expect((await api.get('/api/v1/t24/database')).body.configured).toBe(false)
    await api.dispose()
  })

  test('UAT-97: the warehouse login is saved once Oracle accepts it', async ({ page }) => {
    test.setTimeout(15 * 60_000)
    // the reader stays locked (ORA-28000) until the fixture is loaded and checked: that is the wait for EDWH.UAT_FIXTURE_READY
    await expect(async () => {
      expect(await saveLoginViaUi(page, DWH_PASSWORD)).toContain('DWH Credentials Updated Successfully')
    }).toPass({ timeout: 12 * 60_000, intervals: [10_000] })
    const api = await Api.as('admin')
    const database = (await api.get('/api/v1/t24/database')).body
    expect(database.configured).toBe(true)
    expect(String(database.username).toLowerCase()).toBe(DWH_USER.toLowerCase())
    await api.dispose()
  })

  test('UAT-97: customers extracts the accounts opened this month', async () => {
    const api = await Api.as('admin')
    const since = await runCommand(api, 'customers')
    expect(await logged(api, since, 'customers')).toBe(EXPECTED.customers)
    await api.dispose()
  })

  test('UAT-97: merge-customers creates the profiles, people and companies, shown on Profiles', async ({
    page,
  }) => {
    const api = await Api.as('admin')
    const since = await runCommand(api, 'merge-customers')
    expect(await logged(api, since, /^Merge customers @/)).toBe(EXPECTED.mergeCustomersCreated)
    for (const c of NEW_CUSTOMERS)
      expect(await profileOf(api, c.clientNumber), `profile ${c.clientNumber}`).toBeDefined()
    // the decoys are not profiles: opened today, and the other bank's customer
    expect(await profileOf(api, '9200098')).toBeUndefined()
    expect(await profileOf(api, '9200099')).toBeUndefined()
    await api.dispose()

    await page.goto('/profiles')
    for (const c of [NEW_CUSTOMERS[0]!, NEW_CUSTOMERS[2]!]) {
      await page.getByPlaceholder('Search by name, client no, FCS no...').fill(c.clientNumber)
      await expect(page.getByRole('link', { name: c.name })).toBeVisible()
    }
  })

  test('UAT-22 with a warehouse: Find in T24 pulls a client that is only in the warehouse', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: authFile('officer') })
    const page = await ctx.newPage()
    await page.goto('/profiles')
    await page.getByRole('link', { name: 'Import from T24' }).click()
    await expect(page).toHaveURL(/\/find-in-t24/)
    await page.locator('#t24-search').fill(FOUND_BY_LOOKUP.clientNumber)
    await page.getByRole('button', { name: 'Find' }).click()
    await expect(
      page.getByText('The following record has been imported from T24 to credit analyst'),
    ).toBeVisible()
    await expect(page.getByRole('row', { name: new RegExp(FOUND_BY_LOOKUP.name) })).toContainText(
      FOUND_BY_LOOKUP.clientNumber,
    )
    await ctx.close()
    const api = await Api.as('admin')
    expect(await profileOf(api, FOUND_BY_LOOKUP.clientNumber)).toBeDefined()
    await api.dispose()
  })

  test('UAT-97: loans extracts the PR4 loans after the Mopesa loans of the database link', async () => {
    const api = await Api.as('admin')
    const since = await runCommand(api, 'loans')
    expect(await logged(api, since, 'mopesa-loans')).toBe(EXPECTED.mopesaLoans)
    expect(await logged(api, since, 'loans')).toBe(EXPECTED.loans)
    await api.dispose()
    // the Mopesa step writes straight into the loan accounts
    const crb = await Api.as('crb')
    for (const code of MOPESA_LOANS) expect(await hasLoan(crb, code), `Mopesa loan ${code}`).toBe(true)
    expect(await hasLoan(crb, '10UAT260004'), 'a repaid Mopesa file is not loaded').toBe(false)
    await crb.dispose()
  })

  test('UAT-92 with a warehouse: loan-balances completes with the balances of yesterday', async () => {
    const api = await Api.as('admin')
    const since = await runCommand(api, 'loan-balances')
    expect(await logged(api, since, 'loans-balances')).toBe(EXPECTED.loanBalances)
    await api.dispose()
  })

  const extracts: { command: string; log: string; expected: number }[] = [
    { command: 'loan-repayments', log: 'loans-repayments', expected: EXPECTED.loanRepayments },
    { command: 'loans-dropped', log: 'loans-dropped', expected: EXPECTED.loansDropped },
    { command: 'overdrafts', log: 'overdraft', expected: EXPECTED.overdrafts },
    // after loan-balances: it reads the latest business date of the loan balances
    { command: 'overdraft-balances', log: 'overdraft-balances', expected: EXPECTED.overdraftBalances },
  ]
  for (const e of extracts) {
    test(`UAT-97: ${e.command} completes with ${e.expected} rows`, async () => {
      const api = await Api.as('admin')
      const since = await runCommand(api, e.command)
      expect(await logged(api, since, e.log)).toBe(e.expected)
      await api.dispose()
    })
  }

  test('UAT-97: merge-loans turns the loan extracts into loan accounts and pulls a missing borrower from the warehouse', async () => {
    const api = await Api.as('admin')
    expect(
      await profileOf(api, PULLED_BY_LOAN_MERGE.clientNumber),
      'not a profile before the merge',
    ).toBeUndefined()
    const since = await runCommand(api, 'merge-loans')
    expect(await logged(api, since, /^Merge loans @/)).toBe(EXPECTED.mergeLoansInserted)
    expect(await profileOf(api, PULLED_BY_LOAN_MERGE.clientNumber), 'pulled by the loan merge').toBeDefined()
    await api.dispose()
    const crb = await Api.as('crb')
    for (const code of MERGED_LOANS) expect(await hasLoan(crb, code), `loan ${code}`).toBe(true)
    // the Airtel float loan and the other bank's loan never become loan accounts
    expect(await hasLoan(crb, 'AAUAT26901')).toBe(false)
    expect(await hasLoan(crb, 'AAUAT26999')).toBe(false)
    await crb.dispose()
  })

  test('UAT-97: off-balance-sheet-items extracts the guarantees and letters of credit of the bank', async () => {
    const api = await Api.as('admin')
    const since = await runCommand(api, 'off-balance-sheet-items')
    expect(await logged(api, since, 'export-guarantees')).toBe(EXPECTED.guarantees)
    expect(await logged(api, since, 'export-letters-of-credit')).toBe(EXPECTED.lettersOfCredit)
    await api.dispose()
    // the rows land in daily_off_balance_sheet_extracts; the Off Balance Sheet Items list is filled from it by the scheduled task
    // import-off-balance-sheet-items, which has no command on the T24 page (UAT finding UD-33). merge-overdrafts below reads them.
  })

  test('UAT-97: merge-overdrafts turns the overdrafts and the off balance sheet items into loan accounts', async () => {
    const api = await Api.as('admin')
    await runCommand(api, 'merge-overdrafts')
    await api.dispose()
    const crb = await Api.as('crb')
    for (const code of [...OVERDRAFTS, ...OFF_BALANCE_ITEMS])
      expect(await hasLoan(crb, code), `account ${code}`).toBe(true)
    expect(await hasLoan(crb, '2100910099'), 'an account without a limit is not an overdraft').toBe(false)
    await crb.dispose()
  })
})
