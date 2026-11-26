import { expect, type Locator, type Page } from '@playwright/test'
import type { Api } from '../../uat/support/api'
import { fillProfile, modal, toasts } from '../../uat/support/ui'

/**
 * Steps the guide journeys share. The selectors are the ones the UAT specs (e2e/uat) already use; only the helpers that live
 * inside a spec file there are repeated here, so nothing under e2e/uat changes.
 */

/** The visible box of the CAP amount (the named input next to it is hidden). */
export const amountInput = (page: Page) =>
  page.locator('input[name="amount"] >> xpath=preceding-sibling::input')

/** The "Loan Details" section of the CAP form (create and edit). */
export async function fillLoan(
  page: Page,
  loan: { amount: string; type?: string; purpose?: string; term?: string; period?: string; branch?: string },
) {
  await amountInput(page).fill(loan.amount)
  await page.locator('#cap-type').selectOption(loan.type ?? '2')
  await page.locator('#cap-term').fill(loan.term ?? '12')
  await page.getByLabel('Term period').selectOption(loan.period ?? 'Month')
  await page.locator('#cap-purpose').selectOption(loan.purpose ?? '1')
  await page.locator('#cap-branch').selectOption(loan.branch ?? '001')
}

/** The CAP card of the dashboard. */
export const capTile = (page: Page) =>
  page.locator('div.shadow-md', { hasText: 'Credit Applications' }).first()

/** A dashboard card by the grey line under its title ("Collateral Material", "Borrower Stakeholder" ...). */
export const tile = (page: Page, subtitle: string) =>
  page.locator('div.shadow-md', { hasText: subtitle }).first()

/** Open the arrow menu of the CAP card (Applications Report, Bulk Approval, Non Existing Customer, Joint Application). */
export async function openCapTileMenu(page: Page) {
  await capTile(page).getByRole('button', { name: 'More' }).click()
  await expect(page.getByRole('menuitem').first()).toBeVisible()
}

/** The row of the CAP list for a reference (the list is searched first). */
export async function findApplicationRow(page: Page, reference: string): Promise<Locator> {
  await page.goto('/applications')
  await page.getByPlaceholder('search...').fill(reference)
  const row = page.locator('div.group', { hasText: reference })
  await expect(row).toHaveCount(1)
  return row
}

/** Hover a CAP row and open its "More actions" arrow, leaving the menu open for a picture. */
export async function openRowMenu(page: Page, row: Locator) {
  // the list is drawn again when it reloads under the pointer: try the whole gesture again rather than one click
  await expect(async () => {
    if (!(await page.getByRole('menuitem').first().isVisible())) {
      await row.hover()
      await row.getByRole('button', { name: 'More actions' }).click()
    }
    await expect(page.getByRole('menuitem').first()).toBeVisible({ timeout: 5_000 })
  }).toPass({ timeout: 40_000 })
}

/** A toast (bottom left) with this text. */
export const toastWith = (page: Page, text: string | RegExp) => toasts(page).filter({ hasText: text }).first()

/** 13 character FCS number and 14 character NIN that are new every run (made-up, the format the forms check). */
export function newIds() {
  const stamp = String(Date.now()).slice(-9)
  return { fcs: `FCS${stamp}0`, nin: `CM${stamp}GDE` }
}

/** The guarantor dialog: its own fields, then the embedded profile of a new guarantor. */
export async function fillGuarantor(
  page: Page,
  opts: { company?: boolean; surname?: string; forename?: string; value?: string },
) {
  const form = modal(page)
  await form.locator('select[name="branchCode"]').selectOption('001')
  await form.locator('input[name="ValueOfGuarantorsCollateral"]').fill(opts.value ?? '7500000')
  await form.locator('select[name="GuaranteeType"]').selectOption('1')
  await form.locator('select[name="GuarantorType"]').selectOption('0')
  const { fcs, nin } = newIds()
  await fillProfile(page, {
    root: form,
    embedded: true,
    company: opts.company,
    fcs,
    nin,
    surname: opts.surname,
    forename: opts.forename,
    yearOfBirth: 1985,
  })
}

/** The stakeholder dialog: its own fields, then the embedded profile of a new stakeholder. */
export async function fillStakeholder(
  page: Page,
  opts: { company?: boolean; surname?: string; forename?: string; percentage?: string },
) {
  const form = modal(page)
  await form.locator('select[name="branchCode"]').selectOption('001')
  await form.locator('input[name="ShareholderPercentage"]').fill(opts.percentage ?? '20')
  await form.locator('select[name="StakeholderCategory"]').selectOption('1')
  const { fcs, nin } = newIds()
  await fillProfile(page, {
    root: form,
    embedded: true,
    company: opts.company,
    fcs,
    nin,
    surname: opts.surname,
    forename: opts.forename,
    yearOfBirth: 1985,
  })
}

/** The columns of a deletion request the journeys use (GET /api/v1/deletion-requests). */
export interface DeletionRequestRow {
  id: number
  request_id: string
  table_name: string
  record_id: number
}

/** The collateral columns the journeys read from the securities overview of a CAP. */
export interface CollateralRow {
  CollateralReferenceNumber: string
  attached?: boolean
}

/** The pending deletion request of a record, read through the API as the user who asked for it. */
export async function requestOf(api: Api, table: string, recordId: number): Promise<DeletionRequestRow> {
  const r = await api.get('/api/v1/deletion-requests', { search: String(recordId), status: 0 })
  const rows: DeletionRequestRow[] = r.body?.data ?? []
  const found = rows.find((x) => x.table_name === table && x.record_id === recordId)
  if (!found) throw new Error(`no pending deletion request for ${table} #${recordId} (HTTP ${r.status})`)
  return found
}

/** Ask for the deletion of a record through the API, as the maker, and return the request. */
export async function askDeletion(
  api: Api,
  table: string,
  recordId: number,
  comment: string,
): Promise<DeletionRequestRow> {
  await api.must(
    api.post('/api/v1/deletion-requests', { record_id: recordId, table_name: table, comment }),
    'deletion request',
  )
  return requestOf(api, table, recordId)
}
