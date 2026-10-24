import { expect, test, type Page, type Route } from '@playwright/test'

const me = (permissions: string[]) => ({
  id: 1,
  firstname: 'Jane',
  lastname: 'Doe',
  name: 'Jane Doe',
  email: 'jane@kcb.test',
  role: 'crb-officer',
  branchId: null,
  permissions,
})

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

const request = (id: number, status = 0, extra: Record<string, unknown> = {}) => ({
  id,
  request_id: `DDR-20261024-C${id}`,
  record_id: id,
  table_name: 'collaterals',
  deletion_scope: null,
  request_status: status,
  request_comment: 'Duplicate of another collateral',
  requested_by: 7,
  requested_by_name: 'Mia Maker',
  requested_at: '2026-10-24T08:30:00',
  actioned_by: status ? 9 : null,
  actioned_by_name: status ? 'Cy Checker' : null,
  actioned_at: status ? '2026-10-25T09:00:00' : null,
  approval_comment: status ? 'N/A' : '',
  record_label: `KCB/CMC/${id} - Ann Borrower`,
  ...extra,
})

async function signIn(page: Page, permissions: string[]) {
  await page.route('**/api/v1/me', (r) => json(r, me(permissions)))
}

const CHECKER = ['View Deletion Requests', 'Approve Deletion Requests', 'Cancel Deletion Requests']

test('a checker approves a pending request after the warning and the list is refreshed', async ({ page }) => {
  await signIn(page, CHECKER)
  let approved = false
  const asked: string[] = []
  await page.route('**/api/v1/deletion-requests?**', (r) => {
    asked.push(new URL(r.request().url()).searchParams.get('status') ?? '')
    return json(r, paged(approved ? [] : [request(5)]))
  })
  await page.route('**/api/v1/deletion-requests/5/approve', (r) => {
    approved = true
    return json(r, { message: 'Request Approved Successfully!' })
  })
  await page.goto('/requests')
  const row = page.getByTestId('request-5')
  await expect(row).toContainText('DDR-20261024-C5')
  await expect(row.getByTestId('pending-badge')).toHaveText('Pending Approval')
  await expect(row).toContainText('KCB/CMC/5 - Ann Borrower')
  await expect(row).toContainText('Mia Maker')
  await expect(row).toContainText('24, Oct 2026')
  expect(asked[0]).toBe('0')

  await row.getByTestId('approve').click()
  await expect(
    page.getByText(
      'This Request will be approved and the corresponding record will be deleted and removed from listing! Proceed?',
    ),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Yes, Proceed!' }).click()
  await expect(page.getByText('Request Approved Successfully!')).toBeVisible()
  await page.getByRole('button', { name: 'OK' }).click()
  await expect(page.getByTestId('request-5')).toHaveCount(0)
})

test('declining uses its own warning and the status filter shows the decided requests', async ({ page }) => {
  await signIn(page, CHECKER)
  await page.route('**/api/v1/deletion-requests?**', (r) => {
    const status = new URL(r.request().url()).searchParams.get('status')
    if (status === '2') return json(r, paged([request(8, 2)]))
    if (status === '1') return json(r, paged([request(7, 1)]))
    return json(r, paged([request(6)]))
  })
  let declined = false
  await page.route('**/api/v1/deletion-requests/6/cancel', (r) => {
    declined = true
    return json(r, { message: 'Request Canceled Successfully!' })
  })
  await page.goto('/requests')
  await page.getByTestId('request-6').getByTestId('cancel').click()
  await expect(
    page.getByText(
      'This Request will be canceled and the corresponding record will not be deleted! Proceed?',
    ),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Yes, Proceed!' }).click()
  await expect(page.getByText('Request Canceled Successfully!')).toBeVisible()
  expect(declined).toBe(true)
  await page.getByRole('button', { name: 'OK' }).click()

  await page.getByTestId('status').selectOption('1')
  await expect(page.getByTestId('request-7').getByTestId('approved-badge')).toHaveText('Request Approved')
  await expect(page.getByTestId('request-7')).toContainText('(Record was deleted)')
  await expect(page.getByTestId('request-7').getByTestId('approve')).toHaveCount(0)
  await page.getByTestId('status').selectOption('2')
  await expect(page.getByTestId('request-8').getByTestId('canceled-badge')).toHaveText('Request Canceled')
  await expect(page.getByTestId('request-8')).toContainText('(Record retained)')
})

test('the server refusing a decision is shown as an error', async ({ page }) => {
  await signIn(page, CHECKER)
  await page.route('**/api/v1/deletion-requests?**', (r) => json(r, paged([request(9)])))
  await page.route('**/api/v1/deletion-requests/9/approve', (r) =>
    json(
      r,
      { title: 'Conflict', status: 409, detail: 'This request was not found or has already been actioned.' },
      409,
    ),
  )
  await page.goto('/requests')
  await page.getByTestId('request-9').getByTestId('approve').click()
  await page.getByRole('button', { name: 'Yes, Proceed!' }).click()
  await expect(page.getByText('This request was not found or has already been actioned.')).toBeVisible()
})

test('View opens the record in a modal, or says it is gone', async ({ page }) => {
  await signIn(page, CHECKER)
  await page.route('**/api/v1/deletion-requests?**', (r) => json(r, paged([request(3), request(4)])))
  await page.route('**/api/v1/deletion-requests/3', (r) =>
    json(r, {
      id: 3,
      request_id: 'DDR-20261024-C3',
      table_name: 'collaterals',
      record_id: 3,
      record_label: 'KCB/CMC/3 - Ann Borrower',
      record: { id: 3, CollateralReferenceNumber: 'KCB/CMC/3', CollateralType: '1', ValuationDate: null },
    }),
  )
  await page.route('**/api/v1/deletion-requests/4', (r) =>
    json(r, {
      id: 4,
      request_id: 'x',
      table_name: 'collaterals',
      record_id: 4,
      record_label: null,
      record: null,
    }),
  )
  await page.goto('/requests')
  await page.getByTestId('request-3').getByTestId('view').click()
  const modal = page.getByTestId('record-modal')
  await expect(modal).toContainText('Record Details')
  await expect(modal.getByRole('columnheader', { name: 'CollateralReferenceNumber' })).toBeVisible()
  await expect(modal.getByRole('cell', { name: 'KCB/CMC/3', exact: true })).toBeVisible()
  await modal.getByRole('button', { name: 'Close' }).click()
  await expect(modal).toHaveCount(0)

  await page.getByTestId('request-4').getByTestId('view').click()
  await expect(page.getByText('Oops, record not found!')).toBeVisible()
})

test('a maker only sees the own pending request without buttons, and search is sent as typed', async ({
  page,
}) => {
  await signIn(page, ['View Deletion Requests'])
  const searches: string[] = []
  await page.route('**/api/v1/deletion-requests?**', (r) => {
    searches.push(new URL(r.request().url()).searchParams.get('search') ?? '')
    return json(r, paged([request(2, 0, { requested_by: 1 })]))
  })
  await page.goto('/requests')
  const row = page.getByTestId('request-2')
  await expect(row.getByTestId('waiting')).toBeVisible()
  await expect(row.getByTestId('approve')).toHaveCount(0)
  await expect(row.getByTestId('cancel')).toHaveCount(0)
  await page.getByTestId('search').fill('DDR-20261024-C2')
  await expect.poll(() => searches.at(-1)).toBe('DDR-20261024-C2')
})

test('without View Deletion Requests the page is refused', async ({ page }) => {
  await signIn(page, ['Manage Branches'])
  await page.goto('/requests')
  await expect(page).toHaveURL(/errors\/403/)
})
