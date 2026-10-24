import { expect, test, type Route } from '@playwright/test'

const me = {
  id: 1,
  firstname: 'Jane',
  lastname: 'Doe',
  name: 'Jane Doe',
  email: 'jane@kcb.test',
  role: 'admin',
  branchId: null,
  permissions: ['Manage Configurations', 'Update T24 Credentials'],
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

test('CRB charges are validated, saved and shown with thousands separators', async ({ page }) => {
  await page.route('**/api/v1/me', (r) => json(r, me))
  let charge = { crb_suspense_account: 'UGX1459834040022', credit_amount: 5000 }
  let sent: Record<string, string> = {}
  await page.route('**/api/v1/admin/configuration', (r) =>
    json(r, {
      t24: {
        configured: true,
        username: 'dwh_user',
        expiry_date: '2026-11-30',
        expired: false,
        days_to_expiry: 30,
      },
      crb_charge: charge,
    }),
  )
  await page.route('**/api/v1/admin/configuration/crb-charges', (r) => {
    sent = r.request().postDataJSON()
    charge = { crb_suspense_account: sent.crb_suspense_account!, credit_amount: 12500 }
    return json(r, { message: 'CRB Charges Saved Successfully!' })
  })

  await page.goto('/admin/configuration')
  await expect(page.getByLabel('Username')).toHaveValue('dwh_user')
  await expect(page.getByLabel('Password')).toHaveValue('')

  await page.getByRole('tab', { name: 'CRB Application Charges' }).click()
  await expect(page.getByLabel('Credit Amount')).toHaveValue('5,000')
  await page.getByLabel('Credit Amount').fill('50')
  await page.getByRole('button', { name: 'SAVE CHANGES' }).click()
  await expect(page.getByText('Invalid CRB Charge Amount!')).toBeVisible()

  await page.getByLabel('Credit Amount').fill('12,500')
  await page.getByRole('button', { name: 'SAVE CHANGES' }).click()
  await expect(page.getByText('CRB Charges Saved Successfully!')).toBeVisible()
  await page.getByRole('button', { name: 'OK' }).click()
  expect(sent.credit_amount).toBe('12,500')
  // the tab stays where it was
  await expect(page.getByLabel('Credit Amount')).toHaveValue('12,500')
})

test('a failed warehouse login shows on the password field', async ({ page }) => {
  await page.route('**/api/v1/me', (r) => json(r, me))
  await page.route('**/api/v1/admin/configuration', (r) =>
    json(r, { t24: { configured: false }, crb_charge: { crb_suspense_account: '', credit_amount: 0 } }),
  )
  await page.route('**/api/v1/admin/configuration/t24-credentials', (r) =>
    json(
      r,
      {
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Failed to establish a connection using the provided credentials!',
        errors: { password: ['Failed to establish a connection using the provided credentials!'] },
      },
      422,
    ),
  )
  await page.goto('/admin/configuration')
  await page.getByLabel('Username').fill('dwh_user')
  await page.getByLabel('Password').fill('wrong')
  await page.getByRole('button', { name: 'SAVE CHANGES' }).click()
  await expect(
    page.getByText('Failed to establish a connection using the provided credentials!').first(),
  ).toBeVisible()
})
