import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { Api } from './support/api'
import { authFile } from './support/auth'
import { PASSWORD } from './support/env'
import { readXlsx } from './support/xlsx'
import { confirmDialog, dialog, toasts, unique } from './support/ui'

test.use({ storageState: authFile('admin') })

/** Fill the new user form of /users/new. */
async function createUserViaUi(
  page: Page,
  user: { first: string; last: string; email: string; password: string; role: string; permissions: string[] },
) {
  await page.goto('/users')
  await page.getByRole('link', { name: '+ New User' }).click()
  await expect(page).toHaveURL(/\/users\/new/)
  await page.getByLabel('First name').fill(user.first)
  await page.getByLabel('Last name').fill(user.last)
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Authentication').selectOption('credit_analyst')
  await page.locator('input[type="password"]').fill(user.password)
  await page.getByLabel('Role').selectOption(user.role)
  for (const permission of user.permissions)
    await page.getByRole('checkbox', { name: permission, exact: true }).check()
  await page.getByRole('button', { name: 'Create User' }).click()
}

test.describe('admin: users', () => {
  test('a user is created with a role and permissions, signs in and only gets what was ticked', async ({
    page,
    browser,
  }) => {
    const email = `uat.new.${unique()}@kcb.test`
    await createUserViaUi(page, {
      first: 'Newly',
      last: 'Created',
      email,
      password: 'Fresh#Pass2026',
      role: 'crb',
      permissions: ['View Profiles', 'View Credit Applications'],
    })
    await expect(toasts(page).filter({ hasText: 'User Created Successfully' })).toBeVisible()
    await expect(page).toHaveURL(/\/users$/)
    await page.getByLabel('Search users').fill(email)
    await expect(page.getByRole('row', { name: new RegExp(email) })).toContainText('crb')

    const fresh = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const own = await fresh.newPage()
    await own.goto('/login')
    await own.getByPlaceholder('KCB User ID/Email').fill(email)
    await own.getByPlaceholder('Password').fill('Fresh#Pass2026')
    await own.getByRole('button', { name: 'Login' }).click()
    await expect(own).toHaveURL(/\/home/)
    const me = await (await own.request.get('/api/v1/me')).json()
    expect(me.role).toBe('crb')
    expect(me.permissions).toEqual(expect.arrayContaining(['View Profiles', 'View Credit Applications']))
    expect(me.permissions).not.toContain('Create Applications')
    await own.goto('/applications/report')
    await expect(own).toHaveURL(/\/errors\/403/)
    await fresh.close()
  })

  test('the same email cannot be used twice and a short password is refused', async ({ page }) => {
    await page.goto('/users/new')
    await page.getByLabel('First name').fill('Dup')
    await page.getByLabel('Last name').fill('Licate')
    await page.getByLabel('Email').fill('uat.officer@kcb.test')
    await page.getByLabel('Authentication').selectOption('credit_analyst')
    await page.locator('input[type="password"]').fill('short')
    await page.getByRole('button', { name: 'Create User' }).click()
    await expect(page.getByText('The password must be at least 8 characters.')).toBeVisible()
    await page.locator('input[type="password"]').fill('LongEnough#2026')
    await page.getByRole('button', { name: 'Create User' }).click()
    await expect(dialog(page)).toContainText('A user with the same email account already exists!')
    await confirmDialog(page, 'OK')
  })

  test('a user is edited, disabled and can no longer sign in; the administrator cannot delete the own account', async ({
    page,
  }) => {
    const api = await Api.as('admin')
    const email = `uat.edit.${unique()}@kcb.test`
    await createUserViaUi(page, {
      first: 'Edit',
      last: 'Me',
      email,
      password: 'Fresh#Pass2026',
      role: 'crb',
      permissions: ['View Profiles'],
    })
    await expect(page).toHaveURL(/\/users$/)
    await page.getByLabel('Search users').fill(email)
    await page
      .getByRole('row', { name: new RegExp(email) })
      .getByRole('link', { name: 'Edit' })
      .click()
    await page.getByLabel('Status').selectOption('disabled')
    await page.getByRole('button', { name: 'Update User' }).click()
    await expect(toasts(page).filter({ hasText: 'Updated Successfully' })).toBeVisible()
    const attempt = await Api.login(email, 'Fresh#Pass2026')
    expect(attempt.api).toBeNull()
    // a user cannot delete the own account
    const me = (await api.get('/api/v1/me')).body
    const own = await api.delete(`/api/v1/users/${me.id}`)
    expect(own.status).toBe(422)
    expect(JSON.stringify(own.body)).toContain('You cannot delete your own account.')
    await api.dispose()
  })

  test('a user is asked for deletion, a checker approves and the user is signed out for good', async ({
    page,
  }) => {
    const admin = await Api.as('admin')
    const checker = await Api.as('checker')
    const email = `uat.gone.${unique()}@kcb.test`
    await createUserViaUi(page, {
      first: 'Soon',
      last: 'Gone',
      email,
      password: 'Fresh#Pass2026',
      role: 'crb',
      permissions: ['View Profiles'],
    })
    const session = await Api.login(email, 'Fresh#Pass2026')
    expect(session.api).not.toBeNull()
    expect((await session.api!.get('/api/v1/me')).status).toBe(200)

    await page.getByLabel('Search users').fill(email)
    await page.getByRole('button', { name: 'Request deletion of Soon Gone' }).click()
    await page.locator('.swal2-textarea').fill('Left the bank')
    await confirmDialog(page, 'Yes, Proceed!')
    await confirmDialog(page, 'OK')
    await expect(page.locator('[title="This user has been requested to be deleted!"]')).toBeVisible()
    // still signed in until the checker decides
    expect((await session.api!.get('/api/v1/me')).status).toBe(200)

    const users = await admin.get('/api/v1/users', { search: email })
    const id = users.body.data[0].id
    const list = await admin.get('/api/v1/deletion-requests', { search: String(id), status: 0 })
    const request = list.body.data.find((r: any) => r.table_name === 'users' && r.record_id === id)
    expect((await checker.post(`/api/v1/deletion-requests/${request.id}/approve`, {})).status).toBe(200)
    expect((await session.api!.get('/api/v1/me')).status).toBe(401)
    expect((await Api.login(email, 'Fresh#Pass2026')).api).toBeNull()
    await session.api!.dispose()
    await admin.dispose()
    await checker.dispose()
  })

  test('the users pages need the user permissions', async ({ browser }) => {
    const readonly = await browser.newContext({ storageState: authFile('readonly') })
    const page = await readonly.newPage()
    await page.goto('/users')
    // a role without admin access is sent home, whatever the permissions
    await expect(page).toHaveURL(/\/home/)
    await readonly.close()
    const noPermission = await Api.as('officer')
    expect((await noPermission.get('/api/v1/users')).status).toBe(403)
    expect((await noPermission.post('/api/v1/users', {})).status).toBe(403)
    await noPermission.dispose()
  })
})

test.describe('admin: dashboard, logs and statistics', () => {
  test('the admin dashboard offers users, statistics and configuration', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.getByRole('link', { name: 'Users', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Statistics', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Configurations', exact: true })).toBeVisible()
  })

  test('the activity log shows what was done, the login log shows sign-ins and deleted records are counted', async ({
    page,
  }) => {
    const api = await Api.as('admin')
    await Api.login('uat.admin@kcb.test', PASSWORD) // a fresh sign-in for the login log
    await page.goto('/logs')
    await page.getByLabel('Search logs').fill('created user')
    await expect(page.getByRole('row', { name: /created user/ }).first()).toBeVisible()
    await page.getByRole('tab', { name: 'Login Logs' }).click()
    await page.getByLabel('Search logs').fill('uat.admin')
    await expect(page.getByRole('row').nth(1)).toBeVisible()
    await page.getByRole('tab', { name: 'Deleted Records' }).click()
    await expect(page.getByRole('cell', { name: 'collaterals' })).toBeVisible()
    const counts = await api.get('/api/v1/deleted-records-count')
    expect(counts.status).toBe(200)
    await api.dispose()
  })

  test('the logs are exported as CSV and as an Excel workbook', async ({ page }) => {
    await page.goto('/logs')
    await page.getByRole('button', { name: 'Export' }).click()
    await page.locator('select').filter({ hasText: 'Login logs' }).selectOption('activity-logs')
    const csv = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download' }).click()
    const csvFile = await csv
    expect(csvFile.suggestedFilename()).toMatch(/\.csv$/)
    expect((await readFile((await csvFile.path()) as string, 'utf8')).length).toBeGreaterThan(20)

    await page.getByRole('button', { name: 'Export' }).click()
    await page.locator('select').filter({ hasText: 'CSV' }).selectOption('xlsx')
    const xlsx = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download' }).click()
    const xlsxFile = await xlsx
    expect(xlsxFile.suggestedFilename()).toMatch(/\.xlsx$/)
    const rows = readXlsx(await readFile((await xlsxFile.path()) as string))
    expect(rows.length).toBeGreaterThan(1)
  })

  test('the statistics need View Statistics', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile('officer') })
    const page = await ctx.newPage()
    await page.goto('/logs')
    await expect(page).toHaveURL(/\/errors\/403/)
    const api = await Api.as('officer')
    expect((await api.get('/api/v1/activity-logs')).status).toBe(403)
    expect((await api.get('/api/v1/login-logs')).status).toBe(403)
    await api.dispose()
    await ctx.close()
  })
})

test.describe('admin: configuration', () => {
  test('the CRB application charge is saved and validated', async ({ page }) => {
    const amount = String(1000 + Math.floor(Math.random() * 9000))
    await page.goto('/admin/configuration')
    await page.getByRole('tab', { name: 'CRB Application Charges' }).click()
    await page.locator('input[name="crb_suspense_account"]').fill('')
    await page.getByRole('button', { name: 'SAVE CHANGES' }).click()
    await expect(page.locator('.text-danger').first()).toBeVisible()
    await page.locator('input[name="crb_suspense_account"]').fill('0123456789')
    await page.locator('input[name="credit_amount"]').fill(amount)
    await page.getByRole('button', { name: 'SAVE CHANGES' }).click()
    await expect(dialog(page)).toContainText(/Saved|Success|Updated/i)
    await confirmDialog(page, 'OK')
    const api = await Api.as('admin')
    const config = await api.get('/api/v1/admin/configuration')
    expect(config.body.crb_charge.crb_suspense_account).toBe('0123456789')
    expect(Number(config.body.crb_charge.credit_amount)).toBe(Number(amount))
    await api.dispose()
  })

  test('the T24 credentials tab shows the state of the warehouse login', async ({ page }) => {
    await page.goto('/admin/configuration')
    await expect(page.getByRole('tab', { name: 'T24 Credentials' })).toBeVisible()
    const api = await Api.as('admin')
    const config = await api.get('/api/v1/admin/configuration')
    expect(config.status).toBe(200)
    expect(config.body.t24).toBeDefined()
    await api.dispose()
  })

  test('the configuration is closed to users without Manage Configurations', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile('officer') })
    const page = await ctx.newPage()
    await page.goto('/admin/configuration')
    await expect(page).toHaveURL(/\/errors\/403/)
    const api = await Api.as('officer')
    expect((await api.get('/api/v1/admin/configuration')).status).toBe(403)
    await api.dispose()
    await ctx.close()
  })
})
