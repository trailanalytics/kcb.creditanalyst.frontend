import { expect, test } from '@playwright/test'
import { Api } from '../uat/support/api'
import { authFile } from '../uat/support/auth'
import { CUSTOMER, PERSONAS, passwordOf } from '../uat/support/env'
import { createApplication, createCollateral, securities } from '../uat/support/data'
import { chooseFromMenu, confirmDialog, dialog, modal, money, uniqueAmount } from '../uat/support/ui'
import { figure, message } from './support/guide'
import {
  amountInput,
  capTile,
  type CollateralRow,
  fillGuarantor,
  fillLoan,
  fillStakeholder,
  findApplicationRow,
  openCapTileMenu,
  openRowMenu,
  requestOf,
  tile,
  toastWith,
} from './support/steps'

/**
 * Credit Officer Guide (role id "officer"): the maker of profiles, credit applications and their securities. Signed in as
 * uat.officer, with one part as uat.branch. Every record it adds is made-up and belongs to the fixture customers the UAT suite
 * does not count on (9100023 Achieng Lilian, 9100024 Kabuye Henry, 9100025 Pearl Logistics Ltd), or is a new application of a
 * fixture borrower, so the UAT run that follows is not disturbed.
 */
const ROLE = 'officer'

/** Fixture customers this guide works on. */
const SECURITIES_BORROWER = CUSTOMER.spare[4] // 9100023 Achieng Lilian
const PROFILE_TO_EDIT = { clientNumber: CUSTOMER.spare[5], name: 'Kabuye Henry' } // 9100024
const COMPANY_BORROWER = '9100025' // Pearl Logistics Ltd, no UAT case uses it

test.use({ storageState: authFile('officer') })

test.describe('Credit Officer Guide', () => {
  test('01 signing in, the dashboard and the top bar', async ({ browser }) => {
    // a browser without a session, so the login screen shows
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await ctx.newPage()
    await page.goto('/login')
    await page.getByPlaceholder('KCB User ID/Email').fill(PERSONAS.officer)
    await page.getByPlaceholder('Password').fill(passwordOf('officer'))
    await figure(page, ROLE, '01-login', 'Sign in with your KCB user ID or e-mail and your password', [
      { target: page.getByPlaceholder('KCB User ID/Email'), tip: 'Type your KCB user ID or e-mail' },
      { target: page.getByPlaceholder('Password'), tip: 'Type your password' },
      { target: page.getByRole('button', { name: 'Login' }), tip: 'Click Login' },
    ])
    await page.getByRole('button', { name: 'Login' }).click()
    await expect(page).toHaveURL(/\/home/)
    await expect(capTile(page)).toBeVisible()

    await figure(page, ROLE, '02-dashboard', 'Your dashboard: one card for each part of the work', [
      {
        target: capTile(page),
        tip: 'CAP: credit applications. Click Manage Credit Applications for the list',
      },
      { target: tile(page, 'Borrower Stakeholder'), tip: 'BS: stakeholders of company borrowers' },
      { target: tile(page, 'Collateral Material'), tip: 'CMC: every collateral captured' },
      { target: tile(page, 'Collateral Credit Guarantor'), tip: 'CCG: every guarantor captured' },
    ])

    await figure(page, ROLE, '03-top-bar', 'The top bar is on every page', [
      {
        target: page.getByLabel('Search customers, CAPs and loans'),
        tip: 'Search for a customer or a CAP from any page',
        side: 'below',
      },
      {
        target: page.getByRole('link', { name: 'Profiles', exact: true }),
        tip: 'Profiles: find and update a borrower',
        side: 'below',
      },
      {
        target: page.getByRole('link', { name: 'Requests', exact: true }),
        tip: 'Requests: your deletion requests and their status',
        side: 'below',
      },
      {
        target: page.getByRole('button', { name: 'Log out' }),
        tip: 'Log out when you leave your desk',
        side: 'left',
      },
    ])

    const search = page.getByLabel('Search customers, CAPs and loans')
    await search.fill('Okello James')
    const hit = page
      .getByRole('listbox')
      .getByRole('link', { name: /Okello James Peter/ })
      .first()
    await expect(hit).toBeVisible()
    await figure(page, ROLE, '04-global-search', 'Find a customer or a CAP from the top bar', [
      {
        target: search,
        tip: 'Type two words of a name, a client number, NIN or CAP reference',
        side: 'below',
      },
      { target: hit, tip: 'Click a result to open it', side: 'right' },
    ])
    await search.fill('')

    await page.getByRole('button', { name: 'Log out' }).click()
    await expect(page).toHaveURL(/\/login/)
    await ctx.close()
  })

  test('02 profiles: search, open, edit and Find in T24', async ({ page }) => {
    await page.goto('/home')
    await page.getByRole('link', { name: 'Profiles', exact: true }).click()
    const search = page.getByPlaceholder('Search by name, client no, FCS no...')
    await search.fill('Okello')
    const okello = page.getByRole('link', { name: 'Okello James Peter' })
    await expect(okello).toBeVisible()
    await figure(page, ROLE, '05-profiles-search-name', 'Find a borrower by name', [
      { target: search, tip: 'Type a name, a client number or an FCS number', side: 'below' },
      { target: okello, tip: 'Click the name to open the profile' },
      {
        target: page.getByRole('link', { name: 'Import from T24' }),
        tip: 'Not in the list? Look the client up in T24',
        side: 'below',
      },
    ])

    await search.fill(PROFILE_TO_EDIT.clientNumber)
    const row = page.getByRole('row', { name: new RegExp(PROFILE_TO_EDIT.name) })
    await expect(row).toHaveCount(1)
    await figure(page, ROLE, '06-profiles-search-number', 'Find a borrower by client number', [
      { target: search, tip: 'A client number finds exactly one customer', side: 'below' },
      {
        target: row.getByRole('link', { name: PROFILE_TO_EDIT.name }),
        tip: 'Click the name to open the profile',
      },
    ])

    await row.getByRole('link', { name: PROFILE_TO_EDIT.name }).click()
    await expect(page.getByRole('link', { name: 'Edit Profile' })).toBeVisible()
    await figure(page, ROLE, '07-profile-page', 'The profile of a borrower', [
      {
        target: page.getByRole('link', { name: '+ New Cap' }),
        tip: 'Start a new credit application for this borrower',
        side: 'below',
      },
      {
        target: page.getByRole('link', { name: 'Edit Profile' }),
        tip: 'Correct the borrower details',
        side: 'below',
      },
    ])

    await page.getByRole('link', { name: 'Edit Profile' }).click()
    const employer = page.locator('input[name="EI_EmployerName"]').first()
    await expect(employer).toBeVisible()
    await employer.fill('Kira Hardware Ltd')
    await figure(page, ROLE, '08-profile-edit', 'Edit Profile: change what is out of date', [
      {
        target: page.locator('input[name="EI_PrimaryOccupation"]').first(),
        tip: 'Each box keeps the value on record until you change it',
      },
      { target: employer, tip: 'Type the new value' },
    ])
    await page.getByRole('button', { name: 'Save' }).click()
    const saved = toastWith(page, 'Profile Updated Successfully')
    await expect(saved).toBeVisible()
    await figure(page, ROLE, '09-profile-saved', 'Save the profile', [
      {
        target: page.getByRole('button', { name: 'Save' }),
        tip: 'Click Save at the bottom of the form',
        side: 'above',
      },
      { target: saved, tip: 'A green message confirms the save', side: 'right' },
    ])
    message(ROLE, 'Profile Updated Successfully', 'Nothing to do: the changes are saved.')

    // a required box left empty: the save is refused and nothing changes (the page is reloaded afterwards)
    const district = page.locator('[name="PCI_District"]').first()
    await district.fill('')
    await page.getByRole('button', { name: 'Save' }).click()
    const redBorder = toastWith(page, 'Kindly check inputs with a red border')
    await expect(redBorder).toBeVisible()
    await expect(district).toHaveClass(/is-invalid/)
    await figure(page, ROLE, '10-profile-red-border', 'A required box left empty is outlined in red', [
      { target: district, tip: 'Fill in the box outlined in red' },
      { target: redBorder, tip: 'Nothing is saved until every red box is filled', side: 'right' },
    ])
    message(
      ROLE,
      'Kindly check inputs with a red border and fill in appropriately!',
      'Fill in or correct every box outlined in red, then click Save or Proceed again. Nothing was saved.',
    )
    await page.reload()

    // Find in T24: a client of the core banking extract is found; a number found nowhere is reported
    await page.goto('/profiles')
    await page.getByRole('link', { name: 'Import from T24' }).click()
    await expect(page).toHaveURL(/\/find-in-t24/)
    const t24 = page.locator('#t24-search')
    await t24.fill(`0100${CUSTOMER.main}`)
    await page.getByRole('button', { name: 'Find' }).click()
    await expect(
      page.getByText('The following record has been imported from T24 to credit analyst'),
    ).toBeVisible()
    await figure(page, ROLE, '11-find-in-t24', 'Find in T24: bring a bank customer into Credit Analyst', [
      { target: t24, tip: 'Type the client number or the account number', side: 'below' },
      { target: page.getByRole('button', { name: 'Find' }), tip: 'Click Find', side: 'left' },
      {
        target: page.getByRole('link', { name: 'New Loan' }),
        tip: 'Start a CAP for the customer found',
        side: 'left',
      },
    ])

    const nowhere = '9199999'
    await t24.fill(nowhere)
    await page.getByRole('button', { name: 'Find' }).click()
    const alert = page.getByRole('alert')
    await expect(alert).toContainText('does not exist in T24')
    await figure(page, ROLE, '12-find-in-t24-not-found', 'A number found nowhere is reported', [
      {
        target: alert,
        tip: 'Check the number. A client who is not in the T24 extract cannot be found here yet',
        side: 'below',
      },
    ])
    message(
      ROLE,
      'Failed! Record matching the search "…" does not exist in T24',
      'Check the client or account number. The warehouse link to T24 is not connected yet, so only clients already in the T24 extract are found. Ask the CRB team to add the client.',
    )
  })

  test('03 a new credit application (CAP)', async ({ page }) => {
    const amount = uniqueAmount()
    await page.goto('/profiles')
    await page.getByPlaceholder('Search by name, client no, FCS no...').fill(CUSTOMER.main)
    await page.getByRole('link', { name: 'Okello James Peter' }).click()
    await page.getByRole('link', { name: '+ New Cap' }).click()
    await expect(page).toHaveURL(new RegExp(`/applications/create/${CUSTOMER.main}`))
    await fillLoan(page, { amount })
    await figure(page, ROLE, '13-new-cap-form', 'New CAP: fill in the loan details', [
      { target: amountInput(page), tip: 'Choose the currency and type the amount' },
      { target: page.locator('#cap-type'), tip: 'Choose the loan type' },
      { target: page.locator('#cap-term'), tip: 'Type the term and choose Month(s) or Year(s)' },
      { target: page.locator('#cap-branch'), tip: 'Choose the branch' },
    ])
    const proceed = page.getByRole('button', { name: 'Proceed' })
    await figure(page, ROLE, '14-new-cap-proceed', 'Check the borrower details, then Proceed', [
      { target: proceed, tip: 'Click Proceed to save the CAP', side: 'above' },
    ])
    await proceed.click()
    await expect(dialog(page)).toContainText('Application Created Successfully')
    await figure(page, ROLE, '15-new-cap-created', 'The CAP is saved', [
      { target: page.locator('.swal2-confirm'), tip: 'Click OK to see the application' },
    ])
    message(
      ROLE,
      'Application Created Successfully',
      'Click OK. The application page opens with the status Pending.',
    )
    await confirmDialog(page, 'OK')
    await expect(page).toHaveURL(/\/applications\/show\/\d+/)
    await expect(page.locator('dd', { hasText: /^KCB\/CAP\// })).toBeVisible()
    await figure(page, ROLE, '16-application-page', 'The application page (Loan Details)', [
      {
        target: page.locator('dd', { hasText: /^KCB\/CAP\// }),
        tip: 'Each CAP gets a reference KCB/CAP/…',
        side: 'below',
      },
      {
        target: page.locator('dd', { hasText: /^Pending$/ }),
        tip: 'A new CAP is Pending until an approver decides',
        side: 'below',
      },
      {
        target: page.getByRole('button', { name: 'Add Collateral' }),
        tip: 'Add the securities from here',
        side: 'below',
      },
      {
        target: page.getByRole('link', { name: 'Edit', exact: true }),
        tip: 'Edit the loan while it is pending',
        side: 'left',
      },
    ])

    // the same loan again is refused as a duplicate
    await page.goto(`/applications/create/${CUSTOMER.main}`)
    await fillLoan(page, { amount })
    await page.getByRole('button', { name: 'Proceed' }).click()
    await expect(dialog(page)).toContainText('Duplicate credit application!')
    await figure(page, ROLE, '17-new-cap-duplicate', 'The same application twice is refused', [], {
      clip: dialog(page),
    })
    message(
      ROLE,
      'Duplicate credit application! The following application(s) with the same date, amount, currency and loan type already exist: … The application was not saved.',
      'Do not capture it again. Open the CAP named in the message from the list; if something has changed, edit that one.',
    )
    await confirmDialog(page, 'OK')

    // mandatory loan fields left empty
    await page.goto(`/applications/create/${CUSTOMER.main}`)
    await amountInput(page).fill('1000000')
    await page.getByRole('button', { name: 'Proceed' }).click()
    const redBorder = toastWith(page, 'Kindly check inputs with a red border')
    await expect(redBorder).toBeVisible()
    await expect(page.locator('#cap-type')).toHaveClass(/is-invalid/)
    await figure(page, ROLE, '18-new-cap-red-border', 'Empty mandatory boxes are outlined in red', [
      { target: page.locator('#cap-type'), tip: 'Choose a value in every box outlined in red' },
      { target: redBorder, tip: 'Nothing was saved', side: 'right' },
    ])
  })

  test('04 securities on the application: collateral, guarantors, stakeholders', async ({ page }) => {
    const api = await Api.as('officer')
    const app = await createApplication(api, { clientNumber: SECURITIES_BORROWER })
    await page.goto(`/applications/show/${app.id}`)
    await expect(page.getByRole('button', { name: 'Add Collateral' })).toBeVisible()
    await figure(page, ROLE, '19-application-actions', 'Add the securities of a pending CAP', [
      { target: page.getByRole('button', { name: /Add Guarantors/ }), tip: 'Add a guarantor', side: 'below' },
      {
        target: page.getByRole('button', { name: 'Add Collateral' }),
        tip: 'Add a collateral',
        side: 'below',
      },
      {
        target: page.getByRole('link', { name: 'Edit', exact: true }),
        tip: 'Change the loan details',
        side: 'left',
      },
      {
        target: page.getByRole('button', { name: 'Show / Hide' }),
        tip: 'Show every detail of the loan',
        side: 'left',
      },
    ])

    // collateral
    await page.getByRole('button', { name: 'Add Collateral' }).click()
    const form = modal(page)
    await form.locator('#cm-type').selectOption('1')
    await form.locator('#cm-currency').selectOption('UGX')
    await money(form, 'CollateralForcedSaleValue').fill('40000000')
    await money(form, 'CollateralOpenMarketValue').fill('55000000')
    await form.locator('#cm-valuation').fill('2026-10-01')
    await form.locator('#cm-expiry').fill('2031-12-31')
    await form.locator('#cm-instrument').selectOption('Land Title')
    await form.locator('#cm-description').fill('Plot 21 Block 4 Kira (land title)')
    await figure(
      page,
      ROLE,
      '20-add-collateral',
      'Add Collateral: the type, values, dates and instrument of claim',
      [
        { target: form.locator('#cm-type'), tip: 'Choose the collateral type' },
        {
          target: money(form, 'CollateralOpenMarketValue'),
          tip: 'Forced sale and open market values must be above zero',
        },
        { target: form.locator('#cm-description'), tip: 'Describe the collateral' },
        { target: form.getByRole('button', { name: 'Save' }), tip: 'Click Save' },
      ],
      { clip: form },
    )
    await form.getByRole('button', { name: 'Save' }).click()
    const collateralSaved = toastWith(page, 'Collateral Saved Successfully')
    await expect(collateralSaved).toBeVisible()
    const collaterals = page.getByRole('region', { name: 'Collateral' })
    await expect(collaterals).toContainText('Plot 21 Block 4 Kira')
    // on a new CAP the only attached collateral is the one just saved
    const overview: CollateralRow[] = (await securities(api, app.creditApplicationReference)).collaterals
    const added = overview.find((c) => c.attached)
    if (!added) throw new Error('the new collateral is not attached to the application')
    expect(added.CollateralReferenceNumber).toMatch(/^KCB\/CMC\//)
    await figure(page, ROLE, '21-collateral-saved', 'The collateral is listed and attached to the CAP', [
      {
        target: page.getByLabel(`Attach ${added.CollateralReferenceNumber}`),
        tip: 'Ticked: attached to this application, reference KCB/CMC/…',
      },
      { target: collateralSaved, tip: 'A green message confirms the save', side: 'right' },
    ])
    message(
      ROLE,
      'Collateral Saved Successfully',
      'Nothing to do: the collateral is saved and attached to the CAP.',
    )

    // individual guarantor
    await page.getByRole('button', { name: /Add Guarantors/ }).click()
    await expect(page.getByRole('menuitem', { name: 'Individual', exact: true })).toBeVisible()
    await figure(page, ROLE, '22-add-guarantor-menu', 'Add Guarantors: choose the kind of guarantor', [
      {
        target: page.getByRole('menuitem', { name: 'Individual', exact: true }),
        tip: 'A person who is not yet a customer',
        side: 'left',
      },
      {
        target: page.getByRole('menuitem', { name: 'Non Individual', exact: true }),
        tip: 'A company that is not yet a customer',
        side: 'left',
      },
      {
        target: page.getByRole('menuitem', { name: 'Existing Customer', exact: true }),
        tip: 'Somebody who already has a profile',
        side: 'left',
      },
      {
        target: page.getByRole('menuitem', { name: 'Existing Stakeholder', exact: true }),
        tip: 'A stakeholder of this borrower',
        side: 'left',
      },
    ])
    await page.getByRole('menuitem', { name: 'Individual', exact: true }).click()
    await fillGuarantor(page, { surname: 'Specimen', forename: 'Joan' })
    const guarantorForm = modal(page)
    await guarantorForm.locator('input[name="ValueOfGuarantorsCollateral"]').scrollIntoViewIfNeeded()
    await figure(
      page,
      ROLE,
      '23-guarantor-individual',
      'An individual guarantor: the guarantee, then the person’s profile',
      [
        {
          target: guarantorForm.locator('input[name="ValueOfGuarantorsCollateral"]'),
          tip: 'Value of the guarantor’s collateral',
        },
        { target: guarantorForm.locator('select[name="GuaranteeType"]'), tip: 'Guarantee type' },
        { target: guarantorForm.locator('select[name="GuarantorType"]'), tip: 'Guarantor type' },
      ],
      {
        clip: guarantorForm,
        steps: [
          'Fill in the profile below: names, FCS number (13 characters), NIN (14 characters), date of birth, employment and address.',
          'Click Save Guarantor.',
        ],
      },
    )
    await guarantorForm.getByRole('button', { name: 'Save Guarantor' }).click()
    await expect(toastWith(page, 'Guarantor Saved Successfully')).toBeVisible()
    message(
      ROLE,
      'Guarantor Saved Successfully',
      'Nothing to do: the guarantor is saved and attached to the CAP.',
    )

    // non-individual guarantor
    await chooseFromMenu(page, /Add Guarantors/, 'Non Individual')
    await fillGuarantor(page, { company: true })
    const companyForm = modal(page)
    await companyForm.locator('input[name="GSCAFB_BusinessName"]').fill('Specimen Hardware Ltd')
    await figure(
      page,
      ROLE,
      '24-guarantor-non-individual',
      'A non-individual guarantor: the company’s details',
      [
        { target: companyForm.locator('input[name="GSCAFB_BusinessName"]'), tip: 'Business name' },
        {
          target: companyForm.locator('input[name="GSCAFB_TradingName"]'),
          tip: 'Trading name (required for a company)',
        },
      ],
      { clip: companyForm },
    )
    await companyForm.getByRole('button', { name: 'Save Guarantor' }).click()
    await expect(toastWith(page, 'Guarantor Saved Successfully')).toBeVisible()

    // an existing customer as guarantor
    await chooseFromMenu(page, /Add Guarantors/, 'Existing Customer')
    const picker = page.getByLabel('Search customers', { exact: true })
    await picker.fill('Akello')
    const akello = page.getByRole('row', { name: /Akello Mary/ })
    await expect(akello).toBeVisible()
    await figure(
      page,
      ROLE,
      '25-guarantor-existing',
      'An existing customer as guarantor',
      [
        { target: picker, tip: 'Type the customer’s name' },
        {
          target: akello.getByRole('button', { name: 'Select' }),
          tip: 'Click Select, then fill in the guarantee and save',
        },
      ],
      { clip: modal(page) },
    )
    await akello.getByRole('button', { name: 'Select' }).click()
    const existingForm = modal(page)
    await expect(existingForm.getByLabel('Client number')).toHaveValue(CUSTOMER.guarantor)
    await existingForm.locator('select[name="branchCode"]').selectOption('001')
    await existingForm.locator('input[name="ValueOfGuarantorsCollateral"]').fill('3000000')
    await existingForm.locator('select[name="GuaranteeType"]').selectOption('0')
    await existingForm.locator('select[name="GuarantorType"]').selectOption('0')
    await existingForm.getByRole('button', { name: 'Save Guarantor' }).click()
    await expect(toastWith(page, 'Guarantor Saved Successfully')).toBeVisible()
    const guarantors = page.getByRole('region', { name: 'Guarantors' })
    await expect(guarantors).toContainText('Akello Mary')
    await figure(page, ROLE, '26-guarantors-listed', 'The guarantors of the borrower', [
      {
        target: page.getByLabel(`Attach guarantor ${CUSTOMER.guarantor}`),
        tip: 'Ticked: this guarantor backs this CAP',
      },
      {
        target: guarantors.getByText('Specimen Hardware Ltd'),
        tip: 'A company guarantor shows its business name',
      },
    ])

    // a stakeholder: only for a company borrower
    const companyApp = await createApplication(api, { clientNumber: COMPANY_BORROWER })
    await page.goto(`/applications/show/${companyApp.id}`)
    await page.getByRole('button', { name: /Add Stakeholder/ }).click()
    await expect(page.getByRole('menuitem', { name: 'Individual', exact: true })).toBeVisible()
    await figure(page, ROLE, '27-add-stakeholder-menu', 'Add Stakeholder (company borrowers only)', [
      {
        target: page.getByRole('menuitem', { name: 'Individual', exact: true }),
        tip: 'A person who owns part of the company',
        side: 'left',
      },
      {
        target: page.getByRole('menuitem', { name: 'Non Individual', exact: true }),
        tip: 'A company that owns part of it',
        side: 'left',
      },
      {
        target: page.getByRole('menuitem', { name: 'Existing Customer', exact: true }),
        tip: 'Somebody who already has a profile',
        side: 'left',
      },
    ])
    await page.getByRole('menuitem', { name: 'Individual', exact: true }).click()
    await fillStakeholder(page, { surname: 'Specimen', forename: 'Moses', percentage: '20' })
    const stakeholderForm = modal(page)
    await stakeholderForm.locator('input[name="ShareholderPercentage"]').scrollIntoViewIfNeeded()
    await figure(
      page,
      ROLE,
      '28-stakeholder-form',
      'A stakeholder: the share, the category, then the profile',
      [
        {
          target: stakeholderForm.locator('input[name="ShareholderPercentage"]'),
          tip: 'Shareholder percentage (100 at most)',
        },
        {
          target: stakeholderForm.locator('select[name="StakeholderCategory"]'),
          tip: 'Stakeholder category',
        },
      ],
      { clip: stakeholderForm, steps: ['Fill in the stakeholder’s profile below.', 'Click Save.'] },
    )
    await stakeholderForm.getByRole('button', { name: 'Save', exact: true }).click()
    const stakeholderSaved = toastWith(page, 'Stakeholder Saved Successfully')
    await expect(stakeholderSaved).toBeVisible()
    const stakeholders = page.getByRole('region', { name: 'Stakeholders' })
    await expect(stakeholders).toContainText('Specimen')
    await figure(page, ROLE, '29-stakeholder-saved', 'The stakeholder is linked to the company', [
      {
        target: stakeholders.getByRole('checkbox').first(),
        tip: 'Always ticked: a stakeholder cannot be detached',
      },
      { target: stakeholderSaved, tip: 'A green message confirms the save', side: 'right' },
    ])
    message(ROLE, 'Stakeholder Saved Successfully', 'Nothing to do: the stakeholder is saved.')

    // attach and detach the securities a borrower already has
    const attachApp = await createApplication(api, { clientNumber: CUSTOMER.securities })
    await page.goto(`/applications/show/${attachApp.id}`)
    const box = page.getByLabel('Attach UAT-CMC-0001')
    await expect(box).not.toBeChecked()
    await figure(page, ROLE, '30-attach-boxes', 'Securities the borrower already has: tick to attach them', [
      { target: box, tip: 'Tick a collateral to attach it to this CAP' },
      {
        target: page.getByLabel(`Attach guarantor ${CUSTOMER.guarantor}`),
        tip: 'Tick a guarantor the same way; clear the tick to detach',
      },
    ])
    await box.click()
    await expect(dialog(page)).toContainText('Attach Collateral to Loan.')
    await figure(
      page,
      ROLE,
      '31-attach-confirm',
      'Confirm the change',
      [
        { target: page.locator('.swal2-confirm'), tip: 'Yes, Proceed makes the change' },
        { target: page.locator('.swal2-cancel'), tip: 'No, cancel leaves it as it was', side: 'left' },
      ],
      { clip: dialog(page) },
    )
    await confirmDialog(page, 'Yes, Proceed')
    await expect(box).toBeChecked()
    const attached = toastWith(page, 'Collateral Attached To Loan Successfully')
    await expect(attached).toBeVisible()
    await figure(page, ROLE, '32-attached', 'The collateral is attached', [
      { target: box, tip: 'The tick follows what was saved' },
      { target: attached, tip: 'The message confirms it', side: 'right' },
    ])
    message(
      ROLE,
      'Collateral Attached To Loan Successfully',
      'Nothing to do. To undo it, clear the tick and confirm.',
    )
    // and detached again
    await box.click()
    await expect(dialog(page)).toContainText('Remove Collateral from Loan')
    await confirmDialog(page, 'Yes, Proceed')
    await expect(box).not.toBeChecked()
    message(
      ROLE,
      'Collateral Removed From Loan Successfully',
      'Nothing to do: the collateral stays on the borrower but no longer backs this CAP.',
    )
    await api.dispose()
  })

  test('05 the CAP list, editing a pending application and the reports', async ({ page }) => {
    const api = await Api.as('officer')
    const app = await createApplication(api, { clientNumber: SECURITIES_BORROWER })
    await page.goto('/home')
    await page.getByRole('link', { name: 'Manage Credit Applications' }).click()
    await expect(page).toHaveURL(/\/applications$/)
    await expect(page.locator('div.group').first()).toBeVisible()
    await figure(page, ROLE, '33-cap-list', 'The credit applications (CAP) list', [
      {
        target: page.getByPlaceholder('search...'),
        tip: 'Search by name, client number or CAP reference',
        side: 'below',
      },
      {
        target: page.getByLabel('Filter applications'),
        tip: 'Show only Pending, Approved, Rejected or Joint',
        side: 'below',
      },
      { target: page.locator('div.group').first(), tip: 'Point at a row to see its buttons', side: 'below' },
    ])

    const row = await findApplicationRow(page, app.creditApplicationReference)
    await openRowMenu(page, row)
    await figure(page, ROLE, '34-cap-row-menu', 'Point at a row: Loan Details and the arrow menu', [
      {
        target: row.getByRole('link', { name: 'Loan Details' }),
        tip: 'Open the application page',
        side: 'left',
      },
      {
        target: page.getByRole('menuitem', { name: 'Edit Loan' }),
        tip: 'Change a pending application',
        side: 'left',
      },
      {
        target: page.getByRole('menuitem', { name: 'Delete Loan' }),
        tip: 'Ask for the CAP to be deleted (a checker decides)',
        side: 'left',
      },
      {
        target: page.getByRole('menuitem', { name: 'Approve Loan' }),
        tip: 'Approve and Reject are for approvers only',
        side: 'left',
      },
    ])
    await page.getByRole('menuitem', { name: 'Edit Loan' }).click()
    await expect(page).toHaveURL(new RegExp(`/applications/edit/${app.id}`))
    await expect(amountInput(page)).toBeVisible()
    await amountInput(page).fill(uniqueAmount())
    await page.locator('#cap-purpose').selectOption('2')
    await figure(page, ROLE, '35-edit-cap', 'Edit Loan: change the loan of a pending CAP', [
      { target: amountInput(page), tip: 'Change what needs changing' },
      { target: page.locator('#cap-purpose'), tip: 'The reference and the status do not change' },
    ])
    await page.getByRole('button', { name: 'Proceed' }).click()
    await expect(dialog(page)).toContainText('Application Updated Successfully')
    await expect(page).toHaveURL(new RegExp(`/applications/show/${app.id}`))
    await figure(
      page,
      ROLE,
      '36-edit-cap-saved',
      'The changes are saved (the message is the same as for a new CAP)',
      [{ target: page.locator('.swal2-confirm'), tip: 'Click OK' }],
    )
    await confirmDialog(page, 'OK')
    message(
      ROLE,
      'You can only edit pending applications',
      'The CAP has been approved or rejected and can no longer be changed. Ask your approver if the decision is wrong.',
    )

    // the arrow menu of the CAP card
    await page.goto('/home')
    await openCapTileMenu(page)
    await figure(page, ROLE, '37-cap-card-menu', 'The arrow menu of the CAP card', [
      {
        target: page.getByRole('menuitem', { name: 'Applications Report' }),
        tip: 'Export applications to Excel',
        side: 'left',
      },
      {
        target: page.getByRole('menuitem', { name: 'Non Existing Customer' }),
        tip: 'A CAP for somebody with no profile yet',
        side: 'left',
      },
      {
        target: page.getByRole('menuitem', { name: 'Joint Application' }),
        tip: 'One CAP for each of two or more borrowers',
        side: 'left',
      },
      {
        target: page.getByRole('menuitem', { name: 'Bulk Approval' }),
        tip: 'For approvers only',
        side: 'left',
      },
    ])
    await page.getByRole('menuitem', { name: 'Applications Report' }).click()
    await expect(page).toHaveURL(/\/applications\/report/)
    await page.getByLabel('Status').selectOption({ label: 'Pending' })
    await figure(page, ROLE, '38-applications-report', 'Applications Report: choose, then Download', [
      { target: page.getByLabel('Status'), tip: 'All, Pending, Approved or Rejected' },
      { target: page.getByPlaceholder('From'), tip: 'Optional: the application dates to include' },
      { target: page.getByLabel('Branch'), tip: 'Optional: one branch' },
      {
        target: page.getByRole('button', { name: 'Download' }),
        tip: 'Click Download: an Excel file is saved',
      },
    ])
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download' }).click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(/^CB011CAE\d+\.xlsx$/)
    await api.dispose()
  })

  test('06 the non-existing customer and joint application dialogs', async ({ page }) => {
    await page.goto('/home')
    await openCapTileMenu(page)
    await page.getByRole('menuitem', { name: 'Non Existing Customer' }).click()
    const nec = modal(page)
    await expect(nec.locator('#nec-class')).toBeVisible()
    await figure(
      page,
      ROLE,
      '39-non-existing-customer',
      'Non Existing Customer: a CAP for somebody with no profile',
      [
        { target: nec.locator('#nec-class'), tip: 'Individual or Non Individual' },
        { target: nec.locator('#nec-name'), tip: 'The full name' },
        { target: nec.locator('#nec-nin'), tip: 'The NIN (each NIN only once)' },
        { target: nec.locator('#nec-cn'), tip: 'The client number to use' },
      ],
      {
        clip: nec,
        steps: [
          'Click PROCEED, confirm, and tick that IT confirmed the account does not exist.',
          'Complete the profile and the loan on the New CAP form, then click Proceed.',
        ],
      },
    )
    await nec.getByRole('button', { name: 'Cancel' }).click()
    await expect(modal(page)).toHaveCount(0)

    await openCapTileMenu(page)
    await page.getByRole('menuitem', { name: 'Joint Application' }).click()
    const picker = page.getByPlaceholder('search customer by name')
    await picker.fill('Nantongo Judith')
    const pick = page.getByRole('button', { name: /Nantongo Judith/ })
    await expect(pick).toBeVisible()
    await figure(
      page,
      ROLE,
      '40-joint-application',
      'Joint Application: choose two or more borrowers',
      [
        { target: picker, tip: 'Type two words of each borrower’s name' },
        { target: pick, tip: 'Click a name to add the borrower' },
        {
          target: modal(page).getByRole('button', { name: 'PROCEED' }),
          tip: 'Click PROCEED once two or more are chosen',
        },
      ],
      {
        clip: modal(page),
        steps: [
          'Fill in the loan of each borrower and click Proceed. Each gets its own CAP under one joint account number.',
        ],
      },
    )
    message(
      ROLE,
      'Select at least 2 customers to proceed!',
      'Add a second borrower before you click PROCEED.',
    )
    await page.keyboard.press('Escape')
  })

  test('07 the CMC, CCG and BS lists and asking for a deletion', async ({ page }) => {
    const api = await Api.as('officer')
    const app = await createApplication(api, { clientNumber: SECURITIES_BORROWER })
    const collateral = await createCollateral(
      api,
      app.creditApplicationReference,
      'Plot 8 Block 2 Mukono (land title)',
    )
    const ref = collateral.CollateralReferenceNumber as string

    await page.goto('/home')
    await page.getByRole('link', { name: 'Manage Collateral' }).click()
    await expect(page).toHaveURL(/\/cmc-list/)
    await page.getByLabel('Search collateral').fill(ref)
    await expect(page.getByRole('row', { name: new RegExp(ref) })).toHaveCount(1)
    await figure(page, ROLE, '41-cmc-list', 'CMC: every collateral captured', [
      {
        target: page.getByLabel('Search collateral'),
        tip: 'Search by reference, description or borrower',
        side: 'below',
      },
      { target: page.getByRole('button', { name: `Edit ${ref}` }), tip: 'Edit the collateral', side: 'left' },
      {
        target: page.getByRole('button', { name: `Request deletion of ${ref}` }),
        tip: 'Ask for it to be deleted',
        side: 'below',
      },
      {
        target: page.getByRole('button', { name: 'Map Instruments Of Claim' }),
        tip: 'Change one instrument of claim on every collateral',
        side: 'below',
      },
    ])
    await page.getByRole('button', { name: `Edit ${ref}` }).click()
    const form = modal(page)
    await form.locator('#cm-description').fill('Plot 8 Block 2 Mukono (land title), revalued')
    await money(form, 'CollateralOpenMarketValue').fill('6500000')
    await figure(
      page,
      ROLE,
      '42-cmc-edit',
      'Update Collateral',
      [
        { target: money(form, 'CollateralOpenMarketValue'), tip: 'Change the values or the description' },
        { target: form.getByRole('button', { name: 'Save' }), tip: 'Click Save' },
      ],
      { clip: form },
    )
    await form.getByRole('button', { name: 'Save' }).click()
    await expect(toastWith(page, 'Collateral Saved Successfully')).toBeVisible()

    await page.goto('/home')
    await page.getByRole('link', { name: 'Manage Borrower Guarantor' }).click()
    await expect(page).toHaveURL(/\/ccg-list/)
    await page.getByLabel('Search guarantors').fill('Kiggundu')
    const atim = page.getByRole('row', { name: /Atim Grace/ })
    await expect(atim).toHaveCount(1)
    await figure(page, ROLE, '43-ccg-list', 'CCG: every guarantor captured', [
      { target: page.getByLabel('Search guarantors'), tip: 'Search by guarantor or borrower', side: 'below' },
      {
        target: page.getByRole('button', { name: `Edit guarantor ${CUSTOMER.stakeholderPerson}` }),
        tip: 'Edit the guarantee',
        side: 'left',
      },
    ])
    await page.getByRole('button', { name: `Edit guarantor ${CUSTOMER.stakeholderPerson}` }).click()
    const ccg = modal(page)
    await expect(ccg.getByLabel('Client number')).toHaveValue(CUSTOMER.stakeholderPerson)
    await figure(
      page,
      ROLE,
      '44-ccg-edit',
      'Edit a guarantor',
      [
        { target: ccg.getByLabel('Client number'), tip: 'The guarantor’s client number cannot be changed' },
        {
          target: ccg.locator('input[name="ValueOfGuarantorsCollateral"]'),
          tip: 'Change the value or the types, then Save Guarantor',
        },
      ],
      { clip: ccg },
    )
    await ccg.getByRole('button', { name: 'Cancel' }).click() // the fixture stays as it is

    await page.goto('/home')
    await page.getByRole('link', { name: '+ Borrower Stakeholder' }).click()
    await expect(page).toHaveURL(/\/bs-list/)
    await page.getByLabel('Search stakeholders').fill('Ssekandi')
    const bsRow = page.getByRole('row', { name: /Ssekandi David.*Nile Traders/ })
    await expect(bsRow).toHaveCount(1)
    await figure(page, ROLE, '45-bs-list', 'BS: every stakeholder of a company borrower', [
      {
        target: page.getByLabel('Search stakeholders'),
        tip: 'Search by stakeholder or company',
        side: 'below',
      },
      {
        target: bsRow.getByRole('button', { name: `Edit stakeholder ${CUSTOMER.jointPartner}` }),
        tip: 'Edit the stakeholder',
        side: 'left',
      },
    ])
    await bsRow.getByRole('button', { name: `Edit stakeholder ${CUSTOMER.jointPartner}` }).click()
    const bs = modal(page)
    await expect(bs.getByLabel('Client number')).toHaveValue(CUSTOMER.jointPartner)
    await figure(
      page,
      ROLE,
      '46-bs-edit',
      'Edit a stakeholder',
      [
        {
          target: bs.locator('input[name="ShareholderPercentage"]'),
          tip: 'Change the share or the category, then Save',
        },
      ],
      { clip: bs },
    )
    await bs.getByRole('button', { name: 'Cancel' }).click() // the fixture stays as it is

    // asking for a deletion: nothing is deleted until a checker approves
    await page.goto('/cmc-list')
    await page.getByLabel('Search collateral').fill(ref)
    await page.getByRole('button', { name: `Request deletion of ${ref}` }).click()
    await expect(dialog(page)).toContainText('You are about to submit a request to delete this Collateral!')
    await confirmDialog(page, 'Yes, Proceed!') // an empty reason is refused and the question comes back
    await expect(
      toastWith(page, 'The reason for your request to delete this record is required!'),
    ).toBeVisible()
    message(
      ROLE,
      'The reason for your request to delete this record is required!',
      'Type why the record should be deleted, then click Yes, Proceed! again.',
    )
    await page.locator('.swal2-textarea').fill('Captured against the wrong application')
    await figure(
      page,
      ROLE,
      '47-delete-reason',
      'Ask for a deletion: give the reason',
      [
        { target: page.locator('.swal2-textarea'), tip: 'Say why the record should go' },
        { target: page.locator('.swal2-confirm'), tip: 'Click Yes, Proceed!' },
      ],
      { clip: dialog(page) },
    )
    await confirmDialog(page, 'Yes, Proceed!')
    await expect(dialog(page)).toContainText('Request to Delete the Record has been submitted successfully!')
    await figure(
      page,
      ROLE,
      '48-delete-submitted',
      'The request is sent to a checker',
      [{ target: page.locator('.swal2-confirm'), tip: 'Click OK' }],
      { clip: dialog(page) },
    )
    message(
      ROLE,
      'Request to Delete the Record has been submitted successfully!',
      'Nothing is deleted yet. A checker decides on the Requests page; until then the record shows a red flag.',
    )
    await confirmDialog(page, 'OK')
    const flag = page.getByRole('img', { name: 'Deletion requested' })
    await expect(flag).toBeVisible()
    await figure(page, ROLE, '49-delete-flag', 'The red flag: a deletion is waiting for a checker', [
      { target: flag, tip: 'Edit and delete are gone until the checker decides', side: 'left' },
    ])
    message(
      ROLE,
      'A request to delete this record is already waiting for approval.',
      'Somebody has already asked for this record to be deleted. Wait for the checker’s decision on the Requests page.',
    )

    const request = await requestOf(api, 'collaterals', collateral.id)
    await page.getByRole('link', { name: 'Requests', exact: true }).click()
    await expect(page).toHaveURL(/\/requests/)
    await page.getByTestId('search').fill(request.request_id)
    const own = page.getByTestId(`request-${request.id}`)
    await expect(own).toContainText('Pending Approval')
    await figure(page, ROLE, '50-requests-own', 'Your request on the Requests page', [
      { target: page.getByTestId('status'), tip: 'Pending, Approved or Canceled', side: 'below' },
      { target: own.getByTestId('pending-badge'), tip: 'Pending Approval until a checker decides' },
      { target: own.getByTestId('waiting'), tip: 'You cannot decide your own request', side: 'left' },
    ])
    // the collateral is still there for everybody until the checker decides
    expect(
      ((await securities(api, app.creditApplicationReference)).collaterals as CollateralRow[]).some(
        (c) => c.CollateralReferenceNumber === ref,
      ),
    ).toBe(true)
    await api.dispose()
  })

  test('08 a branch user sees only the applications she captured', async ({ browser }) => {
    const branchApi = await Api.as('branch')
    const mine = await createApplication(branchApi, { clientNumber: CUSTOMER.nakawa, branch: '002' })
    const ctx = await browser.newContext({ storageState: authFile('branch') })
    const page = await ctx.newPage()
    await page.goto('/applications')
    const row = page.locator('div.group', { hasText: mine.creditApplicationReference })
    await expect(row).toBeVisible()
    await figure(
      page,
      ROLE,
      '51-branch-own-applications',
      'Without “View All Credit Applications” the list holds only your own CAPs',
      [
        {
          target: page.getByPlaceholder('search...'),
          tip: 'The search looks only in your own CAPs',
          side: 'below',
        },
        { target: row, tip: 'A CAP you captured', side: 'below' },
      ],
    )
    await ctx.close()
    await branchApi.dispose()
  })
})
