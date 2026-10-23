import { expect, test } from '@playwright/test'
// Unauthenticated visitors are sent to the login page. Extended to login -> dashboard -> CAP create in M2/M3.
test('redirects to login when signed out', async ({ page }) => {
  await page.route('**/api/v1/me', (route) => route.fulfill({ status: 401, body: '{}' }))
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})
