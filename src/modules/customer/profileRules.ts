import { NON_INDIVIDUAL, type ProfileModel } from './types'

/** Client-side checks of the profile form (resources/js/mixins/profile_validation.js). */

export const MSG_REQUIRED = 'Kindly check inputs with a red border and fill in appropriately!'
export const MSG_COMPANY_ID =
  'Either the Company Registration Certificate Number or Tax Identification Number must be supplied!'
export const MSG_FOREIGN_ID =
  'Either Passport Number or Refugee Number must be supplied for non Ugandan identification!'

const address = (p: 'PCI_' | 'SCI_', optional: string[]) =>
  [
    'CountryCode',
    'Region',
    'District',
    'CountyorTown',
    'Suburb',
    'Parish',
    'Village',
    'PrimaryCountryDiallingCode',
    'PrimaryAreaDiallingCode',
    'PrimaryTelephoneNumber',
    'MobileCountryDiallingCode',
    'MobileAreaDiallingCode',
    'MobileNumber',
    'OtherCountryDiallingCode',
    'FlagofOwnership',
  ]
    .filter((f) => !optional.includes(f))
    .map((f) => p + f)

const INDIVIDUAL_ONLY = [
  'GSCAFB_MaritalStatus',
  'GSCAFB_DayOfBirth',
  'GSCAFB_MonthOfBirth',
  'GSCAFB_YearOfBirth',
  'II_Nationality',
  'II_CountryOfIssue',
  'EI_EmploymentType',
  'EI_EmployerName',
  'EI_IncomeBand',
  'EI_SalaryFrequency',
]

const NON_INDIVIDUAL_ONLY = [
  'GSCAFB_BusinessName',
  'GSCAFB_TradingName',
  'GSCAFB_ActivityDescription',
  'GSCAFB_BusinessTypeCode',
  'GSCAFB_IndustrySectorCode',
  'GSCAFB_DayRegistered',
  'GSCAFB_MonthRegistered',
  'GSCAFB_YearRegistered',
  'II_CountryOfIssue',
]

export interface RuleOptions {
  /** The joint form does not require the primary County/Town nor the alternative District. */
  joint?: boolean
  /**
   * The profile embedded in the guarantor, stakeholder, fraud and PI stakeholder forms (manage/profile/form/*): branch and
   * classification live in the surrounding modal, the national ID, occupation and joined-employer date are always required, and
   * only the alternative address needs a County/Town.
   */
  embedded?: boolean
}

/** The fields that must be filled for this profile. II_CountryID counts only for a Ugandan identity document. */
export function requiredFields(m: ProfileModel, options: RuleOptions = {}): string[] {
  const nonIndividual = m.classificationCode === NON_INDIVIDUAL
  const pci = address('PCI_', options.joint || options.embedded ? ['CountyorTown'] : [])
  const sci = address('SCI_', options.joint ? ['District'] : [])
  const own = nonIndividual ? NON_INDIVIDUAL_ONLY : INDIVIDUAL_ONLY
  const head = options.embedded ? [] : ['branchCode', 'classificationCode']
  const fields = [...head, ...own, ...pci, ...sci]
  if (!nonIndividual && options.embedded)
    fields.push(
      'GSCAFB_Forename1',
      'GSCAFB_Surname',
      'EI_PrimaryOccupation',
      'joinedEmployerMonth',
      'joinedEmployerYear',
      'II_CountryID',
    )
  else if (!nonIndividual && m.II_CountryOfIssue === 'UG') fields.push('II_CountryID')
  return fields
}

export interface ProfileCheck {
  /** Fields to outline in red. */
  invalid: string[]
  message: string | null
}

const blank = (v: string | undefined) => v === undefined || v.trim() === ''

export function checkProfile(m: ProfileModel, options: RuleOptions = {}): ProfileCheck {
  const invalid = requiredFields(m, options).filter((f) => blank(m[f]))
  if (invalid.length) return { invalid, message: MSG_REQUIRED }

  if (m.classificationCode === NON_INDIVIDUAL) {
    if (blank(m.II_RegistrationCertificateNumber) && blank(m.II_TaxIdentificationNumber))
      return {
        invalid: ['II_RegistrationCertificateNumber', 'II_TaxIdentificationNumber'],
        message: MSG_COMPANY_ID,
      }
  } else if (m.II_CountryOfIssue !== 'UG' && blank(m.II_PassportNumber) && blank(m.II_RefugeeNumber)) {
    return { invalid: ['II_PassportNumber', 'II_RefugeeNumber'], message: MSG_FOREIGN_ID }
  }
  return { invalid: [], message: null }
}

/** Trading name is also checked by the server for companies; shown before the request when it is empty. */
export const TRADING_NAME_MESSAGE = 'The Trading Name is required for a Non Individual customer!'
