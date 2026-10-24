import { readFile } from 'node:fs/promises'
import { expect, test, type Download, type Page } from '@playwright/test'
import { Api } from './support/api'
import { authFile } from './support/auth'
import { CUSTOMER } from './support/env'
import { createApplication } from './support/data'
import { buildXlsx } from './support/xlsx'
import { confirmDialog, dialog, expectAppReadable } from './support/ui'

test.use({ storageState: authFile('crb') })
// the CBA run is shared by the cases of this file and only one may be active: run them in order
test.describe.configure({ mode: 'serial' })

async function textOf(download: Download): Promise<string> {
  return readFile((await download.path()) as string, 'utf8')
}

/** Choose a report type and the From/To dates on /reports/crb. */
async function fillReportForm(
  page: Page,
  type: string,
  from = { d: '1', m: '1', y: '2026' },
  to = { d: '31', m: '10', y: '2026' },
) {
  await page.goto('/reports/crb')
  await page.locator('#file_name').selectOption(type)
  if (await page.getByTestId('from-block').isVisible()) {
    await page.locator('select[name="from_day"]').selectOption(from.d)
    await page.locator('select[name="from_month"]').selectOption(from.m)
    await page.locator('select[name="from_year"]').selectOption(from.y)
  }
  if (await page.getByTestId('to-block').isVisible()) {
    await page.locator('select[name="to_day"]').selectOption(to.d)
    await page.locator('select[name="to_month"]').selectOption(to.m)
    await page.locator('select[name="to_year"]').selectOption(to.y)
  }
}

async function downloadReport(page: Page, type: string): Promise<{ text: string; name: string }> {
  await fillReportForm(page, type)
  const download = page.waitForEvent('download')
  await page.getByTestId('download').click()
  const file = await download
  return { text: await textOf(file), name: file.suggestedFilename() }
}

const lines = (text: string) => text.split('\n').filter((l) => l.trim() !== '')

test.describe('the CRB files that are built while the request waits', () => {
  test('BC lists the bounced cheques of the period with the bureau header', async ({ page }) => {
    const { text, name } = await downloadReport(page, 'BC')
    expect(name).toBe('CB01120261031BC.csv')
    const rows = lines(text)
    expect(rows[0]).toMatch(/^"H"\|"CB011"\|"KCB Bank Uganda LTD"\|"20261031"\|"8.0"\|"\d{8}"\|"BC"$/)
    expect(rows.filter((r) => r.startsWith('"D"')).length).toBeGreaterThanOrEqual(3)
    expect(text).toContain('"000101"')
    expect(text).toContain('"2500000"')
    await expect(
      page.locator('.iziToast').filter({ hasText: 'The report has been generated.' }),
    ).toBeVisible()
  })

  test('CAP lists the applications of the period', async ({ page }) => {
    const api = await Api.as('officer')
    const app = await createApplication(api, { clientNumber: CUSTOMER.spare[0] })
    const { text, name } = await downloadReport(page, 'CAP')
    expect(name).toBe('CB01120261031CAP.csv')
    expect(text).toContain(app.creditApplicationReference)
    expect(lines(text)[0]).toContain('"CAP"')
    await api.dispose()
  })

  test('FRA, PI, PIS and IB carry the fraud record, the institution, its stakeholders and the branches', async ({
    page,
  }) => {
    const fra = await downloadReport(page, 'FRA')
    expect(fra.text).toContain('"9100016"')
    expect(fra.text).toContain('Altered cheque presented at the counter')

    const pi = await downloadReport(page, 'PI')
    expect(pi.text).toContain('KCB Bank Uganda UAT')
    expect(pi.text).toContain('LIC-UAT-001')
    // From and To are not asked for PI, PIS and IB
    await expect(page.getByTestId('from-block')).toBeHidden()
    await expect(page.getByTestId('to-block')).toBeHidden()

    const pis = await downloadReport(page, 'PIS')
    expect(pis.text).toContain('"Namukasa"')
    expect(pis.text).toContain('"Lubega"')

    const ib = await downloadReport(page, 'IB')
    expect(ib.text).toContain('"Kampala Main"')
    expect(ib.text).toContain('"Nakawa"')
  })

  test('an impossible date is refused before anything is sent', async ({ page }) => {
    await fillReportForm(page, 'BC', { d: '1', m: '1', y: '2026' }, { d: '31', m: '2', y: '2026' })
    await page.getByTestId('download').click()
    await expect(dialog(page)).toContainText('Please choose a valid To date.')
    await confirmDialog(page, 'OK')
    // CML is listed but cannot be chosen
    await expect(page.locator('#file_name option[value="CML"]')).toBeDisabled()
  })
})

test.describe('the CBA file, built in the background', () => {
  test('CBA generation is queued, followed on the Background Processes page and downloaded when it is done', async ({
    page,
  }) => {
    await fillReportForm(page, 'CBA')
    await expect(page.getByTestId('from-block')).toBeHidden()
    await expect(page.getByTestId('short-cba')).toBeVisible()
    await page.getByTestId('download').click()
    await expect(dialog(page)).toContainText(
      'CBA report generation has been queued and is running in the background.',
    )
    await page.getByRole('button', { name: 'View Progress →' }).click()
    await expect(page).toHaveURL(/\/background-processes/)
    await expectAppReadable(page)

    // the newest process is the CBA run; it ends as completed and offers the file
    const api = await Api.as('crb')
    let process: any
    await expect
      .poll(
        async () => {
          const list = await api.get('/api/v1/background-processes')
          process = (list.body.data ?? []).find((p: any) => /cba/i.test(p.type))
          return process?.status
        },
        { timeout: 150_000, intervals: [2000] },
      )
      .toMatch(/completed|failed/)
    expect(process.status, `CBA process: ${process.error_message ?? process.progress_label}`).toBe(
      'completed',
    )
    expect(process.has_file).toBe(true)

    const row = page.getByTestId(`process-${process.id}`)
    await expect(row.getByTestId('badge')).toContainText(/Completed/i)
    const download = page.waitForEvent('download')
    await row.getByTestId('download').click()
    const file = await download
    const text = await textOf(file)
    expect(file.suggestedFilename()).toMatch(/CBA/i)
    // the loans of the fixture customers are in the file, the ignored one is not
    expect(text).toContain('UATLN0001')
    expect(text).toContain('UATLN0004')
    expect(text).not.toContain('UATLN0006')
    await api.dispose()
  })

  test('a second CBA run while the first is active is refused with the reason', async () => {
    const api = await Api.as('crb')
    const first = await api.post('/api/v1/cba/generate', {
      toDate: '2026-10-31',
      version: '8.0',
      useCached: false,
    })
    expect(first.status).toBe(202)
    const second = await api.post('/api/v1/cba/generate', {
      toDate: '2026-10-31',
      version: '8.0',
      useCached: false,
    })
    expect(second.status).toBe(409)
    // let the first one end before the next case starts
    await expect
      .poll(
        async () => (await api.get('/api/v1/background-processes/' + first.body.process_id)).body.status,
        { timeout: 150_000, intervals: [2000] },
      )
      .toMatch(/completed|failed/)
    await api.dispose()
  })

  test('BS, CCG and CMC list the securities of the borrowers that are in the CBA', async ({ page }) => {
    const bs = await downloadReport(page, 'BS')
    expect(lines(bs.text).filter((l) => l.startsWith('"D"')).length).toBeGreaterThan(0)
    const ccg = await downloadReport(page, 'CCG')
    expect(lines(ccg.text).filter((l) => l.startsWith('"D"')).length).toBeGreaterThan(0)
    const cmc = await downloadReport(page, 'CMC')
    expect(cmc.text).toContain('Land Title')
    // the same file with the codes of the instruments instead of their text
    await page.goto('/reports/crb')
    await page.locator('#file_name').selectOption('CMC')
    await page.locator('input[name="use_instruments_codes"]').check()
    const download = page.waitForEvent('download')
    await page.getByTestId('download').click()
    const coded = await textOf(await download)
    expect(coded).not.toContain('Land Title')
  })

  test('the loans without collateral, guarantor or stakeholder are listed and searched', async ({ page }) => {
    await page.goto('/reports/loans-without-cmc-bs-ccg')
    await page.getByLabel('Search contract code').fill('UATLN0005')
    await expect(page.getByTestId('loan-row').filter({ hasText: 'UATLN0005' })).toHaveCount(1)
    // a loan whose borrower has a collateral is not on the list
    await page.getByLabel('Search contract code').fill('UATLN0001')
    await expect(page.getByTestId('loan-row').filter({ hasText: 'UATLN0001' })).toHaveCount(0)
  })

  test('the submission analysis describes the files generated above and can be downloaded as a PDF', async ({
    page,
  }) => {
    await page.goto('/reports/submission-analysis')
    await expect(page.getByTestId('bounced')).toContainText('Bounced Cheques')
    await expect(page.getByText(/Credit Applications|CAP/).first()).toBeVisible()
    const download = page.waitForEvent('download')
    await page.getByTestId('pdf').click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(/\.pdf$/)
    const bytes = await readFile((await file.path()) as string)
    expect(bytes.subarray(0, 4).toString()).toBe('%PDF')
  })
})

test.describe('output files', () => {
  test('the files kept after a submission are listed with their time left and download', async ({ page }) => {
    await page.goto('/output-files')
    await expect(page.getByTestId('output-row').first()).toBeVisible()
    await expect(page.getByTestId('time-left').first()).toContainText(/left|day|hour/i)
    const download = page.waitForEvent('download')
    await page
      .getByTestId('output-row')
      .first()
      .getByRole('button', { name: /^Download/ })
      .click()
    const file = await download
    expect((await readFile((await file.path()) as string)).length).toBeGreaterThan(0)
  })

  test('an Excel workbook is converted to the bureau CSV', async ({ page }) => {
    await page.goto('/output-files')
    const section = page.locator('form', { hasText: 'Excel' }).first()
    await section.locator('input[type="file"]').setInputFiles({
      name: 'feedback.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: buildXlsx([
        ['Data', 'Code'],
        ['D', 'CB011'],
        ['D', 'CB012'],
      ]),
    })
    const version = section.locator('select')
    if (await version.count()) await version.first().selectOption({ index: 1 })
    const download = page.waitForEvent('download')
    await section.getByRole('button').last().click()
    const file = await download
    const csv = await textOf(file)
    expect(csv).toContain('CB011')
  })

  test('the report pages are closed to a user without Download Crb Reports', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile('officer') })
    const page = await ctx.newPage()
    for (const path of [
      '/reports/crb',
      '/output-files',
      '/reports/loans-without-cmc-bs-ccg',
      '/reports/submission-analysis',
    ]) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/errors\/403/)
    }
    const api = await Api.as('officer')
    expect(
      (await api.post('/api/v1/reports/BC', { toDate: '2026-10-31', fromDate: '2026-01-01' })).status,
    ).toBe(403)
    expect((await api.post('/api/v1/cba/generate', { toDate: '2026-10-31' })).status).toBe(403)
    expect((await api.get('/api/v1/output-files')).status).toBe(403)
    await api.dispose()
    await ctx.close()
  })
})
