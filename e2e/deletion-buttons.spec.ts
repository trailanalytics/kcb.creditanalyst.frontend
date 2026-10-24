import { expect, test, type Page, type Route } from '@playwright/test'

const me = {
  id: 1,
  firstname: 'Jane',
  lastname: 'Doe',
  name: 'Jane Doe',
  email: 'jane@kcb.test',
  role: 'crb-officer',
  branchId: null,
  permissions: ['View Credit Applications', 'Delete Applications', 'View Profiles', 'Delete Profiles'],
}

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

async function signIn(page: Page, permissions = me.permissions) {
  await page.route('**/api/v1/me', (r) => json(r, { ...me, permissions }))
  await page.route('**/api/v1/reference/**', (r) => json(r, []))
}

const profileRow = {
  id: 5,
  clientNumber: '1000005',
  II_FCSNumber: 'FCS9',
  full_name: 'Okello James ',
  customer_type: 'Individual',
  classificationCode: '0',
}
const existence = {
  customer_id: 5,
  client_number: '1000005',
  full_name: 'Okello James',
  classification: 0,
  individual_name: 'Okello James',
  non_individual_name: 'Okello Traders Ltd',
  has_individual: true,
  has_non_individual: true,
  individual_id: 51,
  non_individual_id: 52,
}

test('deleting a profile: pick what to remove, give a reason, the request is filed and the row flagged', async ({
  page,
}) => {
  await signIn(page)
  let loads = 0
  await page.route('**/api/v1/profiles?**', (r) => {
    loads += 1
    return json(r, paged([profileRow]))
  })
  await page.route('**/api/v1/profiles/5/existence', (r) => json(r, existence))
  const sent: Record<string, unknown>[] = []
  await page.route('**/api/v1/deletion-requests', (r) => {
    sent.push(r.request().postDataJSON())
    return json(r, { message: 'Your deletion request has been submitted for approval.', id: 12 }, 201)
  })

  await page.goto('/profiles')
  await page.getByRole('button', { name: /Request deletion of Okello James/ }).click()

  await expect(page.getByRole('heading', { name: 'Delete Customer Profile' })).toBeVisible()
  await expect(
    page.getByText('This customer has both an Individual and a Non-Individual record.'),
  ).toBeVisible()
  // nothing chosen yet
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText('Please select a deletion option to proceed.')).toBeVisible()

  await page.getByLabel(/Remove Individual record/).check()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByRole('heading', { name: 'Confirm Deletion Request' })).toBeVisible()
  await expect(page.getByText(/the customer will be classified as Non-Individual/)).toBeVisible()

  // a blank reason is refused
  await page.getByRole('button', { name: 'Yes, Submit Request' }).click()
  await expect(page.getByText('A reason for the deletion request is required.')).toBeVisible()
  expect(sent).toHaveLength(0)

  await page.getByPlaceholder('State your reason for this deletion request...').fill('Wrong record captured')
  await page.getByRole('button', { name: 'Yes, Submit Request' }).click()
  await expect(page.getByText('Your deletion request has been submitted for approval.')).toBeVisible()
  await page.getByRole('button', { name: 'OK' }).click()

  expect(sent).toEqual([
    {
      record_id: 51,
      table_name: 'customer_individuals',
      deletion_scope: null,
      comment: 'Wrong record captured',
    },
  ])
  // flagged in place, no reload of the list
  await expect(page.locator('[title="This record has been requested to be deleted!"]')).toBeVisible()
  await expect(page.getByRole('button', { name: /Request deletion of/ })).toHaveCount(0)
  expect(loads).toBe(1)
})

test('deleting a whole profile sends the customer with the full scope; a refusal shows the server message', async ({
  page,
}) => {
  await signIn(page)
  await page.route('**/api/v1/profiles?**', (r) => json(r, paged([profileRow])))
  await page.route('**/api/v1/profiles/5/existence', (r) => json(r, existence))
  const sent: Record<string, unknown>[] = []
  await page.route('**/api/v1/deletion-requests', (r) => {
    sent.push(r.request().postDataJSON())
    return json(
      r,
      { title: 'Conflict', status: 409, detail: 'A deletion request is already open for this record.' },
      409,
    )
  })

  await page.goto('/profiles')
  await page.getByRole('button', { name: /Request deletion of Okello James/ }).click()
  await page.getByLabel(/Delete entire profile/).check()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText(/permanently delete the entire profile/)).toBeVisible()
  await page.getByPlaceholder('State your reason for this deletion request...').fill('Duplicate customer')
  await page.getByRole('button', { name: 'Yes, Submit Request' }).click()

  await expect(page.getByRole('heading', { name: 'Error' })).toBeVisible()
  await expect(page.getByText('A deletion request is already open for this record.')).toBeVisible()
  expect(sent).toEqual([
    { record_id: 5, table_name: 'customers', deletion_scope: 'customer_full', comment: 'Duplicate customer' },
  ])
  await page.getByRole('button', { name: 'OK' }).click()
  // the request failed: the row keeps its Delete button
  await expect(page.getByRole('button', { name: /Request deletion of/ })).toBeVisible()
})

const application = {
  id: 21,
  creditApplicationReference: 'KCB/CAP/202610/000021',
  clientNumber: '1000001',
  currency: 'UGX',
  Amount: '5000000',
  Term: '12',
  TermPeriod: 'Month',
  creditApplicationDate: '20261023',
  creditApplicationStatus: '2',
  jointAccountNumber: null,
  is_deleted: false,
  customer: {
    id: 1,
    full_name: 'Okello James Peter ',
    customer_type: 'Individual',
    clientNumber: '1000001',
    classificationCode: '0',
    individual_details: { II_CountryID: 'CM88' },
    non_individual_details: null,
  },
}

test('Delete Loan on the CAP list asks for a reason, files the request and flags the card', async ({
  page,
}) => {
  await signIn(page)
  await page.route('**/api/v1/applications?**', (r) => json(r, paged([application])))
  const sent: Record<string, unknown>[] = []
  await page.route('**/api/v1/deletion-requests', (r) => {
    sent.push(r.request().postDataJSON())
    return json(r, { message: 'Your deletion request has been submitted for approval.', id: 13 }, 201)
  })

  await page.goto('/applications')
  await page.getByText('KCB/CAP/202610/000021').hover()
  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('menuitem', { name: 'Delete Loan' }).click()

  await expect(
    page.getByText('You are about to submit a request to delete this Loan Application! Proceed?'),
  ).toBeVisible()
  // empty reason: the box stays open with the old message
  await page.getByRole('button', { name: 'Yes, Proceed!' }).click()
  await expect(
    page.getByText('The reason for your request to delete this Loan Application is required!'),
  ).toBeVisible()
  expect(sent).toHaveLength(0)

  await page
    .getByPlaceholder('Type your reason for deleting this Loan Application here...')
    .fill('Entered twice')
  await page.getByRole('button', { name: 'Yes, Proceed!' }).click()
  await expect(page.getByText('Your deletion request has been submitted for approval.')).toBeVisible()
  await page.getByRole('button', { name: 'OK' }).click()

  expect(sent).toEqual([{ record_id: 21, table_name: 'loan_applications', comment: 'Entered twice' }])
  await page.getByText('KCB/CAP/202610/000021').hover()
  await expect(page.locator('[title="This record has been requested to be deleted!"]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'More actions' })).toHaveCount(0)
})

test('without Delete Applications the CAP menu has no Delete Loan', async ({ page }) => {
  await signIn(page, ['View Credit Applications'])
  await page.route('**/api/v1/applications?**', (r) => json(r, paged([application])))
  await page.goto('/applications')
  await page.getByText('KCB/CAP/202610/000021').hover()
  await page.getByRole('button', { name: 'More actions' }).click()
  await expect(page.getByRole('menuitem', { name: 'Edit Loan' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Delete Loan' })).toHaveCount(0)
})
