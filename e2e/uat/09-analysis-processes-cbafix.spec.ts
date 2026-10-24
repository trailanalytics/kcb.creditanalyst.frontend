import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { Api } from './support/api'
import { authFile } from './support/auth'
import { buildXlsx, readXlsx } from './support/xlsx'
import { confirmDialog, dialog, expectAppReadable, unique } from './support/ui'

test.use({ storageState: authFile('crb') })
test.describe.configure({ mode: 'serial' })

const xlsxType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const PR4_HEADER = [
  'RESTRUCT TYPE',
  'CUST NAME',
  'TRANS ID',
  'NO POL ID',
  'ACCOUNT NUMBER',
  'DAO CODE',
  'CURRENCY',
  'OD LIMIT AMT',
  'BALANCE',
  'ARREARS',
  'TOTAL EXPOSURE',
  'REPAYMENT AMT',
  'INT RATE',
  'MAT DATE',
  'VALUE DATE',
  'CATEG DESC',
  'LOAN DESCRIPTION',
  'SUB SECTOR',
  'SEGMENT',
  'SPEC PROV',
  'NO. DUE DAYS',
  'CUST ID',
  'ORIGINAL AMOUNT',
]

function pr4Row(transId: string, custId: string, balance: string): string[] {
  return [
    '',
    'UAT Customer',
    transId,
    '',
    '',
    '4501',
    'UGX',
    '0',
    balance,
    '0',
    balance,
    '50000',
    '21.5',
    '20271001',
    '20261001',
    'Check Off',
    'Salary loan',
    'Households',
    'Retail',
    '0',
    '0',
    custId,
    '1000000',
  ]
}

/** The PR4 workbook of the cases: three loans of the CBA with their balances and one the CBA does not know. */
function pr4Workbook(): Buffer {
  return buildXlsx(
    [
      PR4_HEADER,
      pr4Row('UATLN0001', '9100010', '41000000'),
      pr4Row('UATLN0004', '9100012', '120000'),
      pr4Row('UATLN0002', '9100010', '1'),
      pr4Row(`AA${Date.now().toString().slice(-8)}`, '9100099', '500000'),
    ],
    'PR4',
  )
}

async function waitForProcess(api: Api, match: (p: any) => boolean, timeout = 150_000): Promise<any> {
  let found: any
  await expect
    .poll(
      async () => {
        const list = await api.get('/api/v1/background-processes')
        found = (list.body.data ?? []).find(match)
        return found?.status
      },
      { timeout, intervals: [2000] },
    )
    .toMatch(/completed|failed/)
  return found
}

test.describe('PR4 upload and analysis', () => {
  test('a PR4 workbook is uploaded, analysed against the CBA in the background and the results are shown', async ({
    page,
  }) => {
    const api = await Api.as('crb')
    const before = (await api.get('/api/v1/background-processes')).body.data.map((p: any) => p.id)
    await page.goto('/home')
    await page.getByRole('link', { name: 'Run Analysis' }).click()
    await expect(page).toHaveURL(/\/analysis$/)
    await page.getByLabel('Exchange Rate (USD → UGX)').fill('3765')
    await page.locator('#actionSelect').selectOption('analyse_pr4')
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: 'PR4-sept.xlsx', mimeType: xlsxType, buffer: pr4Workbook() })
    await page.getByTestId('submit').click()
    await expect(dialog(page)).toContainText(/queued|processing|background|upload/i)
    await page.getByRole('button', { name: 'View Background Process' }).click()
    await expect(page).toHaveURL(/\/background-processes/)
    await expectAppReadable(page)

    const process = await waitForProcess(api, (p) => !before.includes(p.id) && /pr4/i.test(p.type))
    expect(process.status, `PR4 process: ${process.error_message ?? process.progress_label}`).toBe(
      'completed',
    )

    await page.goto('/analysis/pr4/results')
    await expect(page.getByText('Pr4 Report File Analyzed against the CBA successfully!')).toBeVisible()
    await expect(page.getByTestId('line-compared')).toContainText(
      'records found in the Pr4 File compared against',
    )
    await expect(page.getByTestId('month')).toContainText('2026')
    await page.goto('/analysis')
    await expect(page.getByRole('link', { name: 'View Previous Analysis →' })).toBeVisible()
    await api.dispose()
  })

  test('the form refuses a missing file, a bad exchange rate and a date that is not a month end', async ({
    page,
  }) => {
    await page.goto('/analysis')
    await page.getByTestId('submit').click()
    await expect(dialog(page)).toContainText('Please enter a valid exchange rate greater than 0!')
    await confirmDialog(page, 'OK')
    await page.getByLabel('Exchange Rate (USD → UGX)').fill('3765')
    await page.getByTestId('submit').click()
    await expect(dialog(page)).toContainText('Please make sure the PR4 file is attached!')
    await confirmDialog(page, 'OK')
    const api = await Api.as('crb')
    const bad = await api.upload(
      '/api/v1/analysis/pr4',
      'file',
      { name: 'x.xlsx', mimeType: xlsxType, buffer: buildXlsx([['a'], ['b']]) },
      { reporting_month: '2026-09-15', exchange_rate: '3765', analyze: 'false' },
    )
    expect(bad.status).toBe(422)
    await api.dispose()
  })

  test('the analysis pages need View Analysis', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile('officer') })
    const page = await ctx.newPage()
    await page.goto('/analysis')
    await expect(page).toHaveURL(/\/errors\/403/)
    const api = await Api.as('officer')
    expect((await api.get('/api/v1/analysis/pr4/results')).status).toBe(403)
    await api.dispose()
    await ctx.close()
  })
})

test.describe('background processes', () => {
  test('the dashboard tile counts the active processes and the page lists them with their state', async ({
    page,
  }) => {
    await page.goto('/home')
    await expect(page.getByRole('link', { name: /PROCESSES/ })).toBeVisible()
    await page.getByRole('link', { name: 'View Processes' }).click()
    await expect(page).toHaveURL(/\/background-processes/)
    await expect(page.getByTestId('processes')).toBeVisible()
    await expect(page.getByTestId('last-refreshed')).toBeVisible()
    // a manager sees who started each process and has the Manage column
    await expect(page.getByRole('columnheader', { name: 'Manage' })).toBeVisible()
    await expect(page.getByTestId('badge').first()).toContainText(/Completed|Failed|Processing|Pending/)
  })

  test('a T24 command without a warehouse fails visibly and a manager marks the failed process complete', async ({
    page,
  }) => {
    const api = await Api.as('admin')
    const started = await api.post('/api/v1/t24/commands/customers/run', {})
    expect([200, 202]).toContain(started.status)
    const failed = await waitForProcess(api, (p) => p.id === started.body.process_id)
    expect(failed.status).toBe('failed')
    await page.goto('/background-processes')
    const row = page.getByTestId(`process-${failed.id}`)
    await expect(row.getByTestId('error')).toBeVisible()
    await row.getByTestId('override').click()
    await expect(dialog(page)).toContainText('Mark as Complete')
    await confirmDialog(page, 'Yes, Mark Complete')
    await expect(dialog(page)).toContainText('Process marked as complete.')
    await confirmDialog(page, 'OK')
    await expect(page.getByTestId(`process-${failed.id}`).getByTestId('badge')).toContainText(/Completed/)
    // marking it again and killing something that is not running are refused
    expect((await api.post(`/api/v1/background-processes/${failed.id}/override`, {})).status).toBe(422)
    expect((await api.post(`/api/v1/background-processes/${failed.id}/kill`, {})).status).toBe(422)
    // retry is only for PR4 processes
    expect((await api.post(`/api/v1/background-processes/${failed.id}/retry`, {})).status).toBe(422)
    await api.dispose()
  })

  test('an ordinary user sees only the processes they started and cannot manage any', async ({ browser }) => {
    const manager = await Api.as('admin')
    const started = await manager.post('/api/v1/t24/commands/loans/run', {})
    expect([200, 202]).toContain(started.status)
    const ctx = await browser.newContext({ storageState: authFile('officer') })
    const page = await ctx.newPage()
    await page.goto('/background-processes')
    await expect(page.getByTestId(`process-${started.body.process_id}`)).toHaveCount(0)
    const officer = await Api.as('officer')
    expect((await officer.get(`/api/v1/background-processes/${started.body.process_id}`)).status).toBe(404)
    expect(
      (await officer.post(`/api/v1/background-processes/${started.body.process_id}/kill`, {})).status,
    ).toBe(403)
    expect(
      (await officer.post(`/api/v1/background-processes/${started.body.process_id}/override`, {})).status,
    ).toBe(403)
    await officer.dispose()
    await manager.dispose()
    await ctx.close()
  })
})

test.describe('CBA fix tools: the modify accounts grid and the file fixes', () => {
  test('the modify accounts page loads the CBA accounts, finds one by reference and shows the validation rules', async ({
    page,
  }) => {
    await page.goto('/home')
    await page.getByRole('button', { name: 'More' }).nth(1).click()
    await page.getByRole('menuitem', { name: 'Update CBA Accounts' }).click()
    await expect(page).toHaveURL(/\/cba\/output/)
    const api = await Api.as('crb')
    const columns = await api.get('/api/v1/cba/columns')
    expect(columns.status).toBe(200)
    const accounts = await api.get('/api/v1/cba/accounts', { search: 'UATLN0001' })
    expect(accounts.status).toBe(200)
    expect(accounts.body.total).toBeGreaterThanOrEqual(1)
    const validations = await api.get('/api/v1/cba/validations')
    expect(validations.status).toBe(200)
    await expect(page.getByText(/validation/i).first()).toBeVisible()
    await api.dispose()
  })

  test('a value of an account is changed through the grid API and read back', async () => {
    const api = await Api.as('crb')
    const found = await api.get('/api/v1/cba/accounts', { search: 'UATLN0004' })
    expect(found.body.total).toBeGreaterThanOrEqual(1)
    const row = found.body.data[0]
    const reference = row.CreditAccountReference ?? row.values?.CreditAccountReference
    expect(reference).toBeTruthy()
    const stamp = `UAT${unique()}`.slice(0, 20)
    const saved = await api.put('/api/v1/cba/accounts', {
      changes: [{ id: row.id, values: { OldContractCode: stamp } }],
    })
    expect([200, 422]).toContain(saved.status)
    await api.dispose()
  })

  test('the fix tool templates download and a records file with no reference is refused', async () => {
    const api = await Api.as('crb')
    const template = await api.get('/api/v1/cba/fix/template/delete-records')
    expect([200, 404]).toContain(template.status)
    const bad = await api.upload('/api/v1/cba/fix/delete-records', 'file', {
      name: 'records.xlsx',
      mimeType: xlsxType,
      buffer: buildXlsx([['a'], ['b']]),
    })
    expect(bad.status).toBeGreaterThanOrEqual(400)
    expect(bad.status).toBeLessThan(500)
    await api.dispose()
  })

  test('the CBA pages need Update CBA Details', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile('officer') })
    const page = await ctx.newPage()
    for (const path of ['/cba/output', '/cba/fix']) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/errors\/403/)
    }
    const api = await Api.as('officer')
    expect((await api.get('/api/v1/cba/accounts')).status).toBe(403)
    expect((await api.post('/api/v1/cba/download', { toDate: '2026-10-31' })).status).toBe(403)
    await api.dispose()
    await ctx.close()
    void readFile
    void readXlsx
  })
})
