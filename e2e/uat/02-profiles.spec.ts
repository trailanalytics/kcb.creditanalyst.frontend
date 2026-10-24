import { expect, test } from '@playwright/test'
import { Api } from './support/api'
import { authFile } from './support/auth'
import { CUSTOMER } from './support/env'
import { nextFromPool, profile, profileId } from './support/data'
import { confirmDialog, dialog, expectAppReadable, toasts, unique } from './support/ui'

test.use({ storageState: authFile('officer') })

/** From the dashboard to the borrower's Edit Profile screen: Profiles, search, click the name, Edit Profile. */
async function openEditProfile(page: import('@playwright/test').Page, searchFor: string, fullName: string) {
  await page.goto('/home')
  await page.getByRole('link', { name: 'Profiles', exact: true }).click()
  await page.getByPlaceholder('Search by name, client no, FCS no...').fill(searchFor)
  await page.getByRole('link', { name: fullName }).click()
  await expect(page.getByText('Edit Profile')).toBeVisible()
  await page.getByRole('link', { name: 'Edit Profile' }).click()
  await expect(page.locator('input[name="GSCAFB_Surname"]').first()).toBeVisible()
}

test.describe('UAT-04 and UAT-05: update a borrower profile', () => {
  test('UAT-04 the borrower is found by name and by client number and the profile saves with a success message', async ({
    page,
  }) => {
    const employer = `UAT Employer ${unique()}`
    // the list finds the borrower by client number as well as by name
    await page.goto('/profiles')
    await page.getByPlaceholder('Search by name, client no, FCS no...').fill(CUSTOMER.profileEdit)
    await expect(page.getByRole('link', { name: 'Nakato Sarah Grace' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Okello James Peter' })).toHaveCount(0)

    await openEditProfile(page, 'Nakato', 'Nakato Sarah Grace')
    await page.locator('input[name="EI_EmployerName"]').fill(employer)
    await page.locator('input[name="PCI_Village"]').fill('Banda Valid')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(toasts(page).filter({ hasText: 'Profile Updated Successfully' })).toBeVisible()

    // reloading the screen shows what was saved, and so does the API
    await page.reload()
    await expect(page.locator('input[name="EI_EmployerName"]')).toHaveValue(employer)
    const api = await Api.as('officer')
    const saved = await profile(api, CUSTOMER.profileEdit)
    expect(saved.individual_details.EI_EmployerName).toBe(employer)
    expect(saved.PCI_Village).toBe('Banda Valid')
    await api.dispose()
  })

  test('UAT-04 a required field left empty is marked and nothing is saved', async ({ page }) => {
    await openEditProfile(page, 'Nakato', 'Nakato Sarah Grace')
    await page.locator('input[name="PCI_District"]').first().fill('')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(toasts(page).filter({ hasText: 'Kindly check inputs with a red border' })).toBeVisible()
    await expect(page.locator('input[name="PCI_District"]').first()).toHaveClass(/is-invalid/)
    const api = await Api.as('officer')
    expect((await profile(api, CUSTOMER.profileEdit)).PCI_District).toBe('Kampala')
    await api.dispose()
  })

  test('UAT-05 special characters & * ( ) # @ are stored exactly as typed (the expected failure message does not exist, see the script)', async ({
    page,
  }) => {
    const special = `A&B (Holdings) *#@ ${unique()}`
    await openEditProfile(page, CUSTOMER.profileSpecial, 'Mugisha Robert')
    await page.locator('input[name="EI_EmployerName"]').fill(special)
    await page.locator('input[name="EI_PrimaryOccupation"]').fill('Engineer & Co (#1) *@')
    await page.getByRole('button', { name: 'Save' }).click()
    // Neither the old nor the new system rejects these characters. The script expects a failure message; KCB has to decide
    // whether to add a rule. Until then the case checks that nothing is mangled.
    await expect(toasts(page).filter({ hasText: 'Profile Updated Successfully' })).toBeVisible()
    await expect(dialog(page)).toBeHidden()
    const api = await Api.as('officer')
    const saved = await profile(api, CUSTOMER.profileSpecial)
    expect(saved.individual_details.EI_EmployerName).toBe(special)
    expect(saved.individual_details.EI_PrimaryOccupation).toBe('Engineer & Co (#1) *@')
    await api.dispose()
    await page.reload()
    await expect(page.locator('input[name="EI_EmployerName"]')).toHaveValue(special)
  })

  test('the classification of a customer is changed after the question, and backing out changes nothing', async ({
    page,
  }) => {
    const crb = await Api.as('crb')
    const victim = await nextFromPool(crb, 'CUSTDEL')
    await page.goto(`/borrowers/edit/${victim.id}`)
    const select = page.locator('select[name="classificationCode"]')
    await expect(select).toHaveValue('0')
    // backing out: the select goes back to what it was
    await select.selectOption('1')
    await expect(dialog(page)).toContainText(
      'change the classification of this client from Individual to Non Individual',
    )
    await page.locator('.swal2-cancel').click()
    await expect(select).toHaveValue('0')
    // confirming swaps the record: the company fields appear
    await select.selectOption('1')
    await confirmDialog(page, 'Yes, Proceed')
    await expect(dialog(page)).toContainText('Client classification updated successfully!')
    await confirmDialog(page, 'OK')
    await expectAppReadable(page)
    await expect(page.locator('input[name="GSCAFB_BusinessName"]')).toBeVisible()
    expect((await profile(crb, victim.code)).classificationCode).toBe('1')
    await crb.dispose()
  })

  test('the profile page and the edit page follow the permissions of the user', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile('readonly') })
    const page = await ctx.newPage()
    const api = await Api.as('readonly')
    const id = await profileId(api, CUSTOMER.profileEdit)
    await page.goto(`/borrowers/${id}`)
    await expect(page.getByText('Nakato Sarah Grace')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Edit Profile' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: '+ New Cap' })).toHaveCount(0)
    await page.goto(`/borrowers/edit/${id}`)
    await expect(page).toHaveURL(/\/errors\/403/)
    await api.dispose()
    await ctx.close()
  })
})
