import { expect, test } from '@playwright/test'

const me = {
  id: 1,
  firstname: 'Jane',
  lastname: 'Doe',
  name: 'Jane Doe',
  email: 'jane@kcb.test',
  role: 'crb-officer',
  branchId: null,
  permissions: ['Download Crb Reports'],
}

test('signed-out visitors land on the login page', async ({ page }) => {
  await page.route('**/api/v1/me', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  )
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByText('LOGIN', { exact: true })).toBeVisible()
})

test('login then dashboard shows the tiles the user may use', async ({ page }) => {
  let signedIn = false
  await page.route('**/api/v1/me', (route) =>
    signedIn
      ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(me) })
      : route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  )
  await page.route('**/api/v1/auth/login', (route) => {
    signedIn = true
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(me) })
  })
  await page.goto('/login')
  await page.getByPlaceholder('KCB User ID/Email').fill('jane@kcb.test')
  await page.getByPlaceholder('Password').fill('secret')
  await page.getByRole('button', { name: 'Login' }).click()
  await expect(page).toHaveURL(/\/home/)
  await expect(page.getByText(/Good (morning|afternoon|evening), Doe/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'REPORTS' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'ANALYSIS' })).toHaveCount(0)
})
