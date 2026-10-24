import { expect, test, type Page, type Route } from '@playwright/test'

const me = {
  id: 1,
  firstname: 'Jane',
  lastname: 'Doe',
  name: 'Jane Doe',
  email: 'jane@kcb.test',
  role: 'crb-officer',
  branchId: null,
  permissions: ['Sync T24'],
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

async function signIn(page: Page, permissions = me.permissions) {
  await page.route('**/api/v1/me', (r) => json(r, { ...me, permissions }))
}

test('the commands tab asks for confirmation and starts the command', async ({ page }) => {
  await signIn(page)
  let started = ''
  await page.route('**/api/v1/t24/imported-records', (r) => json(r, {}))
  await page.route('**/api/v1/t24/commands', (r) =>
    json(r, [
      { name: 'customers', description: 'Extract New Customers from T24' },
      { name: 'loans', description: 'Extract New Loans from T24' },
    ]),
  )
  await page.route('**/api/v1/t24/commands/*/run', (r) => {
    started = new URL(r.request().url()).pathname
    return json(
      r,
      { message: 'The command was started. Follow it on the Background Processes page.', process_id: 4 },
      202,
    )
  })

  await page.goto('/t24/sync')
  await expect(page.getByText('No extraction has finished in the last 2 days.')).toBeVisible()
  await page.getByRole('tab', { name: 'T24 Commands' }).click()
  await page.getByRole('button', { name: 'Run Command' }).click()
  await expect(page.getByText('Select a command to run.')).toBeVisible()

  await page.getByLabel('Command').selectOption('loans')
  await page.getByRole('button', { name: 'Run Command' }).click()
  await expect(page.getByText('Are you sure you want to run this command?')).toBeVisible()
  await page.getByRole('button', { name: 'Yes, run command.' }).click()
  await expect(page.getByText('The command was started.')).toBeVisible()
  expect(started).toBe('/api/v1/t24/commands/loans/run')
})

test('imports show one card per date', async ({ page }) => {
  await signIn(page)
  await page.route('**/api/v1/t24/imported-records', (r) =>
    json(r, {
      '2026-10-24': [
        {
          id: 2,
          imported_records: 1520,
          record_category: 'loans',
          started_at: null,
          ended_at: null,
          imported_by: 'x',
          time_taken: '2m 10s',
        },
      ],
      '2026-10-23': [
        {
          id: 1,
          imported_records: 40,
          record_category: 'customers',
          started_at: null,
          ended_at: null,
          imported_by: 'x',
          time_taken: '5s',
        },
      ],
    }),
  )
  await page.goto('/t24')
  await expect(page.getByText('24, Oct 2026')).toBeVisible()
  await expect(page.getByText('Time taken to complete task: 2m 10s')).toBeVisible()
  await expect(page.getByText('23, Oct 2026')).toBeVisible()
})

test('forex rates are edited in place and added for the previous month end', async ({ page }) => {
  await signIn(page)
  let rates = [
    { id: 7, currency: 'USD', ugx_equivalent: 3700, month_ending: '20260930', added_by: 'a@b.test' },
  ]
  const sent: { edit?: unknown; add?: Record<string, string> } = {}
  await page.route('**/api/v1/t24/imported-records', (r) => json(r, {}))
  await page.route('**/api/v1/t24/forex-rates/7', (r) => {
    sent.edit = r.request().postDataJSON()
    rates = [{ ...rates[0]!, ugx_equivalent: 3725.5 }]
    return json(r, { message: 'Changes saved successfully!' })
  })
  await page.route('**/api/v1/t24/forex-rates', (r) => {
    if (r.request().method() === 'POST') {
      sent.add = r.request().postDataJSON()
      return json(r, { message: 'Changes saved successfully!' })
    }
    return json(r, rates)
  })

  await page.goto('/t24/sync')
  await page.getByRole('tab', { name: 'Forex Rates' }).click()
  await expect(page.getByText('30, Sep 2026')).toBeVisible()

  await page.getByRole('button', { name: 'Edit USD rate' }).click()
  const input = page.getByLabel('UGX equivalent of USD')
  await input.fill('3725.5')
  await input.press('Enter')
  await page.getByRole('button', { name: 'OK' }).click()
  await expect(page.getByRole('button', { name: 'Edit USD rate' })).toContainText('3725.50')
  expect(sent.edit).toEqual({ ugx: '3725.5' })

  await page.getByRole('button', { name: /Add Rate/ }).click()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Enter the UGX equivalent.')).toBeVisible()
  await page.getByPlaceholder('0').fill('29')
  await page.getByLabel('Currency:').selectOption('KES')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.getByRole('button', { name: 'OK' }).click()
  expect(sent.add?.currency).toBe('KES')
  expect(sent.add?.ugx).toBe('29')
  expect(sent.add?.month_ending).toMatch(/^\d{8}$/)
})

test('the password tab never shows the saved password', async ({ page }) => {
  await signIn(page, ['Sync T24', 'Update T24 Credentials'])
  let body: Record<string, string> = {}
  await page.route('**/api/v1/t24/imported-records', (r) => json(r, {}))
  await page.route('**/api/v1/t24/database', (r) =>
    json(r, {
      configured: true,
      username: 'dwh_user',
      expiry_date: '2026-11-30',
      expired: false,
      days_to_expiry: 30,
    }),
  )
  await page.route('**/api/v1/t24/credentials', (r) => {
    body = r.request().postDataJSON()
    return json(r, { message: 'DWH Credentials Updated Successfully' })
  })
  await page.goto('/t24/sync')
  await page.getByRole('tab', { name: 'T24 Password' }).click()
  await expect(page.getByPlaceholder('Leave blank to keep the current password')).toHaveValue('')
  await expect(page.getByText('The password expires on 30, Nov 2026 (30 days left).')).toBeVisible()
  await page.getByRole('button', { name: 'UPDATE CREDENTIALS' }).click()
  await expect(page.getByText('DWH Credentials Updated Successfully')).toBeVisible()
  expect(body.password).toBe('')
})

test('mapping clients needs a client, a number or auto map', async ({ page }) => {
  await signIn(page)
  await page.route('**/api/v1/t24/imported-records', (r) => json(r, {}))
  await page.route('**/api/v1/t24/un-synced', (r) =>
    json(r, [{ id: 1, client_number: 'L1', full_name: 'Okello James', nin: 'CM1' }]),
  )
  await page.route('**/api/v1/t24/sync-non-existing-clients', (r) =>
    json(r, { message: '1 Clients synced successfully, 0 Clients not found!' }),
  )
  await page.goto('/t24/sync')
  await page.getByRole('tab', { name: 'Map Client Numbers' }).click()
  await page.getByRole('button', { name: 'MAP CLIENTS' }).click()
  await expect(page.getByText('Please select a client to map')).toBeVisible()
  await page.getByLabel('Client to map').selectOption({ label: 'Okello James' })
  await page.getByRole('button', { name: 'MAP CLIENTS' }).click()
  await expect(page.getByText('1 Clients synced successfully, 0 Clients not found!')).toBeVisible()
})
