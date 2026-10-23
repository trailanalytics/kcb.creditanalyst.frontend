import { expect, test, type Page, type Route } from '@playwright/test'

const me = {
  id: 1,
  firstname: 'Jane',
  lastname: 'Doe',
  name: 'Jane Doe',
  email: 'jane@kcb.test',
  role: 'crb-officer',
  branchId: null,
  permissions: [
    'View Bounced Cheques',
    'Upload Bounced Cheques',
    'Manage FRA',
    'Create FRA',
    'Update FRA',
    'Manage PIS',
    'Update PIS',
    'Update PI Details',
    'Manage Branches',
    'Create Branches',
    'Update Branches',
  ],
}

const lookups: Record<string, unknown> = {
  branches: [
    { id: 1, code: '001', value: 'Kampala Main' },
    { id: 2, code: '002', value: 'Jinja Road' },
  ],
  'branch-types': [{ code: '1', value: 'Full branch' }],
  'institution-types': [{ code: '1', value: 'Commercial bank' }],
  'stakeholder-categories': [{ code: '3', value: 'Shareholder' }],
  'fraud-categories': [{ code: '7', value: 'Forgery' }],
  currencies: [
    { code: 'UGX', value: 'Uganda Shilling' },
    { code: 'USD', value: 'US Dollar' },
  ],
  nationalities: [{ code: 'UG', value: 'Uganda' }],
  'uganda-regions': [{ code: 'C', value: 'Central' }],
  'marital-statuses': [{ code: 'S', value: 'Single' }],
  'employment-types': [{ code: '1', value: 'Employed' }],
  'income-bands': [{ code: '2', value: '500,000 - 2,000,000' }],
  'salary-frequencies': [{ code: 'M', value: 'Monthly' }],
  'business-types': [],
  industries: [],
  'country-dialing-codes': [],
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

async function signIn(page: Page) {
  await page.route('**/api/v1/me', (r) => json(r, me))
  await page.route('**/api/v1/reference/**', (r) => {
    const name = new URL(r.request().url()).pathname.split('/').pop() ?? ''
    return json(r, lookups[name] ?? [])
  })
}

const paged = <T>(data: T[]) => ({
  data,
  current_page: 1,
  last_page: 1,
  per_page: 20,
  total: data.length,
  from: data.length ? 1 : null,
  to: data.length ? data.length : null,
})

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

/** A customer whose profile already passes the embedded form's checks. */
const customer = {
  id: 5,
  clientNumber: '1000005',
  II_FCSNumber: 'FCS9',
  full_name: 'Okello James ',
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
    EI_PrimaryOccupation: 'Driver',
    EI_EmployerName: 'KCB',
    EI_IncomeBand: '2',
    EI_SalaryFrequency: 'M',
    dob_variable: { day: 4, month: 7, year: 1988 },
    joined_employer_variable: { day: '', month: 6, year: 2015 },
  },
  non_individual_details: null,
}
const customerRow = {
  id: 5,
  clientNumber: '1000005',
  II_FCSNumber: 'FCS9',
  full_name: 'Okello James ',
  customer_type: 'Individual',
  classificationCode: '0',
}

test('bounced cheques are listed and an upload reports what matched', async ({ page }) => {
  await signIn(page)
  await page.route('**/api/v1/bounced-cheques?**', (r) =>
    json(
      r,
      paged([
        {
          id: 1,
          clientNumber: '1000005',
          ChequeNumber: '884412',
          ChequeAmount: '1250000',
          ChequeCurrency: 'UGX',
          ChequeBounceDate: '20210401',
          customer: customerRow,
        },
      ]),
    ),
  )
  await page.goto('/bc-list')
  await expect(page.getByRole('link', { name: 'Okello James' })).toHaveAttribute('href', '/borrowers/edit/5')
  await expect(page.getByText('UGX 1,250,000')).toBeVisible()
  await expect(page.getByText('20210401')).toBeVisible()

  let uploaded = ''
  await page.route('**/api/v1/bounced-cheques/upload', (r) => {
    uploaded = r.request().headers()['content-type'] ?? ''
    return json(r, { uploaded: 2, not_found: ['ACC<1>'], message: 'x' })
  })
  await page.goto('/upload-bounced-cheques')
  await page.getByRole('button', { name: 'Upload' }).click()
  await expect(page.getByText('No file uploaded. Please upload a Bounced Cheques Template!')).toBeVisible()
  await page.getByRole('button', { name: 'OK' }).click()

  await page.locator('#app input[type=file]').setInputFiles({
    name: 'cheques.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Cheque Number\n1\n'),
  })
  await page.getByRole('button', { name: 'Upload' }).click()
  await expect(page).toHaveURL(/\/bc-list$/)
  await expect(page.getByText('2 Bounced Cheques Uploaded Successfully')).toBeVisible()
  await expect(
    page.getByText('Accounts Numbers: ACC<1> could not find corresponding customers.'),
  ).toBeVisible()
  expect(uploaded).toContain('multipart/form-data')
})

test('the fully paid upload shows the row problems the server found', async ({ page }) => {
  await signIn(page)
  await page.route('**/api/v1/fully-paid-or-write-offs/upload', (r) =>
    json(
      r,
      {
        detail: 'The given data was invalid.',
        errors: {
          file: ['1 row has a problem, so nothing was uploaded.', "Row 3: Amount '<b>' is not a number."],
        },
      },
      422,
    ),
  )
  await page.goto('/upload-fully-paid-or-write-offs?cba=1')
  await expect(page.getByText('Download Template')).toHaveCount(0)
  await page.locator('#app input[type=file]').setInputFiles({
    name: 'closed.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('STATUS\n'),
  })
  await page.getByRole('button', { name: 'Upload' }).click()
  await expect(page.getByText('1 row has a problem, so nothing was uploaded.')).toBeVisible()
  await expect(page.getByText("Row 3: Amount '<b>' is not a number.")).toBeVisible()
  await expect(page).toHaveURL(/\/upload-fully-paid-or-write-offs/)
})

test('customers are moved between branches after a confirmation, and the server message is shown', async ({
  page,
}) => {
  await signIn(page)
  await page.route('**/api/v1/bank-branches?**', (r) =>
    json(
      r,
      paged([
        {
          id: 7,
          BranchName: 'Kampala Main',
          bankBranchCode: '001',
          BranchIdentificationCode: '001',
          DateOpened: '20150302',
          is_deleted: false,
        },
        {
          id: 8,
          BranchName: 'Old Branch',
          bankBranchCode: '009',
          BranchIdentificationCode: '009',
          DateOpened: '20100101',
          is_deleted: true,
        },
      ]),
    ),
  )
  let sent: unknown
  await page.route('**/api/v1/bank-branches/transfer-customers', (r) => {
    sent = r.request().postDataJSON()
    return json(r, { message: 'Customers transferred successfully!', customers: 3, loan_accounts: 2 })
  })
  await page.goto('/branches')
  await expect(page.getByRole('cell', { name: 'Kampala Main', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Edit Kampala Main' })).toHaveAttribute(
    'href',
    '/branches/edit/7',
  )
  await expect(page.getByTitle('This record has been requested to be deleted!')).toBeVisible()

  await page.getByRole('button', { name: 'Transfer Branch Customers' }).click()
  await page.getByRole('button', { name: 'Begin Transfer' }).click()
  await expect(page.getByText('This field is required')).toHaveCount(2)
  await page.getByLabel('From branch').selectOption('001')
  await page.getByRole('button', { name: 'Begin Transfer' }).click()
  await expect(page.getByText('This field is required')).toHaveCount(1)

  await page.getByLabel('To branch').selectOption('002')
  await page.getByRole('button', { name: 'Begin Transfer' }).click()
  await expect(
    page.getByText('You are about to transfer customers from one branch to another! Proceed?'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Yes, Proceed!' }).click()
  await expect(page.getByText('Customers transferred successfully!')).toBeVisible()
  expect(sent).toEqual({ from_branch: '001', to_branch: '002' })
})

test('a transfer the server refuses shows its reason instead of closing silently', async ({ page }) => {
  await signIn(page)
  await page.route('**/api/v1/bank-branches?**', (r) => json(r, paged([])))
  await page.route('**/api/v1/bank-branches/transfer-customers', (r) =>
    json(r, { detail: 'No customers were transferred!' }, 409),
  )
  await page.goto('/branches')
  await page.getByRole('button', { name: 'Transfer Branch Customers' }).click()
  await page.getByLabel('From branch').selectOption('001')
  await page.getByLabel('To branch').selectOption('002')
  await page.getByRole('button', { name: 'Begin Transfer' }).click()
  await page.getByRole('button', { name: 'Yes, Proceed!' }).click()
  await expect(page.getByText('No customers were transferred!')).toBeVisible()
})

test('a branch is created from the form with its dates and address', async ({ page }) => {
  await signIn(page)
  let created: Record<string, string> | undefined
  await page.route('**/api/v1/bank-branches', (r) => {
    if (r.request().method() !== 'POST') return r.fallback()
    created = r.request().postDataJSON()
    return json(r, { id: 9, BranchName: 'Entebbe' }, 201)
  })
  await page.route('**/api/v1/bank-branches?**', (r) => json(r, paged([])))
  await page.goto('/branches/new')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(
    page.getByText('Kindly check inputs with a red border and fill in appropriately!'),
  ).toBeVisible()
  expect(created).toBeUndefined()

  await page.getByPlaceholder('Branch Name').fill('Entebbe')
  await page.getByPlaceholder('4651').fill('0042')
  await page.getByPlaceholder('001', { exact: true }).fill('042')
  await page.locator('[name="BranchType"]').selectOption('1')
  await page.locator('[name="openDay"]').selectOption('2')
  await page.locator('[name="openMonth"]').selectOption('3')
  await page.locator('[name="openYear"]').selectOption('2015')
  await page.locator('[name="PCI_CountryCode"]').selectOption('UG')
  await page.locator('[name="PCI_Region"]').selectOption('C')
  for (const f of ['District', 'CountyorTown', 'Suburb', 'Parish', 'Village'])
    await page.locator(`[name="PCI_${f}"]`).fill('Entebbe')
  await page.locator('[name="PCI_FlagofOwnership"]').selectOption('O')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page).toHaveURL(/\/branches$/)
  await expect(page.getByText('Branch Created Successfully')).toBeVisible()
  expect(created).toMatchObject({
    BranchName: 'Entebbe',
    bankBranchCode: '0042',
    BranchIdentificationCode: '042',
    BranchType: '1',
    openDay: '2',
    openMonth: '3',
    openYear: '2015',
    PCI_CountryCode: 'UG',
    PCI_PrimaryCountryDiallingCode: '256',
  })
})

test('the institution details are loaded, checked and saved', async ({ page }) => {
  await signIn(page)
  await page.route('**/api/v1/institution', (r) => {
    if (r.request().method() === 'GET')
      return json(r, {
        IdentificationCode: 'KCB001',
        InstitutionType: '1',
        InstitutionName: 'KCB Bank Uganda',
        LicenseNumber: 'L-77',
        license_issue_variable: { day: 9, month: 11, year: 1997 },
        moved_variable: { day: '', month: '', year: '' },
        ...address('PCI_'),
      })
    return json(r, {
      IdentificationCode: 'KCB001',
      InstitutionName: 'KCB Bank Uganda Ltd',
      license_issue_variable: {},
      moved_variable: {},
    })
  })
  await page.goto('/institution')
  await expect(page.locator('[name="IdentificationCode"]')).toHaveValue('KCB001')
  await expect(page.locator('[name="licenceYear"]')).toHaveValue('1997')
  await page.locator('[name="InstitutionName"]').fill('KCB Bank Uganda Ltd')
  const [request] = await Promise.all([
    page.waitForRequest((r) => r.url().endsWith('/api/v1/institution') && r.method() === 'PUT'),
    page.getByRole('button', { name: 'Save' }).click(),
  ])
  expect(request.postDataJSON()).toMatchObject({
    InstitutionName: 'KCB Bank Uganda Ltd',
    licenceDay: '9',
    licenceMonth: '11',
  })
  await expect(page.getByText('Institution details Saved Successfully')).toBeVisible()
})

test('a PI stakeholder is created from an existing profile', async ({ page }) => {
  await signIn(page)
  await page.route('**/api/v1/pi-stakeholders?**', (r) =>
    json(
      r,
      paged([
        {
          id: 3,
          clientNumber: '1000005',
          StakeholderCategory: '3',
          ShareholderPercentage: '25',
          is_deleted: false,
          customer,
        },
      ]),
    ),
  )
  await page.route('**/api/v1/borrowers/customers?**', (r) => json(r, paged([customerRow])))
  await page.route('**/api/v1/profiles/by-cif/1000005', (r) => json(r, customer))
  let created: Record<string, string> | undefined
  await page.route('**/api/v1/pi-stakeholders', (r) => {
    created = r.request().postDataJSON()
    return json(r, { id: 4 }, 201)
  })

  await page.goto('/pis')
  await expect(page.getByRole('cell', { name: 'Shareholder', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: '25 %' })).toBeVisible()
  await page.getByRole('button', { name: 'New PIS' }).click()
  await page.getByRole('menuitem', { name: 'Existing Profile' }).click()
  await page.getByRole('textbox', { name: 'Search Customers', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Use' }).click()

  await expect(page).toHaveURL(/\/proflie\/new\/pis\?profile=1000005$/)
  await expect(page.locator('[name="GSCAFB_Surname"]')).toHaveValue('Okello')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(
    page.getByText('Kindly check inputs with a red border and fill in appropriately!'),
  ).toBeVisible()

  await page.locator('[name="ShareholderPercentage"]').fill('25')
  await page.locator('[name="StakeholderCategory"]').selectOption('3')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page).toHaveURL(/\/pis$/)
  await expect(page.getByText('PIS Saved Successfully')).toBeVisible()
  expect(created).toMatchObject({
    profile_id: '5',
    ShareholderPercentage: '25',
    StakeholderCategory: '3',
    classificationCode: '0',
    branchCode: '001',
    GSCAFB_Surname: 'Okello',
  })
})

test('an unknown profile sends the user back to the PIS list', async ({ page }) => {
  await signIn(page)
  await page.route('**/api/v1/pi-stakeholders?**', (r) => json(r, paged([])))
  await page.route('**/api/v1/profiles/by-cif/NOPE', (r) => r.fulfill({ status: 200, body: '' }))
  await page.goto('/pis/new?profile=NOPE')
  await expect(page).toHaveURL(/\/pis$/)
  await expect(page.getByText('Unknown Profile')).toBeVisible()
})

test('financial malpractice is registered for a chosen customer and edited from the list', async ({
  page,
}) => {
  await signIn(page)
  const record = {
    id: 11,
    clientNumber: '1000005',
    fraudCategory: '7',
    IncidentDate: '20240315',
    SavingsAmount: '5000000',
    LossAmount: '250000',
    currency: 'USD',
    IncidentDetails: 'Forged cheque',
    forensicInformationAvailable: 'A',
    category_name: 'Forgery',
    incident_date_variable: { day: 15, month: 3, year: 2024 },
    customer,
  }
  await page.route('**/api/v1/fraud?**', (r) => json(r, paged([record])))
  await page.route('**/api/v1/borrowers/customers?**', (r) => json(r, paged([customerRow])))
  await page.route('**/api/v1/profiles/by-cif/1000005', (r) => json(r, customer))
  const sent: { post?: Record<string, unknown>; put?: Record<string, unknown> } = {}
  await page.route('**/api/v1/fraud', (r) => {
    sent.post = r.request().postDataJSON()
    return json(r, record, 201)
  })
  await page.route('**/api/v1/fraud/11', (r) => {
    sent.put = r.request().postDataJSON()
    return json(r, record)
  })

  await page.goto('/fraud')
  await expect(page.getByRole('cell', { name: 'Forgery' })).toBeVisible()
  await expect(page.getByRole('cell', { name: '5,000,000' })).toBeVisible()

  await page.getByRole('button', { name: 'Register Fraud' }).click()
  await page.getByRole('button', { name: 'Select' }).click()
  await expect(page.getByRole('dialog').getByText('Register Fraud')).toBeVisible()
  await expect(page.locator('[name="GSCAFB_Surname"]')).toHaveValue('Okello')
  await expect(page.locator('[name="classificationCode"]')).toBeDisabled()

  await page.getByRole('button', { name: 'Save' }).click()
  await expect(
    page.getByText('Kindly check inputs with a red border and fill in appropriately!'),
  ).toBeVisible()
  expect(sent.post).toBeUndefined()

  await page.locator('[name="fraudCategory"]').selectOption('7')
  await page.locator('[name="incident_day"]').selectOption('15')
  await page.locator('[name="incident_month"]').selectOption('3')
  await page.locator('[name="incident_year"]').selectOption('2024')
  await page.locator('[name="incidentDetails"]').fill('Forged cheque')
  await page.locator('[name="forensicInformation"]').selectOption('A')
  await page.locator('input[inputmode="numeric"]').first().fill('5000000')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('FRA Saved Successfully')).toBeVisible()
  expect(sent.post).toMatchObject({
    profile_id: '5',
    fraudCategory: '7',
    incident_day: '15',
    incident_month: '3',
    incident_year: '2024',
    saving_amount: 5000000,
    loss_amount: 0,
    currency: 'UGX',
    incidentDetails: 'Forged cheque',
    forensicInformation: 'A',
    GSCAFB_Surname: 'Okello',
  })
  await page.getByRole('button', { name: 'OK' }).click()

  await page.getByRole('button', { name: 'Edit 1000005' }).click()
  await expect(page.getByRole('dialog').getByText('Update Fraud')).toBeVisible()
  await expect(page.locator('[name="currency"]')).toHaveValue('USD')
  await expect(page.locator('[name="incidentDetails"]')).toHaveValue('Forged cheque')
  await expect(page.locator('[name="clientNumber"]')).toHaveValue('1000005')
  await page.locator('[name="incidentDetails"]').fill('Forged cheque presented twice')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('FRA Saved Successfully')).toBeVisible()
  expect(sent.put).toMatchObject({
    incidentDetails: 'Forged cheque presented twice',
    loss_amount: 250000,
    currency: 'USD',
  })
})

test('a rejected fraud save shows the server messages while the form stays open', async ({ page }) => {
  await signIn(page)
  await page.route('**/api/v1/fraud?**', (r) => json(r, paged([])))
  await page.route('**/api/v1/borrowers/customers?**', (r) => json(r, paged([customerRow])))
  await page.route('**/api/v1/profiles/by-cif/1000005', (r) => json(r, customer))
  await page.route('**/api/v1/fraud', (r) =>
    json(
      r,
      {
        detail: 'The given data was invalid.',
        errors: { incident_day: ['Please select a valid incident date.'] },
      },
      422,
    ),
  )
  await page.goto('/fraud')
  await page.getByRole('button', { name: 'Register Fraud' }).click()
  await page.getByRole('button', { name: 'Select' }).click()
  await page.locator('[name="fraudCategory"]').selectOption('7')
  await page.locator('[name="incident_day"]').selectOption('31')
  await page.locator('[name="incident_month"]').selectOption('2')
  await page.locator('[name="incident_year"]').selectOption('2024')
  await page.locator('[name="incidentDetails"]').fill('x')
  await page.locator('[name="forensicInformation"]').selectOption('N')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Please select a valid incident date.')).toBeVisible()
  await page.getByRole('button', { name: 'OK' }).click()
  await expect(page.locator('[name="incidentDetails"]')).toHaveValue('x')
})
