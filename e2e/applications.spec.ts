import { expect, test, type Page } from '@playwright/test'

const me = {
  id: 1,
  firstname: 'Jane',
  lastname: 'Doe',
  name: 'Jane Doe',
  email: 'jane@kcb.test',
  role: 'crb-officer',
  branchId: null,
  permissions: ['Create Applications', 'View Credit Applications', 'View Profiles', 'Search Profiles'],
}

const lookups: Record<string, unknown> = {
  branches: [{ id: 1, code: '001', value: 'Kampala Main' }],
  'loan-product-types': [{ code: '2', value: 'Term Loan' }],
  'loan-purposes': [{ code: '1', value: 'Working capital' }],
  currencies: [{ code: 'USD', value: 'US Dollar' }],
  nationalities: [{ code: 'UG', value: 'Uganda' }],
  'uganda-regions': [{ code: 'C', value: 'Central' }],
  'marital-statuses': [{ code: 'S', value: 'Single' }],
  'employment-types': [{ code: '1', value: 'Employed' }],
  'income-bands': [{ code: '2', value: '500,000 - 2,000,000' }],
  'salary-frequencies': [{ code: 'M', value: 'Monthly' }],
  'business-types': [],
  industries: [],
  'country-dialing-codes': [],
  'application-statuses': [{ code: '2', value: 'Pending' }],
  'rejection-reasons': [],
}

/** A customer whose profile already passes the form's checks, so the test only has to fill the loan. */
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
const customer = {
  id: 1,
  clientNumber: '1000001',
  II_FCSNumber: null,
  full_name: 'Okello James Peter ',
  customer_type: 'Individual',
  classificationCode: '0',
  currentAccount: null,
  branchCode: '001',
  II_Nationality: 'UG',
  ...address('PCI_'),
  ...address('SCI_'),
  individual_details: {
    id: 1,
    GSCAFB_Surname: 'Okello',
    GSCAFB_Forename1: 'James',
    GSCAFB_MaritalStatus: 'S',
    II_CountryID: 'CM88000000ABCD',
    II_CountryOfIssue: 'UG',
    EI_EmploymentType: '1',
    EI_EmployerName: 'KCB',
    EI_IncomeBand: '2',
    EI_SalaryFrequency: 'M',
    dob_variable: { day: 4, month: 7, year: 1988 },
    joined_employer_variable: { day: '', month: '', year: '' },
  },
  non_individual_details: null,
}

async function signIn(page: Page) {
  await page.route('**/api/v1/me', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(me) }),
  )
  await page.route('**/api/v1/reference/**', (r) => {
    const name = new URL(r.request().url()).pathname.split('/').pop() ?? ''
    return r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(lookups[name] ?? []),
    })
  })
}

test('a CAP is captured from a profile, checked for duplicates, saved and shown', async ({ page }) => {
  await signIn(page)
  const sent: { duplicate?: Record<string, unknown>; create?: Record<string, unknown> } = {}
  await page.route('**/api/v1/profiles/1000001', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(customer) }),
  )
  await page.route('**/api/v1/applications/check-duplicate/1000001', (r) => {
    sent.duplicate = r.request().postDataJSON()
    return r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ duplicate: false }),
    })
  })
  const saved = {
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
    customer,
  }
  await page.route('**/api/v1/applications', (r) => {
    sent.create = r.request().postDataJSON()
    return r.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(saved) })
  })
  await page.route('**/api/v1/applications/9', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(saved) }),
  )

  await page.goto('/applications/create/1000001')
  await expect(page.getByRole('heading', { name: /Okello James Peter/ })).toBeVisible()

  // proceeding with the loan section empty is refused with the red-border message
  await page.getByRole('button', { name: 'Proceed' }).click()
  await expect(
    page.getByText('Kindly check inputs with a red border and fill in appropriately!'),
  ).toBeVisible()
  expect(sent.create).toBeUndefined()

  await page.locator('#cap-type').selectOption('2')
  await page.locator('#cap-purpose').selectOption('1')
  await page.locator('#cap-branch').selectOption('001')
  await page.getByLabel('Term period').selectOption('Month')
  await page.locator('#cap-term').fill('12')
  await page.locator('input[inputmode="numeric"]').first().fill('5000000')
  await page.getByRole('button', { name: 'Proceed' }).click()

  await expect(page).toHaveURL(/\/applications\/show\/9$/)
  await expect(page.getByText('Application Created Successfully')).toBeVisible()
  expect(sent.duplicate).toMatchObject({ clientNumber: '1000001', amount: '5000000', Term_Period: 'Month' })
  expect(sent.create).toMatchObject({
    clientNumber: '1000001',
    amount: '5000000',
    currency: 'UGX',
    CreditAccountLoanProductType: '2',
    Term: '12',
    Term_Period: 'Month',
    loanPurpose: '1',
    branch: '001',
    GSCAFB_Surname: 'Okello',
    PCI_District: 'Kampala',
  })
})

test('a duplicate stops the save and shows the server message', async ({ page }) => {
  await signIn(page)
  let created = false
  await page.route('**/api/v1/profiles/1000001', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(customer) }),
  )
  await page.route('**/api/v1/applications/check-duplicate/1000001', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        duplicate: true,
        message:
          'Duplicate credit application! ...<br>KCB/CAP/202610/000001 (client 1000001)<br>The application was not saved.',
      }),
    }),
  )
  await page.route('**/api/v1/applications', (r) => {
    created = true
    return r.fulfill({ status: 201, contentType: 'application/json', body: '{}' })
  })
  await page.goto('/applications/create/1000001')
  await expect(page.getByRole('heading', { name: /Okello James Peter/ })).toBeVisible()
  await page.locator('#cap-type').selectOption('2')
  await page.locator('#cap-purpose').selectOption('1')
  await page.locator('#cap-branch').selectOption('001')
  await page.getByLabel('Term period').selectOption('Month')
  await page.locator('input[inputmode="numeric"]').first().fill('1000')
  await page.getByRole('button', { name: 'Proceed' }).click()
  await expect(page.getByText('The application was not saved.')).toBeVisible()
  expect(created).toBe(false)
  await expect(page).toHaveURL(/\/applications\/create\/1000001$/)
})

test('the top bar search lists customers and applications', async ({ page }) => {
  await signIn(page)
  await page.route('**/api/v1/applications**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )
  await page.route('**/api/v1/search**', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        customers: [
          {
            title: 'Okello James Peter',
            subtitle: 'Client No: 1000001 · NIN: CM88',
            badge: 'Individual',
            url: '/borrowers/1',
            action: null,
          },
        ],
        applications: [
          {
            title: 'KCB/CAP/202610/000001',
            subtitle: 'UGX 5,000,000',
            badge: 'Pending',
            url: '/applications/show/1',
            action: null,
          },
        ],
        loans: [],
      }),
    }),
  )
  await page.goto('/home')
  await page.getByLabel('Search customers, CAPs and loans').fill('okello james')
  await expect(page.getByRole('link', { name: 'Okello James Peter' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'KCB/CAP/202610/000001' })).toBeVisible()
  await expect(page.getByText('Credit applications (CAP)')).toBeVisible()
})
