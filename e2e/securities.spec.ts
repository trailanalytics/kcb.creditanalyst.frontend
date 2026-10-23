import { expect, test, type Page } from '@playwright/test'

const me = {
  id: 1,
  firstname: 'Jane',
  lastname: 'Doe',
  name: 'Jane Doe',
  email: 'jane@kcb.test',
  role: 'crb-officer',
  branchId: null,
  permissions: [
    'View Credit Applications',
    'Manage Collateral',
    'Update Collateral',
    'Manage Guarantors',
    'Create Guarantors',
    'Update Guarantors',
    'Create Collateral',
  ],
}

const lookups: Record<string, unknown> = {
  branches: [{ id: 1, code: '001', value: 'Kampala Main' }],
  currencies: [{ code: 'USD', value: 'US Dollar' }],
  'collateral-classifications': [{ code: '1', value: 'Land and buildings' }],
  'instruments-of-claim': [
    { code: '6', value: 'Land Title' },
    { code: '2', value: 'Debentures' },
  ],
  'stakeholder-categories': [{ code: '1', value: 'Shareholder' }],
  'loan-product-types': [{ code: '2', value: 'Term Loan' }],
  'loan-purposes': [{ code: '1', value: 'Working capital' }],
  'application-statuses': [{ code: '2', value: 'Pending' }],
  nationalities: [{ code: 'UG', value: 'Uganda' }],
  'uganda-regions': [{ code: 'C', value: 'Central' }],
  'marital-statuses': [{ code: 'S', value: 'Single' }],
  'employment-types': [{ code: '1', value: 'Employed' }],
  'income-bands': [{ code: '2', value: '500,000 - 2,000,000' }],
  'salary-frequencies': [{ code: 'M', value: 'Monthly' }],
}

const json = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
})
const paged = (data: unknown[]) => ({
  data,
  current_page: 1,
  last_page: 1,
  per_page: 20,
  total: data.length,
  from: 1,
  to: data.length,
})

async function signIn(page: Page) {
  await page.route('**/api/v1/me', (r) => r.fulfill(json(me)))
  await page.route('**/api/v1/reference/**', (r) =>
    r.fulfill(json(lookups[new URL(r.request().url()).pathname.split('/').pop() ?? ''] ?? [])),
  )
}

const address = (p: string) => ({
  [`${p}CountryCode`]: 'UG',
  [`${p}Region`]: 'C',
  [`${p}District`]: 'Kampala',
  [`${p}CountyorTown`]: 'Kampala',
  [`${p}Suburb`]: 'Nakawa',
  [`${p}Parish`]: 'Butabika',
  [`${p}Village`]: 'Banda',
  [`${p}PrimaryCountryDiallingCode`]: '256',
  [`${p}PrimaryAreaDiallingCode`]: '78',
  [`${p}PrimaryTelephoneNumber`]: '6409927',
  [`${p}MobileCountryDiallingCode`]: '256',
  [`${p}MobileAreaDiallingCode`]: '78',
  [`${p}MobileNumber`]: '6409928',
  [`${p}OtherCountryDiallingCode`]: '256',
  [`${p}FlagofOwnership`]: 'O',
})

/** A customer whose profile passes the guarantor form's checks, so the test only fills the guarantee. */
const guarantorCustomer = {
  id: 77,
  clientNumber: '2000077',
  II_FCSNumber: '1234567890123',
  full_name: 'Namuli Grace  ',
  customer_type: 'Individual',
  classificationCode: '0',
  currentAccount: null,
  branchCode: '001',
  II_Nationality: 'UG',
  ...address('PCI_'),
  ...address('SCI_'),
  individual_details: {
    id: 1,
    GSCAFB_Surname: 'Namuli',
    GSCAFB_Forename1: 'Grace',
    GSCAFB_MaritalStatus: 'S',
    II_CountryID: 'CM88000000ABCD',
    II_CountryOfIssue: 'UG',
    EI_EmploymentType: '1',
    EI_PrimaryOccupation: 'Teacher',
    EI_EmployerName: 'KCB',
    EI_IncomeBand: '2',
    EI_SalaryFrequency: 'M',
    dob_variable: { day: 4, month: 7, year: 1988 },
    joined_employer_variable: { day: 1, month: 3, year: 2012 },
  },
  non_individual_details: null,
}

const borrower = {
  id: 1,
  clientNumber: '1000001',
  II_FCSNumber: null,
  full_name: 'Okello James Peter ',
  customer_type: 'Individual',
  classificationCode: '0',
  individual_details: { id: 2, II_CountryID: 'CM88000000XXXX' },
  non_individual_details: null,
}

const collateral = {
  id: 5,
  BorrowerClientNumber: '1000001',
  CollateralType: '1',
  CollateralReferenceNumber: 'KCB/CMC/2610/00001',
  CollateralDescription: 'Plot 12 Block 4',
  CollateralCurrency: 'UGX',
  CollateralOpenMarketValue: '5000000',
  CollateralForcedSaleValue: '4000000',
  CollateralExpiryDate: '20271231',
  InstrumentofClaim: 'Land Title',
  ValuationDate: '20261001',
  cmc_type: 'Land and buildings',
  is_deleted: false,
  customer: borrower,
}

test('the CMC list searches and edits a collateral', async ({ page }) => {
  await signIn(page)
  const seen: { searches: (string | null)[]; update?: Record<string, unknown> } = { searches: [] }
  await page.route('**/api/v1/collaterals?**', (r) => {
    seen.searches.push(new URL(r.request().url()).searchParams.get('search'))
    return r.fulfill(
      json(
        paged([
          collateral,
          { ...collateral, id: 6, CollateralReferenceNumber: 'KCB/CMC/2610/00002', is_deleted: true },
        ]),
      ),
    )
  })
  await page.route('**/api/v1/collaterals/5', (r) => {
    seen.update = r.request().postDataJSON()
    return r.fulfill(json({ ...collateral, CollateralOpenMarketValue: '9000000' }))
  })

  await page.goto('/cmc-list')
  await expect(page.getByText('KCB/CMC/2610/00001')).toBeVisible()
  await expect(page.getByText('UGX 5,000,000').first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Okello James Peter' }).first()).toBeVisible()
  // a record with a pending deletion request shows the flag instead of the edit icon
  await expect(page.getByLabel('Deletion requested')).toHaveCount(1)

  await page.getByRole('button', { name: 'Edit KCB/CMC/2610/00001' }).click()
  await expect(page.getByRole('heading', { name: 'Update Collateral' })).toBeVisible()
  await expect(page.locator('#cm-valuation')).toHaveValue('2026-10-01')
  await expect(page.locator('#cm-description')).toHaveValue('Plot 12 Block 4')

  // the forced sale value is required before anything is sent
  await page.locator('input[inputmode="numeric"]').first().fill('')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Please provide Collateral Forced Sale Value and try again')).toBeVisible()
  expect(seen.update).toBeUndefined()

  await page.locator('input[inputmode="numeric"]').first().fill('4500000')
  await page.locator('input[inputmode="numeric"]').nth(1).fill('9000000')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Collateral Saved Successfully')).toBeVisible()
  expect(seen.update).toMatchObject({
    CollateralType: '1',
    CollateralForcedSaleValue: '4500000',
    CollateralOpenMarketValue: '9000000',
    valuationDate: '2026-10-01',
    expiryDate: '2027-12-31',
    InstrumentofClaim: 'Land Title',
  })
  expect(seen.update).not.toHaveProperty('referenceNumber')

  await page.getByLabel('Search collateral').fill('KCB/CMC/2610/00001')
  await expect.poll(() => seen.searches.at(-1)).toBe('KCB/CMC/2610/00001')
})

test('a guarantor is added from an existing customer on a credit application and the panel is refreshed', async ({
  page,
}) => {
  await signIn(page)
  const application = {
    id: 9,
    creditApplicationReference: 'KCB/CAP/202610/000009',
    clientNumber: '1000001',
    branchCode: '001',
    creditApplicationDate: '20261023',
    Amount: '5000000',
    currency: 'UGX',
    creditAccountLoanProductType: '2',
    creditApplicationStatus: '2',
    Term: '12',
    TermPeriod: 'Month',
    termInDays: '366',
    loanPurpose: '1',
    jointAccountNumber: null,
    is_deleted: false,
    customer: borrower,
  }
  await page.route('**/api/v1/applications/9', (r) => r.fulfill(json(application)))

  let guarantors: unknown[] = []
  const posted: { create?: Record<string, unknown>; attach?: Record<string, unknown> } = {}
  const overview = () => ({
    context: {
      type: 'application',
      reference: application.creditApplicationReference,
      clientNumber: '1000001',
      editable: true,
    },
    borrower,
    collaterals: [{ ...collateral, attached: true }],
    guarantors,
    stakeholders: [],
  })
  await page.route('**/api/v1/securities?**', (r) => r.fulfill(json(overview())))
  await page.route('**/api/v1/borrowers/customers?**', (r) => r.fulfill(json(paged([guarantorCustomer]))))
  await page.route('**/api/v1/guarantors', (r) => {
    posted.create = r.request().postDataJSON()
    guarantors = [
      {
        id: 31,
        BorrowerClientNumber: '1000001',
        GuarantorClientNumber: '2000077',
        valueOfGuarantorCollateral: '7500000',
        guarateeType: '1',
        guarantorType: '0',
        is_deleted: false,
        guarantor_profile: guarantorCustomer,
        borrower,
        attached: true,
      },
    ]
    return r.fulfill(json({ id: 31 }, 201))
  })
  await page.route('**/api/v1/guarantors/attach', (r) => {
    posted.attach = r.request().postDataJSON()
    return r.fulfill(json({ message: 'Guarantor Removed From Loan Successfully', attached: false }))
  })

  await page.goto('/applications/show/9')
  // the collateral panel appears, the guarantor and stakeholder ones do not (nothing to show)
  await expect(page.getByText("Okello James Peter's Collateral")).toBeVisible()
  await expect(page.getByText("Okello James Peter's Guarantors")).toHaveCount(0)

  await page.getByRole('button', { name: 'Add Guarantors' }).click()
  await page.getByRole('menuitem', { name: 'Existing Customer' }).click()
  await expect(page.getByRole('heading', { name: 'Existing Customer' })).toBeVisible()
  await page
    .getByRole('row', { name: /Namuli Grace/ })
    .getByRole('button', { name: 'Select' })
    .click()

  await expect(page.getByRole('heading', { name: 'Add Guarantor' })).toBeVisible()
  await expect(page.getByLabel('Client number')).toHaveValue('2000077')
  // the guarantee is still empty
  await page.getByRole('button', { name: 'Save Guarantor' }).click()
  await expect(
    page.getByText('Kindly check inputs with a red border and fill in appropriately!'),
  ).toBeVisible()
  expect(posted.create).toBeUndefined()

  await page.locator('input[name="ValueOfGuarantorsCollateral"]').fill('7500000')
  await page.getByLabel('Guarantee type').selectOption('1')
  await page.getByLabel('Guarantor type').selectOption('0')
  await page.getByRole('button', { name: 'Save Guarantor' }).click()

  await expect(page.getByText('Guarantor Saved Successfully')).toBeVisible()
  expect(posted.create).toMatchObject({
    referenceNumber: 'KCB/CAP/202610/000009',
    profile_id: '77',
    ValueOfGuarantorsCollateral: '7500000',
    GuaranteeType: '1',
    GuarantorType: '0',
    GSCAFB_Surname: 'Namuli',
    branchCode: '001',
  })
  await expect(page.getByText("Okello James Peter's Guarantors")).toBeVisible()
  await expect(page.getByText('SGBG')).toHaveCount(0)
  await expect(page.getByText('2000077')).toBeVisible()

  // detaching asks first, then follows the server's answer
  const box = page.getByLabel('Attach guarantor 2000077')
  await expect(box).toBeChecked()
  await box.click()
  await page.getByRole('button', { name: 'Yes, Proceed' }).click()
  await expect(page.getByText('Guarantor Removed From Loan Successfully')).toBeVisible()
  expect(posted.attach).toEqual({ referenceNumber: 'KCB/CAP/202610/000009', guarantorId: 31 })
  await expect(box).not.toBeChecked()
})

test('the BS list shows the shareholding and opens a stakeholder for editing', async ({ page }) => {
  await signIn(page)
  await page.route('**/api/v1/me', (r) =>
    r.fulfill(json({ ...me, permissions: ['Manage Stakeholder', 'Update Stakeholder'] })),
  )
  const holder = {
    ...guarantorCustomer,
    id: 78,
    clientNumber: 'SGBS71078',
    full_name: 'Okello Holdings',
    classificationCode: '1',
    individual_details: null,
    non_individual_details: {
      id: 3,
      II_RegistrationCertificateNumber: 'REG-1',
      II_TaxIdentificationNumber: 'TIN-9',
      GSCAFB_BusinessName: 'Okello Holdings',
      GSCAFB_TradingName: 'Okello',
      reg_variable: { day: 1, month: 2, year: 2010 },
    },
  }
  await page.route('**/api/v1/stakeholders?**', (r) =>
    r.fulfill(
      json(
        paged([
          {
            id: 4,
            BorrowerClientNumber: '1000001',
            StakeholderClientNumber: 'SGBS71078',
            ShareholderPercentage: '40',
            StakeholderCategory: '1',
            category_name: 'Shareholder',
            is_deleted: false,
            stakeholder_profile: holder,
            borrower: borrower,
          },
        ]),
      ),
    ),
  )

  await page.goto('/bs-list')
  await expect(page.getByText('Shareholder [40%]')).toBeVisible()
  await expect(page.getByText('Reg No: REG-1')).toBeVisible()
  await expect(page.getByText('TIN : TIN-9')).toBeVisible()

  await page.getByRole('button', { name: 'Edit stakeholder SGBS71078' }).click()
  await expect(page.getByRole('heading', { name: 'Update Stakeholder' })).toBeVisible()
  await expect(page.getByLabel('Shareholder percentage')).toHaveValue('40')
  await expect(page.getByLabel('Classification')).toBeDisabled()
})
