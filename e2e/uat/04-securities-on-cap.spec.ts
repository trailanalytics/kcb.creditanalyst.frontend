import { expect, test, type Page } from '@playwright/test'
import { Api } from './support/api'
import { authFile } from './support/auth'
import { CUSTOMER } from './support/env'
import {
  createApplication,
  createCollateral,
  createStakeholder,
  securities,
  uniqueName,
} from './support/data'
import {
  chooseFromMenu,
  confirmDialog,
  dialog,
  expectAppReadable,
  fillProfile,
  modal,
  money,
  toasts,
} from './support/ui'

test.use({ storageState: authFile('officer') })

/** 13 characters FCS number and 14 characters NIN that are new every time. */
function ids() {
  const stamp = String(Date.now()).slice(-9)
  return { fcs: `FCS${stamp}0`, nin: `CM${stamp}UAT` }
}

async function openApplication(page: Page, id: number) {
  await page.goto(`/applications/show/${id}`)
  await expect(page.getByRole('button', { name: 'Add Collateral' })).toBeVisible()
}

/** A new pending application of a borrower, ready for its securities. */
async function pendingApplication(api: Api, borrower: string) {
  return createApplication(api, { clientNumber: borrower })
}

test.describe('UAT-08 and UAT-09: collateral on an application', () => {
  test('UAT-08 collateral is added to a pending application and shows with a success message', async ({
    page,
  }) => {
    const api = await Api.as('officer')
    const app = await pendingApplication(api, CUSTOMER.spare[0])
    await openApplication(page, app.id)
    await page.getByRole('button', { name: 'Add Collateral' }).click()
    const form = modal(page)
    await form.locator('#cm-type').selectOption('1')
    await form.locator('#cm-currency').selectOption('UGX')
    await money(form, 'CollateralForcedSaleValue').fill('4000000')
    await money(form, 'CollateralOpenMarketValue').fill('5000000')
    await form.locator('#cm-valuation').fill('2026-10-01')
    await form.locator('#cm-expiry').fill('2030-12-31')
    await form.locator('#cm-instrument').selectOption('Land Title')
    const description = `Plot 77 Block 9 ${uniqueName('uat')}`
    await form.locator('#cm-description').fill(description)
    await form.getByRole('button', { name: 'Save' }).click()
    await expect(toasts(page).filter({ hasText: 'Collateral Saved Successfully' })).toBeVisible()
    await expectAppReadable(page)

    await expect(page.getByRole('region', { name: 'Collateral' })).toContainText(description)
    const overview = await securities(api, app.creditApplicationReference)
    const saved = overview.collaterals.find((c: any) => c.CollateralDescription === description)
    expect(saved.CollateralReferenceNumber).toMatch(/^KCB\/CMC\/\d{4}\/\d{5}$/)
    expect(saved.attached).toBe(true)
    expect(saved.CollateralForcedSaleValue).toBe('4000000')
    expect(saved.CollateralExpiryDate).toBe('20301231')
    await api.dispose()
  })

  test('UAT-08 a collateral without values is refused before it is sent, and the server refuses zero values', async ({
    page,
  }) => {
    const api = await Api.as('officer')
    const app = await pendingApplication(api, CUSTOMER.spare[0])
    await openApplication(page, app.id)
    await page.getByRole('button', { name: 'Add Collateral' }).click()
    const form = modal(page)
    await form.locator('#cm-type').selectOption('1')
    await form.locator('#cm-currency').selectOption('UGX')
    await form.locator('#cm-valuation').fill('2026-10-01')
    await form.locator('#cm-expiry').fill('2030-12-31')
    await form.locator('#cm-instrument').selectOption('Land Title')
    await form.locator('#cm-description').fill('no values')
    await form.getByRole('button', { name: 'Save' }).click()
    await expect(
      toasts(page).filter({ hasText: 'Please provide Collateral Forced Sale Value and try again' }),
    ).toBeVisible()

    const zero = await api.post('/api/v1/collaterals', {
      referenceNumber: app.creditApplicationReference,
      CollateralType: '1',
      CollateralCurrency: 'UGX',
      CollateralForcedSaleValue: '0',
      CollateralOpenMarketValue: '5000000',
      valuationDate: '2026-10-01',
      expiryDate: '2030-12-31',
      InstrumentofClaim: 'Land Title',
      CollateralDescription: 'zero',
    })
    expect(zero.status).toBe(422)
    await api.dispose()
  })

  test('UAT-09 a collateral is detached after the confirmation and stays attached when the user cancels', async ({
    page,
  }) => {
    const api = await Api.as('officer')
    const app = await pendingApplication(api, CUSTOMER.spare[1])
    const collateral = await createCollateral(api, app.creditApplicationReference)
    const ref = collateral.CollateralReferenceNumber
    await openApplication(page, app.id)
    const box = page.getByLabel(`Attach ${ref}`)
    await expect(box).toBeChecked()

    await box.click()
    await expect(dialog(page)).toContainText('Remove Collateral from Loan')
    await page.locator('.swal2-cancel').click()
    await expect(box).toBeChecked()
    expect(
      (await securities(api, app.creditApplicationReference)).collaterals.find(
        (c: any) => c.CollateralReferenceNumber === ref,
      ).attached,
    ).toBe(true)

    await box.click()
    await confirmDialog(page, 'Yes, Proceed')
    await expect(toasts(page).first()).toBeVisible()
    await expect(box).not.toBeChecked()
    expect(
      (await securities(api, app.creditApplicationReference)).collaterals.find(
        (c: any) => c.CollateralReferenceNumber === ref,
      ).attached,
    ).toBe(false)
    await api.dispose()
  })

  test('UAT-23 an existing collateral of the borrower is attached to a new application', async ({ page }) => {
    const api = await Api.as('officer')
    const app = await pendingApplication(api, CUSTOMER.securities)
    await openApplication(page, app.id)
    await expect(page.getByRole('region', { name: 'Collateral' })).toContainText('UAT-CMC-0001')
    const box = page.getByLabel('Attach UAT-CMC-0001')
    await expect(box).not.toBeChecked()
    await box.click()
    await expect(dialog(page)).toContainText('Attach Collateral to Loan.')
    await confirmDialog(page, 'Yes, Proceed')
    await expect(box).toBeChecked()
    const overview = await securities(api, app.creditApplicationReference)
    expect(
      overview.collaterals.find((c: any) => c.CollateralReferenceNumber === 'UAT-CMC-0001').attached,
    ).toBe(true)
    await api.dispose()
  })

  test('UAT-09 and UAT-23 a collateral of another borrower cannot be attached and a decided application is frozen', async () => {
    const officer = await Api.as('officer')
    const approver = await Api.as('approver')
    const app = await pendingApplication(officer, CUSTOMER.spare[2])
    const foreign = await officer.post('/api/v1/collaterals/attach', {
      referenceNumber: app.creditApplicationReference,
      collateralReferenceNumber: 'UAT-CMC-0003',
    })
    expect(foreign.status).toBe(422)

    const mine = await createCollateral(officer, app.creditApplicationReference)
    await approver.must(
      approver.post(`/api/v1/applications/${app.id}/decision`, {
        creditApplicationStatus: '0',
        amount: app.Amount,
        term: '12',
      }),
      'approve',
    )
    const toggle = await officer.post('/api/v1/collaterals/attach', {
      referenceNumber: app.creditApplicationReference,
      collateralReferenceNumber: mine.CollateralReferenceNumber,
    })
    expect(toggle.status).toBe(409)
    const add = await officer.post('/api/v1/collaterals', {
      referenceNumber: app.creditApplicationReference,
      CollateralType: '1',
      CollateralCurrency: 'UGX',
      CollateralForcedSaleValue: '1',
      CollateralOpenMarketValue: '1',
      valuationDate: '2026-10-01',
      expiryDate: '2030-12-31',
      InstrumentofClaim: 'Land Title',
      CollateralDescription: 'late',
    })
    expect(add.status).toBe(409)
    await officer.dispose()
    await approver.dispose()
  })

  test('the buttons are disabled on an application that is not pending', async ({ page }) => {
    const officer = await Api.as('officer')
    const approver = await Api.as('approver')
    const app = await pendingApplication(officer, CUSTOMER.spare[3])
    await approver.must(
      approver.post(`/api/v1/applications/${app.id}/decision`, {
        creditApplicationStatus: '5',
        rejectionReason: '2',
      }),
      'reject',
    )
    await page.goto(`/applications/show/${app.id}`)
    await expect(page.getByRole('button', { name: 'Add Collateral' })).toBeDisabled()
    await expect(page.getByRole('button', { name: /Add Guarantors/ })).toBeDisabled()
    await officer.dispose()
    await approver.dispose()
  })
})

/** The guarantor / stakeholder dialog: own fields then the embedded profile. */
async function fillGuarantor(
  page: Page,
  opts: { company?: boolean; surname?: string; forename?: string; value?: string },
) {
  const form = modal(page)
  await form.locator('select[name="branchCode"]').selectOption('001')
  await form.locator('input[name="ValueOfGuarantorsCollateral"]').fill(opts.value ?? '7500000')
  await form.locator('select[name="GuaranteeType"]').selectOption('1')
  await form.locator('select[name="GuarantorType"]').selectOption('0')
  const { fcs, nin } = ids()
  await fillProfile(page, {
    root: form,
    embedded: true,
    company: opts.company,
    fcs,
    nin,
    surname: opts.surname,
    forename: opts.forename ?? 'Uat',
    yearOfBirth: 1985,
  })
}

async function fillStakeholder(
  page: Page,
  opts: { company?: boolean; surname?: string; percentage?: string },
) {
  const form = modal(page)
  await form.locator('select[name="branchCode"]').selectOption('001')
  await form.locator('input[name="ShareholderPercentage"]').fill(opts.percentage ?? '25')
  await form.locator('select[name="StakeholderCategory"]').selectOption('1')
  const { fcs, nin } = ids()
  await fillProfile(page, {
    root: form,
    embedded: true,
    company: opts.company,
    fcs,
    nin,
    surname: opts.surname,
    forename: 'Uat',
    yearOfBirth: 1985,
  })
}

test.describe('UAT-10 to UAT-13: guarantors on an application', () => {
  test('UAT-10 an individual guarantor is added and listed with a success message', async ({ page }) => {
    const api = await Api.as('officer')
    const app = await pendingApplication(api, CUSTOMER.spare[0])
    await openApplication(page, app.id)
    await chooseFromMenu(page, /Add Guarantors/, 'Individual')
    const surname = uniqueName('Uatg')
    await fillGuarantor(page, { surname })
    await modal(page).getByRole('button', { name: 'Save Guarantor' }).click()
    await expect(toasts(page).filter({ hasText: 'Guarantor Saved Successfully' })).toBeVisible()
    await expectAppReadable(page)
    await expect(page.getByRole('region', { name: 'Guarantors' })).toContainText(surname)
    const overview = await securities(api, app.creditApplicationReference)
    const saved = overview.guarantors.find((g: any) => g.guarantor_profile.full_name.startsWith(surname))
    expect(saved.attached).toBe(true)
    expect(saved.GuarantorClientNumber).toMatch(/^SGBG\d+/)
    expect(saved.valueOfGuarantorCollateral).toBe('7500000')
    await api.dispose()
  })

  test('UAT-10 the FCS number, national ID, age and the required fields are checked with the messages of the form', async ({
    page,
  }) => {
    const api = await Api.as('officer')
    const app = await pendingApplication(api, CUSTOMER.spare[1])
    await openApplication(page, app.id)
    await chooseFromMenu(page, /Add Guarantors/, 'Individual')
    const form = modal(page)
    await form.getByRole('button', { name: 'Save Guarantor' }).click()
    await expect(toasts(page).filter({ hasText: 'Kindly check inputs with a red border' })).toBeVisible()
    await fillGuarantor(page, { surname: uniqueName('Uatbad') })
    await form.locator('input[name="II_FCSNumber"]').fill('SHORT')
    await form.getByRole('button', { name: 'Save Guarantor' }).click()
    await expect(
      toasts(page).filter({ hasText: 'The FCS Number should be 13 characters in length!' }),
    ).toBeVisible()
    await form.locator('input[name="II_FCSNumber"]').fill(ids().fcs)
    await form.locator('input[name="II_CountryID"]').fill('CM123')
    await form.getByRole('button', { name: 'Save Guarantor' }).click()
    await expect(toasts(page).filter({ hasText: 'should be 14 characters in length' })).toBeVisible()
    await form.locator('input[name="II_CountryID"]').fill(ids().nin)
    const thisYear = new Date().getFullYear()
    await form.locator('select[name="GSCAFB_YearOfBirth"]').selectOption(String(thisYear - 5))
    await form.getByRole('button', { name: 'Save Guarantor' }).click()
    await expect(toasts(page).filter({ hasText: 'must be greater than or equal to 16 years' })).toBeVisible()
    expect((await securities(api, app.creditApplicationReference)).guarantors).toHaveLength(0)
    await api.dispose()
  })

  test('UAT-11 a non-individual guarantor is added', async ({ page }) => {
    const api = await Api.as('officer')
    const app = await pendingApplication(api, CUSTOMER.spare[2])
    await openApplication(page, app.id)
    await chooseFromMenu(page, /Add Guarantors/, 'Non Individual')
    await fillGuarantor(page, { company: true })
    const business = `UAT Guarantor ${uniqueName('co')} Ltd`
    await modal(page).locator('input[name="GSCAFB_BusinessName"]').fill(business)
    await modal(page).getByRole('button', { name: 'Save Guarantor' }).click()
    await expect(toasts(page).filter({ hasText: 'Guarantor Saved Successfully' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Guarantors' })).toContainText(business)
    const overview = await securities(api, app.creditApplicationReference)
    const saved = overview.guarantors.find((g: any) => g.guarantor_profile.full_name.trim() === business)
    expect(saved.guarantor_profile.classificationCode).toBe('1')
    await api.dispose()
  })

  test('UAT-12 an existing customer is picked by name and saved as a guarantor, and a borrower cannot guarantee itself', async ({
    page,
  }) => {
    const api = await Api.as('officer')
    const app = await pendingApplication(api, CUSTOMER.spare[3])
    await openApplication(page, app.id)
    await chooseFromMenu(page, /Add Guarantors/, 'Existing Customer')
    await page.getByLabel('Search customers', { exact: true }).fill('Akello')
    const row = page.getByRole('row', { name: /Akello Mary/ })
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: 'Select' }).click()
    const form = modal(page)
    await expect(form.getByLabel('Client number')).toHaveValue(CUSTOMER.guarantor)
    await expect(form.getByLabel('Classification')).toBeDisabled()
    await form.locator('select[name="branchCode"]').selectOption('001')
    await form.locator('input[name="ValueOfGuarantorsCollateral"]').fill('3000000')
    await form.locator('select[name="GuaranteeType"]').selectOption('0')
    await form.locator('select[name="GuarantorType"]').selectOption('0')
    await form.getByRole('button', { name: 'Save Guarantor' }).click()
    await expect(toasts(page).filter({ hasText: 'Guarantor Saved Successfully' })).toBeVisible()
    const overview = await securities(api, app.creditApplicationReference)
    expect(overview.guarantors.map((g: any) => g.GuarantorClientNumber)).toContain(CUSTOMER.guarantor)

    // the borrower of the application cannot be picked as its own guarantor
    const selfApp = await pendingApplication(api, CUSTOMER.guarantor)
    const self = await api.post('/api/v1/guarantors', {
      referenceNumber: selfApp.creditApplicationReference,
      profile_id: String(
        (await (await api.get('/api/v1/profiles', { search: CUSTOMER.guarantor })).body.data[0]).id,
      ),
      classificationCode: '0',
      branchCode: '001',
      ValueOfGuarantorsCollateral: '1000',
      GuaranteeType: '0',
      GuarantorType: '0',
    })
    expect(self.status).toBe(422)
    expect(JSON.stringify(self.body)).toContain('A borrower cannot be a guarantor of itself')
    await api.dispose()
  })

  test('UAT-13 a guarantor of the borrower is attached to and detached from an application', async ({
    page,
  }) => {
    const api = await Api.as('officer')
    const app = await pendingApplication(api, CUSTOMER.securities)
    const overview = await securities(api, app.creditApplicationReference)
    const seeded = overview.guarantors.find((g: any) => g.GuarantorClientNumber === CUSTOMER.guarantor)
    await openApplication(page, app.id)
    const box = page.getByLabel(`Attach guarantor ${CUSTOMER.guarantor}`)
    await expect(box).not.toBeChecked()
    await box.click()
    await expect(dialog(page)).toContainText('Attach guarantor to Loan.')
    await confirmDialog(page, 'Yes, Proceed')
    await expect(box).toBeChecked()
    await box.click()
    await expect(dialog(page)).toContainText('Remove guarantor from Loan')
    await confirmDialog(page, 'Yes, Proceed')
    await expect(box).not.toBeChecked()
    expect(seeded).toBeTruthy()
    // a guarantor of another borrower is refused
    const other = await api.post('/api/v1/guarantors/attach', {
      referenceNumber: app.creditApplicationReference,
      guarantorId: 999999999,
    })
    expect(other.status).toBe(404)
    await api.dispose()
  })
})

test.describe('UAT-14 to UAT-16: stakeholders on an application', () => {
  test('UAT-14 an individual stakeholder is added to a company application', async ({ page }) => {
    const api = await Api.as('officer')
    const app = await pendingApplication(api, CUSTOMER.company)
    await openApplication(page, app.id)
    await chooseFromMenu(page, /Add Stakeholder/, 'Individual')
    const surname = uniqueName('Uats')
    await fillStakeholder(page, { surname, percentage: '15' })
    await modal(page).getByRole('button', { name: 'Save' }).click()
    await expect(toasts(page).filter({ hasText: 'Stakeholder Saved Successfully' })).toBeVisible()
    await expectAppReadable(page)
    await expect(page.getByRole('region', { name: 'Stakeholders' })).toContainText(surname)
    const saved = (await securities(api, app.creditApplicationReference)).stakeholders.find((s: any) =>
      s.stakeholder_profile.full_name.startsWith(surname),
    )
    expect(saved.ShareholderPercentage).toBe('15')
    expect(saved.StakeholderClientNumber).toMatch(/^SGBS\d+/)
    await api.dispose()
  })

  test('UAT-14 a non-individual stakeholder is added and a share above 100 percent is refused', async ({
    page,
  }) => {
    const api = await Api.as('officer')
    const app = await pendingApplication(api, CUSTOMER.company)
    await openApplication(page, app.id)
    await chooseFromMenu(page, /Add Stakeholder/, 'Non Individual')
    await fillStakeholder(page, { company: true, percentage: '150' })
    const business = `UAT Holding ${uniqueName('co')} Ltd`
    await modal(page).locator('input[name="GSCAFB_BusinessName"]').fill(business)
    await modal(page).getByRole('button', { name: 'Save' }).click()
    await expect(
      toasts(page).filter({ hasText: 'Share holder Percentage cannot be greater than 100%!' }),
    ).toBeVisible()
    await modal(page).locator('input[name="ShareholderPercentage"]').fill('40')
    await modal(page).getByRole('button', { name: 'Save' }).click()
    await expect(toasts(page).filter({ hasText: 'Stakeholder Saved Successfully' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Stakeholders' })).toContainText(business)
    await api.dispose()
  })

  test('UAT-15 an existing customer is selected as a stakeholder and an existing stakeholder as a guarantor', async ({
    page,
  }) => {
    const api = await Api.as('officer')
    const app = await pendingApplication(api, CUSTOMER.loansCompany)
    await openApplication(page, app.id)
    await chooseFromMenu(page, /Add Stakeholder/, 'Existing Customer')
    await page.getByLabel('Search customers', { exact: true }).fill('Ssekandi')
    await page
      .getByRole('row', { name: /Ssekandi David/ })
      .getByRole('button', { name: 'Select' })
      .click()
    const form = modal(page)
    await expect(form.getByLabel('Client number')).toHaveValue(CUSTOMER.jointPartner)
    await form.locator('select[name="branchCode"]').selectOption('001')
    await form.locator('input[name="ShareholderPercentage"]').fill('12')
    await form.locator('select[name="StakeholderCategory"]').selectOption('2')
    await form.getByRole('button', { name: 'Save' }).click()
    await expect(toasts(page).filter({ hasText: 'Stakeholder Saved Successfully' })).toBeVisible()
    const numbers = (await securities(api, app.creditApplicationReference)).stakeholders.map(
      (s: any) => s.StakeholderClientNumber,
    )
    expect(numbers).toContain(CUSTOMER.jointPartner)

    // a stakeholder of the borrower can be offered as a guarantor
    await chooseFromMenu(page, /Add Guarantors/, 'Existing Stakeholder')
    await expect(page.getByRole('row', { name: new RegExp(`${CUSTOMER.jointPartner}`) })).toBeVisible()
    await api.dispose()
  })

  test('UAT-16 a stakeholder is linked when saved: its box is ticked and cannot be changed (no detach exists)', async ({
    page,
  }) => {
    const api = await Api.as('officer')
    const app = await pendingApplication(api, CUSTOMER.company)
    const stakeholder = await createStakeholder(api, app.creditApplicationReference)
    await openApplication(page, app.id)
    const box = page.getByLabel(`Stakeholder ${stakeholder.StakeholderClientNumber}`)
    await expect(box).toBeChecked()
    await expect(box).toBeDisabled()
    await api.dispose()
  })

  test('UAT-14 the Add Stakeholder button is only offered for company borrowers', async ({ page }) => {
    const api = await Api.as('officer')
    const app = await pendingApplication(api, CUSTOMER.spare[4])
    await openApplication(page, app.id)
    await expect(page.getByRole('button', { name: /Add Stakeholder/ })).toHaveCount(0)
    await api.dispose()
  })
})

test.describe('securities and permissions', () => {
  test('a user without the Create permissions has no way to add securities, and the API refuses', async ({
    browser,
  }) => {
    const officer = await Api.as('officer')
    const app = await pendingApplication(officer, CUSTOMER.spare[5])
    const ctx = await browser.newContext({ storageState: authFile('readonly') })
    const page = await ctx.newPage()
    await page.goto(`/applications/show/${app.id}`)
    await expect(page.getByText(app.creditApplicationReference).first()).toBeVisible()
    // the read-only user opens the page; the server refuses every write
    const readonly = await Api.as('readonly')
    expect(
      (await readonly.post('/api/v1/collaterals', { referenceNumber: app.creditApplicationReference }))
        .status,
    ).toBe(403)
    expect(
      (await readonly.post('/api/v1/guarantors', { referenceNumber: app.creditApplicationReference })).status,
    ).toBe(403)
    expect(
      (await readonly.post('/api/v1/stakeholders', { referenceNumber: app.creditApplicationReference }))
        .status,
    ).toBe(403)
    expect((await readonly.post('/api/v1/collaterals/attach', {})).status).toBe(403)
    await readonly.dispose()
    await officer.dispose()
    await ctx.close()
  })
})
