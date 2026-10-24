import { expect, test, type Page } from '@playwright/test'
import { Api } from './support/api'
import { authFile } from './support/auth'
import { CUSTOMER } from './support/env'
import { nextFromPool, uniqueName } from './support/data'
import { buildXlsx } from './support/xlsx'
import { confirmDialog, dialog, expectAppReadable, modal, money, toasts, today, unique } from './support/ui'

test.use({ storageState: authFile('crb') })

const xlsxType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** The date parts selects of the profile style forms are named by prefix; pick any real date. */
async function pickDate(
  page: Page,
  day: string,
  month: string,
  year: string,
  value = { d: '15', m: '3', y: '2020' },
) {
  await page.locator(`[name="${day}"]`).first().selectOption(value.d)
  await page.locator(`[name="${month}"]`).first().selectOption(value.m)
  await page.locator(`[name="${year}"]`).first().selectOption(value.y)
}

test.describe('bounced cheques: upload and list', () => {
  test('a bounced cheques workbook is uploaded, matched to customers and listed', async ({ page }) => {
    const cheque = `UC${Date.now().toString().slice(-9)}`
    const header = [
      'Account Number',
      'Account Balance',
      'Cheque Number',
      'Cheque Amount',
      'Currency',
      'Beneficiary',
      'Bounce Date',
      'Reason',
    ]
    const rows = [
      header,
      [
        `0100917001/${CUSTOMER.bounced}`,
        '2500',
        cheque,
        '1,750,000',
        'UGX',
        'Kato Hardware',
        '15/09/2026',
        'Insufficient funds',
      ],
      ['NOSUCHACCOUNT', '10', `${cheque}X`, '1000', 'UGX', 'Nobody', '2026-09-20', ''],
    ]
    await page.goto('/home')
    await page.getByRole('link', { name: 'Upload Bounced Cheques' }).click()
    await expect(page).toHaveURL(/\/upload-bounced-cheques/)
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: 'cheques.xlsx', mimeType: xlsxType, buffer: buildXlsx(rows) })
    await page.getByRole('button', { name: 'Upload' }).click()
    await expect(page).toHaveURL(/\/bc-list/)
    await expect(dialog(page)).toContainText('1 Bounced Cheques Uploaded Successfully')
    await expect(dialog(page)).toContainText('NOSUCHACCOUNT')
    await confirmDialog(page, 'OK')
    await expectAppReadable(page)
    await expect(page.getByRole('row', { name: new RegExp(cheque) })).toContainText('UGX 1,750,000')
    await expect(page.getByRole('row', { name: new RegExp(cheque) })).toContainText('20260915')
    // uploading the same cheque again overwrites it instead of adding a second row
    const api = await Api.as('crb')
    const again = await api.upload('/api/v1/bounced-cheques/upload', 'file', {
      name: 'again.xlsx',
      mimeType: xlsxType,
      buffer: buildXlsx([
        header,
        [
          `0100917001/${CUSTOMER.bounced}`,
          '2500',
          cheque,
          '1,800,000',
          'UGX',
          'Kato Hardware',
          '15/09/2026',
          '',
        ],
      ]),
    })
    expect(again.status).toBe(200)
    const list = await api.get('/api/v1/bounced-cheques')
    expect(list.body.data.filter((c: any) => c.ChequeNumber === cheque)).toHaveLength(1)
    await api.dispose()
  })

  test('a file that is not the template and a file with a bad row are refused and nothing is saved', async ({
    page,
  }) => {
    await page.goto('/upload-bounced-cheques')
    await page.getByRole('button', { name: 'Upload' }).click()
    await expect(dialog(page)).toContainText('No file uploaded. Please upload a Bounced Cheques Template!')
    await confirmDialog(page, 'OK')
    await page.locator('input[type="file"]').setInputFiles({
      name: 'wrong.xlsx',
      mimeType: xlsxType,
      buffer: buildXlsx([
        ['a', 'b'],
        ['1', '2'],
      ]),
    })
    await page.getByRole('button', { name: 'Upload' }).click()
    await expect(dialog(page)).toContainText('Invalid Bounced Cheques Template!')
    await confirmDialog(page, 'OK')
    const bad = buildXlsx([
      [
        'Account Number',
        'Account Balance',
        'Cheque Number',
        'Cheque Amount',
        'Currency',
        'Beneficiary',
        'Bounce Date',
        'Reason',
      ],
      [`0100917001/${CUSTOMER.bounced}`, 'abc', 'BADROW1', 'x', 'UGX', '', 'not a date', ''],
    ])
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: 'bad.xlsx', mimeType: xlsxType, buffer: bad })
    await page.getByRole('button', { name: 'Upload' }).click()
    await expect(dialog(page)).toContainText(/not a number|not a valid date/)
    await confirmDialog(page, 'OK')
    const api = await Api.as('crb')
    expect(
      (await api.get('/api/v1/bounced-cheques')).body.data.filter((c: any) => c.ChequeNumber === 'BADROW1'),
    ).toHaveLength(0)
    await api.dispose()
  })

  test('fully paid and written off accounts are uploaded and update the loans', async ({ page }) => {
    const api = await Api.as('crb')
    const paid = await nextFromPool(api, 'UATFP', 30)
    const header = [
      'Contract Code',
      'Amount',
      'Exposure',
      'STATUS',
      'Closure Date',
      'Last Payment Amount',
      'Risk',
      'Arrears Date',
      'Days In Arrears',
    ]
    await page.goto('/upload-fully-paid-or-write-offs')
    await page.locator('input[type="file"]').setInputFiles({
      name: 'fully-paid.xlsx',
      mimeType: xlsxType,
      buffer: buildXlsx([
        header,
        [paid.code, '', '', '4', '2026-09-30', '300000', '', '', ''],
        ['NOSUCHLOAN', '', '', '4', '2026-09-30', '', '', '', ''],
      ]),
    })
    await page.getByRole('button', { name: 'Upload' }).click()
    await expect(dialog(page)).toContainText('1 Fully Paid / Written Off Accounts Uploaded Successfully')
    await expect(dialog(page)).toContainText('NOSUCHLOAN')
    await confirmDialog(page, 'OK')
    const loan = (await api.get('/api/v1/loans', { search: paid.code })).body.data[0]
    expect(loan.creditAccountStatus).toBe('4')
    await api.dispose()
  })

  test('the cheque pages are closed to users without the cheque permissions', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile('officer') })
    const page = await ctx.newPage()
    await page.goto('/bc-list')
    await expect(page).toHaveURL(/\/errors\/403/)
    await page.goto('/upload-bounced-cheques')
    await expect(page).toHaveURL(/\/errors\/403/)
    const readonly = await Api.as('readonly')
    expect((await readonly.get('/api/v1/bounced-cheques')).status).toBe(200)
    expect(
      (
        await readonly.upload('/api/v1/bounced-cheques/upload', 'file', {
          name: 'x.xlsx',
          mimeType: xlsxType,
          buffer: buildXlsx([['Cheque Number']]),
        })
      ).status,
    ).toBe(403)
    await readonly.dispose()
    await ctx.close()
  })
})

test.describe('fraud (financial malpractice)', () => {
  test('a fraud record is registered for an existing customer and then changed', async ({ page }) => {
    await page.goto('/home')
    await page.getByRole('link', { name: '+ New Financial Malpractice' }).click()
    await expect(page).toHaveURL(/\/fraud/)
    await page.getByRole('button', { name: 'Register Fraud' }).click()
    await page.getByLabel('Search Customers').fill('Mukasa')
    await page
      .getByRole('row', { name: /Mukasa Francis/ })
      .getByRole('button', { name: 'Select' })
      .click()
    const form = modal(page)
    await expect(form.getByLabel('Client number', { exact: false }).first()).toBeVisible()
    await form.locator('select[name="fraudCategory"]').selectOption('2')
    await pickDate(page, 'incident_day', 'incident_month', 'incident_year', { d: '5', m: '8', y: '2026' })
    await money(form, 'saving_amount').fill('100000')
    await money(form, 'loss_amount').fill('2500000')
    await form.locator('select[name="currency"]').selectOption('UGX')
    await form.locator('textarea[name="incidentDetails"]').fill('Forged signature on a withdrawal slip')
    await form.locator('select[name="forensicInformation"]').selectOption('A')
    await form.getByRole('button', { name: 'Save' }).click()
    await expect(dialog(page)).toContainText('FRA Saved Successfully')
    await confirmDialog(page, 'OK')
    await expectAppReadable(page)
    const row = page.getByRole('row', { name: /Mukasa Francis/ })
    await expect(row).toContainText('Identity theft')
    await expect(row).toContainText('2,500,000')

    await page
      .getByRole('button', { name: `Edit ${CUSTOMER.spare[0]}` })
      .first()
      .click()
    await modal(page).locator('textarea[name="incidentDetails"]').fill('Edited incident details')
    await modal(page).getByRole('button', { name: 'Save' }).click()
    await expect(dialog(page)).toContainText('FRA Saved Successfully')
    await confirmDialog(page, 'OK')
    const api = await Api.as('crb')
    const saved = (await api.get('/api/v1/fraud')).body.data.find(
      (f: any) => f.clientNumber === CUSTOMER.spare[0],
    )
    expect(saved.IncidentDetails).toBe('Edited incident details')
    expect(saved.IncidentDate).toBe('20260805')
    await api.dispose()
  })

  test('fraud needs the fraud permissions', async ({ browser }) => {
    const readonly = await browser.newContext({ storageState: authFile('readonly') })
    const page = await readonly.newPage()
    await page.goto('/fraud')
    await expect(page.getByRole('button', { name: 'Register Fraud' })).toHaveCount(0)
    const noaccess = await Api.as('noaccess')
    expect((await noaccess.get('/api/v1/fraud')).status).toBe(403)
    expect((await noaccess.post('/api/v1/fraud', {})).status).toBe(403)
    await noaccess.dispose()
    await readonly.close()
  })
})

test.describe('participating institution, its stakeholders and the branches', () => {
  test('the institution details are changed and saved', async ({ page }) => {
    const name = `KCB Bank Uganda UAT ${unique()}`
    await page.goto('/institution')
    await expect(page.locator('input[name="InstitutionName"]')).toHaveValue(/KCB Bank Uganda UAT/)
    await page.locator('input[name="InstitutionName"]').fill(name)
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(dialog(page)).toContainText('Institution details Saved Successfully')
    await confirmDialog(page, 'OK')
    await page.reload()
    await expect(page.locator('input[name="InstitutionName"]')).toHaveValue(name)
    // a required field left empty is marked
    await page.locator('input[name="LicenseNumber"]').fill('')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(toasts(page).filter({ hasText: 'Kindly check inputs with a red border' })).toBeVisible()
  })

  test('a PI stakeholder is added from an existing profile and its share is changed', async ({ page }) => {
    await page.goto('/home')
    await page.getByRole('link', { name: '+ New PI Stakeholder' }).click()
    await expect(page).toHaveURL(/\/pis/)
    await page.getByRole('button', { name: 'New PIS ▾' }).click()
    await page.getByRole('menuitem', { name: 'Existing Profile' }).click()
    await page.getByLabel('Search Customers').fill('Ochieng')
    await page
      .getByRole('row', { name: /Ochieng Brian/ })
      .getByRole('button', { name: 'Use' })
      .click()
    await expect(page).toHaveURL(/\/proflie\/new\/pis\?profile=/)
    await page.locator('input[name="ShareholderPercentage"]').fill('7')
    await page.locator('select[name="StakeholderCategory"]').selectOption('2')
    await page.locator('select[name="branchCode"]').selectOption('001')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(dialog(page)).toContainText('PIS Saved Successfully')
    await confirmDialog(page, 'OK')
    await expect(page).toHaveURL(/\/pis$/)
    const row = page.getByRole('row', { name: /Ochieng Brian/ }).first()
    await expect(row).toContainText('7 %')

    await row.getByRole('link').first().click()
    await expect(page).toHaveURL(/\/edit\/pis\/\d+/)
    await page.locator('input[name="ShareholderPercentage"]').fill('8')
    await page.getByRole('button', { name: 'Save' }).click()
    await confirmDialog(page, 'OK')
    await expect(page.getByRole('row', { name: /Ochieng Brian/ }).first()).toContainText('8 %')
  })

  test('a branch is created, changed and customers are moved between two branches', async ({ page }) => {
    const code = `T${Date.now().toString().slice(-6)}`
    const name = `UAT Branch ${unique()}`
    await page.goto('/branches')
    await page.getByRole('link', { name: 'New Branch' }).click()
    await page.locator('input[name="BranchName"]').fill(name)
    await page.locator('input[name="bankBranchCode"]').fill(code)
    await page.locator('input[name="BranchIdentificationCode"]').fill(code)
    await page.locator('select[name="BranchType"]').selectOption('1')
    await pickDate(page, 'openDay', 'openMonth', 'openYear')
    // address: the same required values as the other forms
    const setAll = async (n: string, v: string) => {
      const el = page.locator(`[name="${n}"]`).first()
      if ((await el.evaluate((x) => x.tagName)) === 'SELECT') await el.selectOption(v)
      else await el.fill(v)
    }
    for (const [n, v] of Object.entries({
      PCI_CountryCode: 'UG',
      PCI_Region: 'C',
      PCI_District: 'Kampala',
      PCI_CountyorTown: 'Kampala',
      PCI_Suburb: 'Nakawa',
      PCI_Parish: 'Butabika',
      PCI_Village: 'Banda',
      PCI_PrimaryCountryDiallingCode: '256',
      PCI_PrimaryAreaDiallingCode: '41',
      PCI_PrimaryTelephoneNumber: '6409927',
      PCI_MobileCountryDiallingCode: '256',
      PCI_MobileAreaDiallingCode: '78',
      PCI_MobileNumber: '6409928',
      PCI_OtherCountryDiallingCode: '256',
      PCI_FlagofOwnership: 'O',
    }))
      await setAll(n, v)
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(dialog(page)).toContainText('Branch Created Successfully')
    await confirmDialog(page, 'OK')
    await expect(page).toHaveURL(/\/branches$/)
    const row = page.getByRole('row', { name: new RegExp(name) })
    await expect(row).toContainText(code)

    // changed
    await row.getByRole('link', { name: `Edit ${name}` }).click()
    await page.locator('input[name="BranchName"]').fill(`${name} renamed`)
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(dialog(page)).toContainText('Branch Updated Successfully')
    await confirmDialog(page, 'OK')
    await expect(page.getByRole('row', { name: new RegExp(`${name} renamed`) })).toBeVisible()

    // two customers of the UAT source branch are moved to the target branch and back again
    await page.getByRole('button', { name: 'Transfer Branch Customers' }).click()
    await page.getByLabel('From branch').selectOption('U01')
    await page.getByLabel('To branch').selectOption('U02')
    await page.getByRole('button', { name: 'Begin Transfer' }).click()
    await expect(dialog(page)).toContainText('transfer customers')
    await confirmDialog(page, 'Yes, Proceed!')
    await expect(dialog(page)).toContainText(/transferred|Transferred|customers/)
    await confirmDialog(page, 'OK')
    await expectAppReadable(page)
    const api = await Api.as('crb')
    const moved = await api.get('/api/v1/borrowers/customers', { search: 'Transfera' })
    expect(moved.body.data[0].branchCode).toBe('U02')
    await api
      .post('/api/v1/bank-branches/transfer-customers', { from: 'U02', to: 'U01' })
      .catch(() => undefined)
    await api.dispose()
  })

  test('a branch is asked for deletion and a checker removes it', async ({ page }) => {
    const code = `D${Date.now().toString().slice(-6)}`
    const api = await Api.as('crb')
    const checker = await Api.as('checker')
    const created = await api.post('/api/v1/bank-branches', {
      BranchName: `UAT Delete ${unique()}`,
      bankBranchCode: code,
      BranchIdentificationCode: code,
      BranchType: '1',
      openDay: '1',
      openMonth: '1',
      openYear: '2020',
      PCI_CountryCode: 'UG',
      PCI_Region: 'C',
      PCI_District: 'Kampala',
      PCI_CountyorTown: 'Kampala',
      PCI_Suburb: 'Nakawa',
      PCI_Parish: 'Butabika',
      PCI_Village: 'Banda',
      PCI_PrimaryCountryDiallingCode: '256',
      PCI_PrimaryAreaDiallingCode: '41',
      PCI_PrimaryTelephoneNumber: '6409927',
      PCI_MobileCountryDiallingCode: '256',
      PCI_MobileAreaDiallingCode: '78',
      PCI_MobileNumber: '6409928',
      PCI_OtherCountryDiallingCode: '256',
      PCI_FlagofOwnership: 'O',
    })
    expect(created.status).toBe(201)
    const branch = created.body
    await page.goto('/branches')
    await page.getByRole('button', { name: `Request deletion of ${branch.BranchName}` }).click()
    await page.locator('.swal2-textarea').fill('Branch closed')
    await confirmDialog(page, 'Yes, Proceed!')
    await confirmDialog(page, 'OK')
    await expect(
      page.locator('[title="This record has been requested to be deleted!"]').first(),
    ).toBeVisible()
    const list = await api.get('/api/v1/deletion-requests', { search: String(branch.id), status: 0 })
    const request = list.body.data.find(
      (r: any) => r.table_name === 'bank_branches' && r.record_id === branch.id,
    )
    expect((await checker.post(`/api/v1/deletion-requests/${request.id}/approve`, {})).status).toBe(200)
    expect((await api.get(`/api/v1/bank-branches/${branch.id}`)).status).toBe(404)
    await api.dispose()
    await checker.dispose()
    void uniqueName
    void today
  })

  test('the institution, PIS and branch pages follow their permissions', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile('noaccess') })
    const page = await ctx.newPage()
    for (const path of ['/institution', '/pis', '/branches', '/branches/new']) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/errors\/403/)
    }
    const api = await Api.as('noaccess')
    for (const path of ['/api/v1/institution', '/api/v1/pi-stakeholders', '/api/v1/bank-branches'])
      expect((await api.get(path)).status).toBe(403)
    await api.dispose()
    await ctx.close()
  })
})
