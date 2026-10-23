import { emptyProfile } from '@/modules/customer/profileModel'
import type { DateParts, ProfileModel } from '@/modules/customer/types'

/**
 * The address block the institution record and a branch share: the primary address (PCI_*) of the profile form. Dialling codes
 * start at Uganda (256) as in the profile form.
 */
export function emptyAddress(): ProfileModel {
  const all = emptyProfile()
  return Object.fromEntries(Object.entries(all).filter(([k]) => k.startsWith('PCI_')))
}

const text = (v: unknown): string => (v === null || v === undefined ? '' : String(v))
const part = (n: DateParts[keyof DateParts] | undefined) => (n === '' || n === undefined ? '' : String(n))

/** Copies the saved address onto the form; the "moved to" selects come from the month and year helper. */
export function addressFrom(
  form: ProfileModel,
  record: Record<string, unknown>,
  moved: DateParts | undefined,
) {
  for (const key of Object.keys(form)) {
    if (key.startsWith('PCI_') && record[key] !== null && record[key] !== undefined)
      form[key] = text(record[key])
  }
  form.PCI_PeriodAtAddressMonth = part(moved?.month)
  form.PCI_PeriodAtAddressYear = part(moved?.year)
  for (const k of ['Primary', 'Mobile', 'Other'])
    if (!form[`PCI_${k}CountryDiallingCode`]) form[`PCI_${k}CountryDiallingCode`] = '256'
}

/** Required in the address block of these forms: country, region, the place names, a dialling code per phone and ownership. */
export const ADDRESS_REQUIRED = [
  'PCI_CountryCode',
  'PCI_Region',
  'PCI_District',
  'PCI_CountyorTown',
  'PCI_Suburb',
  'PCI_Parish',
  'PCI_Village',
  'PCI_PrimaryCountryDiallingCode',
  'PCI_MobileCountryDiallingCode',
  'PCI_OtherCountryDiallingCode',
  'PCI_FlagofOwnership',
]

export const REQUIRED_MESSAGE = 'Kindly check inputs with a red border and fill in appropriately!'

export const blank = (v: string | undefined) => v === undefined || v.trim() === ''

/** The fields in `required` that are still empty. */
export const missing = (form: ProfileModel, required: string[]) => required.filter((f) => blank(form[f]))

/** Lookups the institution, branch, PIS and fraud forms need beyond the profile ones. */
export const FORM_LOOKUPS = [
  'branch-types',
  'institution-types',
  'stakeholder-categories',
  'fraud-categories',
  'currencies',
]
