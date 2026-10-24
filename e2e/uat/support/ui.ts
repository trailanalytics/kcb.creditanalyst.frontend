import { expect, type Locator, type Page } from '@playwright/test'
import { PERSONAS, passwordOf, type Persona } from './env'

/** Sign in on the login screen the way a user does. */
export async function loginViaUi(page: Page, persona: Persona, password = passwordOf(persona)) {
  await page.goto('/login')
  await page.getByPlaceholder('KCB User ID/Email').fill(PERSONAS[persona])
  await page.getByPlaceholder('Password').fill(password)
  await page.getByRole('button', { name: 'Login' }).click()
}

/** The SweetAlert dialog that is currently open. */
export function dialog(page: Page): Locator {
  return page.locator('.swal2-popup')
}

/** Click the confirm button of the open SweetAlert (OK, Yes ..). */
export async function confirmDialog(page: Page, name?: string | RegExp) {
  const button = name ? page.locator('.swal2-confirm', { hasText: name }) : page.locator('.swal2-confirm')
  await button.click()
}

export async function expectDialogText(page: Page, text: string | RegExp) {
  await expect(dialog(page)).toContainText(text)
}

/** The izitoast toasts at the bottom left. */
export function toasts(page: Page): Locator {
  return page.locator('.iziToast')
}

/** Today as yyyy-MM-dd in the stack's time zone (Africa/Kampala). */
export function today(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala' }).format(d)
}

/** A short unique suffix so repeated runs do not collide on unique-ish values. */
export function unique(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
}

/** A distinctive whole amount for a new application, so the duplicate check never trips on an earlier run. */
export function uniqueAmount(): string {
  return String(20_000_000 + Math.floor(Math.random() * 9_000_000))
}

/** Open the "..." menu of a row that shows its actions on hover, and choose an item. */
export async function rowMenu(page: Page, row: Locator, item: string | RegExp) {
  await row.hover()
  await row.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('menuitem', { name: item }).click()
}

export interface ProfileFill {
  /** A company (classification 1) instead of an individual. */
  company?: boolean
  /** The profile embedded in the guarantor / stakeholder dialogs (it needs names, an occupation and the joined-employer month). */
  embedded?: boolean
  /** Look for the fields inside this element (a dialog) instead of the whole page. */
  root?: Locator
  /** FCS number to set on an embedded individual (13 characters). */
  fcs?: string
  /** National ID to set (14 characters) when the form needs one. */
  nin?: string
  surname?: string
  forename?: string
  /** Year of birth to choose (the select lists years from the current one backwards). */
  yearOfBirth?: number
}

/** Fill every field the profile forms require with valid values; fields the form does not show are skipped. */
export async function fillProfile(page: Page, opts: ProfileFill = {}) {
  const root = opts.root ?? page.locator('body')
  const field = (name: string) => root.locator(`[name="${name}"]`).first()
  const set = async (name: string, value: string) => {
    const el = field(name)
    if (!(await el.count())) return
    const tag = await el.evaluate((n) => n.tagName)
    if (tag === 'SELECT') await el.selectOption(value)
    else await el.fill(value)
  }
  const pick = async (name: string, label: string | { index: number }) => {
    const el = field(name)
    if (await el.count()) await el.selectOption(label as any)
  }
  const branch = root.locator('select[name="branchCode"]').first()
  if ((await branch.count()) && !(await branch.inputValue())) await branch.selectOption('001')
  await set('PCI_CountryCode', 'UG')
  await set('PCI_Region', 'C')
  await set('PCI_District', 'Kampala')
  await set('PCI_CountyorTown', 'Kampala')
  await set('PCI_Suburb', 'Nakawa')
  await set('PCI_Parish', 'Butabika')
  await set('PCI_Village', 'Banda')
  await set('PCI_PrimaryCountryDiallingCode', '256')
  await set('PCI_PrimaryAreaDiallingCode', '41')
  await set('PCI_PrimaryTelephoneNumber', '6409927')
  await set('PCI_MobileCountryDiallingCode', '256')
  await set('PCI_MobileAreaDiallingCode', '78')
  await set('PCI_MobileNumber', '6409928')
  await set('PCI_OtherCountryDiallingCode', '256')
  await set('PCI_FlagofOwnership', 'O')
  if (opts.company) {
    await set('GSCAFB_BusinessName', 'UAT Company Ltd')
    await set('GSCAFB_TradingName', 'UAT Company')
    await set('GSCAFB_ActivityDescription', 'Wholesale')
    await set('GSCAFB_BusinessTypeCode', '3')
    await set('GSCAFB_IndustrySectorCode', 'T')
    await set('II_CountryOfIssue', 'UG')
    await set('II_RegistrationCertificateNumber', `80${Date.now().toString().slice(-10)}`)
    await pick('GSCAFB_DayRegistered', { index: 5 })
    await pick('GSCAFB_MonthRegistered', { index: 5 })
    await pick('GSCAFB_YearRegistered', { index: 20 })
    if (opts.fcs) await set('II_FCSNumber', opts.fcs)
  } else {
    if (opts.forename) await set('GSCAFB_Forename1', opts.forename)
    if (opts.surname) await set('GSCAFB_Surname', opts.surname)
    await set('GSCAFB_MaritalStatus', 'S')
    await pick('GSCAFB_DayOfBirth', { index: 5 })
    await pick('GSCAFB_MonthOfBirth', { index: 5 })
    if (opts.yearOfBirth) await pick('GSCAFB_YearOfBirth', String(opts.yearOfBirth))
    else await pick('GSCAFB_YearOfBirth', { index: 40 })
    await set('II_Nationality', 'UG')
    await set('II_CountryOfIssue', 'UG')
    const nin = field('II_CountryID')
    if ((await nin.count()) && (opts.nin || !(await nin.inputValue())))
      await nin.fill(opts.nin ?? `CM${Date.now().toString().slice(-8)}UATXY`)
    if (opts.fcs) await set('II_FCSNumber', opts.fcs)
    await set('EI_EmploymentType', '1')
    await set('EI_EmployerName', 'UAT Employer Ltd')
    await set('EI_PrimaryOccupation', 'Accountant')
    await pick('joinedEmployerMonth', { index: 3 })
    await pick('joinedEmployerYear', { index: 10 })
    await set('EI_IncomeBand', '2')
    await set('EI_SalaryFrequency', 'M')
  }
}
