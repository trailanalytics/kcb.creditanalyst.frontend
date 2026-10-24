import { expect, test } from '@playwright/test'
import { Api } from './support/api'
import { PERSONAS } from './support/env'
import { dialog, loginViaUi } from './support/ui'

test.describe('UAT-01 to UAT-03: signing in and out', () => {
  test('UAT-01 a user with valid credentials logs in and sees the menus', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
    await loginViaUi(page, 'officer')
    await expect(page).toHaveURL(/\/home/)
    await expect(page.getByText(/Good (morning|afternoon|evening), Officer/)).toBeVisible()
    // the dashboard shows the CAP tile and the Profiles menu of the navigation bar
    await expect(page.getByRole('link', { name: 'Manage Credit Applications' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Profiles', exact: true })).toBeVisible()
    // the officer has no report permission, so the Reports tile is not offered
    await expect(page.getByRole('link', { name: 'REPORTS', exact: true })).toHaveCount(0)
  })

  test('UAT-02 a wrong password and an unknown email are refused and show no menus', async ({ page }) => {
    await loginViaUi(page, 'officer', 'not-the-password')
    await expect(dialog(page)).toBeVisible()
    await expect(dialog(page)).toContainText(/credentials|password|email/i)
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('link', { name: 'Profiles', exact: true })).toHaveCount(0)

    await page.reload()
    await page.getByPlaceholder('KCB User ID/Email').fill('nobody@kcb.test')
    await page.getByPlaceholder('Password').fill('whatever-123')
    await page.getByRole('button', { name: 'Login' }).click()
    await expect(dialog(page)).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('UAT-02 a disabled user cannot sign in', async ({ page }) => {
    await loginViaUi(page, 'disabled')
    await expect(dialog(page)).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
    const attempt = await Api.login(PERSONAS.disabled, (await import('./support/env')).PASSWORD)
    expect(attempt.api).toBeNull()
    expect([401, 403, 422]).toContain(attempt.status)
  })

  test('UAT-02 empty fields are reported on the form', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Login' }).click()
    await expect(page.getByRole('alert').first()).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('UAT-03 logging out ends the session', async ({ page }) => {
    await loginViaUi(page, 'officer')
    await expect(page).toHaveURL(/\/home/)
    await page.getByRole('button', { name: 'Log out' }).click()
    await expect(page).toHaveURL(/\/login/)
    // the old session is gone: the API refuses and a protected page sends the user back to the login
    const me = await page.request.get('/api/v1/me')
    expect(me.status()).toBe(401)
    await page.goto('/applications')
    await expect(page).toHaveURL(/\/login/)
    // the back button does not bring a signed-in page back
    await page.goBack()
    await expect(page.getByRole('link', { name: 'Profiles', exact: true })).toHaveCount(0)
  })
})
