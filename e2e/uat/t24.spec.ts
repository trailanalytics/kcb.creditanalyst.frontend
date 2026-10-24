import { expect, test } from '@playwright/test'
import { Api } from './support/api'
import { authFile } from './support/auth'
import { CUSTOMER } from './support/env'
import { confirmDialog, dialog, expectAppReadable, unique } from './support/ui'

test.describe('UAT-22: force import of a profile from the bank database', () => {
  test.use({ storageState: authFile('officer') })

  test('a client found by its account number in the T24 extract is shown with a New Loan link', async ({
    page,
  }) => {
    await page.goto('/profiles')
    await page.getByRole('link', { name: 'Import from T24' }).click()
    await expect(page).toHaveURL(/\/find-in-t24/)
    await page.locator('#t24-search').fill(`0100${CUSTOMER.main}`)
    await page.getByRole('button', { name: 'Find' }).click()
    await expect(
      page.getByText('The following record has been imported from T24 to credit analyst'),
    ).toBeVisible()
    await expect(page.getByRole('row', { name: /Okello James Peter/ })).toContainText(CUSTOMER.main)
    await page.getByRole('link', { name: 'New Loan' }).click()
    await expect(page).toHaveURL(new RegExp(`/applications/create/${CUSTOMER.main}`))
  })

  test('a client number that is nowhere is reported, and an empty search is refused', async ({ page }) => {
    await page.goto('/find-in-t24')
    await page.locator('#t24-search').fill(`NOSUCH${unique()}`)
    await page.getByRole('button', { name: 'Find' }).click()
    await expect(page.getByRole('alert')).toContainText('does not exist in T24')
    const api = await Api.as('officer')
    const empty = await api.post('/api/v1/profiles/force-find', { search: '  ' })
    expect(empty.status).toBe(422)
    expect(empty.body.message).toBe('Enter a client number or an account number.')
    // the text is a value, not part of a query: quotes and SQL words are just a search that finds nothing
    const injection = await api.post('/api/v1/profiles/force-find', { search: "x' OR '1'='1" })
    expect(injection.status).toBe(404)
    await api.dispose()
  })
})

test.describe('T24 sync: commands, credentials, mapping and forex rates', () => {
  test.use({ storageState: authFile('admin') })

  test('the T24 page offers its five tabs and the commands of the extract and merge jobs', async ({
    page,
  }) => {
    await page.goto('/admin')
    await page.goto('/t24')
    for (const tab of ['T24 Imports', 'T24 Commands', 'T24 Password', 'Map Client Numbers', 'Forex Rates'])
      await expect(page.getByRole('tab', { name: tab })).toBeVisible()
    await page.getByRole('tab', { name: 'T24 Commands' }).click()
    const options = await page.getByLabel('Command').locator('option').allInnerTexts()
    expect(options.join('|')).toContain('customers (Extract New Customers from T24)')
    expect(options.join('|')).toContain('merge-loans (Merge Extracted Loans)')
  })

  test('running a command without a warehouse starts a process that fails with the reason (needs a real Oracle to succeed)', async ({
    page,
  }) => {
    await page.goto('/t24')
    await page.getByRole('tab', { name: 'T24 Commands' }).click()
    await page.getByRole('button', { name: 'Run Command' }).click()
    await expect(page.getByText('Select a command to run.')).toBeVisible()
    await page.getByLabel('Command').selectOption('loan-balances')
    await page.getByRole('button', { name: 'Run Command' }).click()
    await expect(dialog(page)).toContainText('Are you sure you want to run this command?')
    await confirmDialog(page, 'Yes, run command.')
    await expect(dialog(page)).toContainText('The command has been started')
    await confirmDialog(page, 'OK')
    await expectAppReadable(page)
    const api = await Api.as('admin')
    let process: any
    await expect
      .poll(
        async () => {
          const list = await api.get('/api/v1/background-processes')
          process = (list.body.data ?? []).find(
            (p: any) => /loan/i.test(p.title) && /T24|extract|balance/i.test(p.title),
          )
          return process?.status
        },
        { timeout: 90_000, intervals: [2000] },
      )
      .toBe('failed')
    expect(String(process.error_message)).toMatch(/warehouse|T24|Oracle|configured|connect/i)
    await api.dispose()
  })

  test('the warehouse login is not saved while no warehouse is set up, and the status says so', async ({
    page,
  }) => {
    const api = await Api.as('admin')
    const database = await api.get('/api/v1/t24/database')
    expect(database.body.configured).toBe(false)
    await page.goto('/t24')
    await page.getByRole('tab', { name: 'T24 Password' }).click()
    await expect(page.getByText(/not set up|not configured|no warehouse|unavailable/i).first()).toBeVisible()
    const save = await api.put('/api/v1/t24/credentials', { username: 'x', password: 'y' })
    expect(save.status).toBeGreaterThanOrEqual(400)
    await api.dispose()
  })

  test('forex rates are listed, one is changed in place and a new rate is added', async ({ page }) => {
    const newRate = `${3500 + Math.floor(Math.random() * 400)}.25`
    await page.goto('/t24')
    await page.getByRole('tab', { name: 'Forex Rates' }).click()
    await expect(page.getByTestId('forex-row').first()).toBeVisible()
    await page.getByRole('button', { name: 'Edit USD rate' }).first().click()
    await page.getByLabel('UGX equivalent of USD').fill(newRate)
    await page.getByLabel('UGX equivalent of USD').press('Enter')
    await expect(dialog(page)).toContainText('Changes saved successfully!')
    await confirmDialog(page, 'OK')
    await expect(page.getByRole('button', { name: 'Edit USD rate' }).first()).toContainText(
      Number(newRate).toFixed(2),
    )
    // a rate that is not a number or is not above zero is refused
    await page.getByRole('button', { name: 'Edit USD rate' }).first().click()
    await page.getByLabel('UGX equivalent of USD').fill('0')
    await page.getByLabel('UGX equivalent of USD').press('Enter')
    await expect(page.getByRole('alert').filter({ hasText: /greater than zero|valid|number/i })).toBeVisible()
    await page.getByLabel('UGX equivalent of USD').press('Escape')

    await page.getByRole('button', { name: /Add Rate/ }).click()
    await page.getByRole('combobox').first().selectOption('KES')
    await page.locator('input[name="ugx"]').fill('28.75')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(dialog(page)).toContainText('Changes saved successfully!')
    await confirmDialog(page, 'OK')
    await expectAppReadable(page)
    await expect(page.getByTestId('forex-row').filter({ hasText: 'KES' }).first()).toBeVisible()
  })

  test('clients created locally are listed for mapping to their T24 number', async ({ page }) => {
    const api = await Api.as('admin')
    const unsynced = await api.get('/api/v1/t24/un-synced')
    expect(unsynced.status).toBe(200)
    expect(Array.isArray(unsynced.body)).toBe(true)
    await page.goto('/t24')
    await page.getByRole('tab', { name: 'Map Client Numbers' }).click()
    await page
      .getByRole('button', { name: /^SYNC|Sync|Map/i })
      .first()
      .click()
    await expect(page.getByRole('alert')).toContainText('Please select a client to map')
    await api.dispose()
  })

  test('the T24 pages need Sync T24 and the credentials need Update T24 Credentials', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile('officer') })
    const page = await ctx.newPage()
    for (const path of ['/t24', '/t24/sync']) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/errors\/403/)
    }
    const api = await Api.as('officer')
    expect((await api.get('/api/v1/t24/commands')).status).toBe(403)
    expect((await api.post('/api/v1/t24/commands/customers/run', {})).status).toBe(403)
    expect((await api.get('/api/v1/t24/forex-rates')).status).toBe(403)
    await api.dispose()
    await ctx.close()
  })
})
