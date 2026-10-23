import { INDIVIDUAL, NON_INDIVIDUAL, type Customer, type DateParts, type ProfileModel } from './types'

/**
 * The profile form: one flat object keyed by the Laravel field names, so it is posted as it is. Date selects are separate
 * parts (day/month/year), as in the Blade forms; the server builds the CRB date from them.
 */

const ADDRESS_FIELDS = [
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
  'OtherAreaDiallingCode',
  'OtherTelephoneNumber',
  'UnitNumber',
  'UnitName',
  'FloorNumber',
  'PlotorStreetNumber',
  'LCorStreetName',
  'POBoxNumber',
  'PostOfficeTown',
  'FlagofOwnership',
  'EmailAddress',
  'FAXNumber',
  'Website',
] as const

const INDIVIDUAL_FIELDS = [
  'GSCAFB_Forename1',
  'GSCAFB_Surname',
  'GSCAFB_Forename2',
  'GSCAFB_Forename3',
  'GSCAFB_Gender',
  'GSCAFB_MaritalStatus',
  'II_TaxIdentificationNumber',
  'II_CountryID',
  'II_CountryOfIssue',
  'II_WorkPermitNumber',
  'II_RefugeeNumber',
  'II_PassportNumber',
  'II_DriversLicenceIDNumber',
  'II_DriversLicensePermitNumber',
  'EI_EmploymentType',
  'EI_PrimaryOccupation',
  'EI_EmployerName',
  'EI_IncomeBand',
  'EI_SalaryFrequency',
  'EI_EmployeeNumber',
] as const

const NON_INDIVIDUAL_FIELDS = [
  'GSCAFB_BusinessName',
  'GSCAFB_TradingName',
  'GSCAFB_ActivityDescription',
  'GSCAFB_BusinessTypeCode',
  'GSCAFB_IndustrySectorCode',
  'II_TaxIdentificationNumber',
  'II_RegistrationCertificateNumber',
  'II_ValueAddedTaxNumber',
  'II_CountryOfIssue',
] as const

const text = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

/** `yyyyMMdd` of a moved-to-address date as month/year selects. */
function monthYear(crbDate: unknown): { month: string; year: string } {
  const s = text(crbDate)
  return /^\d{8}$/.test(s)
    ? { month: String(Number(s.slice(4, 6))), year: s.slice(0, 4) }
    : { month: '', year: '' }
}

const part = (n: DateParts[keyof DateParts] | undefined) => (n === '' || n === undefined ? '' : String(n))

/** An empty form for a classification. Branch, nationality and the dialling codes default as the Blade forms did. */
export function emptyProfile(classification: string = INDIVIDUAL): ProfileModel {
  const m: ProfileModel = {
    classificationCode: classification,
    clientNumber: '',
    branchCode: '',
    II_FCSNumber: '',
    II_Nationality: '',
    GSCAFB_DayOfBirth: '',
    GSCAFB_MonthOfBirth: '',
    GSCAFB_YearOfBirth: '',
    joinedEmployerMonth: '',
    joinedEmployerYear: '',
    GSCAFB_DayRegistered: '',
    GSCAFB_MonthRegistered: '',
    GSCAFB_YearRegistered: '',
  }
  for (const f of INDIVIDUAL_FIELDS) m[f] = ''
  for (const f of NON_INDIVIDUAL_FIELDS) m[f] = ''
  for (const p of ['PCI_', 'SCI_']) {
    for (const f of ADDRESS_FIELDS) m[p + f] = ''
    m[`${p}PeriodAtAddressMonth`] = ''
    m[`${p}PeriodAtAddressYear`] = ''
    // Uganda is the preselected dialling code on every phone
    m[`${p}PrimaryCountryDiallingCode`] = '256'
    m[`${p}MobileCountryDiallingCode`] = '256'
    m[`${p}OtherCountryDiallingCode`] = '256'
  }
  return m
}

/** The form for an existing customer (edit profile, new CAP). */
export function profileFrom(c: Customer): ProfileModel {
  const m = emptyProfile(text(c.classificationCode) || INDIVIDUAL)
  for (const key of Object.keys(m)) {
    if (key in c && c[key] !== null && c[key] !== undefined) m[key] = text(c[key])
  }
  m.clientNumber = text(c.clientNumber)
  m.branchCode = text(c.branchCode)
  m.II_FCSNumber = text(c.II_FCSNumber)
  m.II_Nationality = text(c.II_Nationality)

  const ind = c.individual_details
  if (ind) {
    for (const f of INDIVIDUAL_FIELDS) m[f] = text(ind[f])
    m.GSCAFB_DayOfBirth = part(ind.dob_variable?.day)
    m.GSCAFB_MonthOfBirth = part(ind.dob_variable?.month)
    m.GSCAFB_YearOfBirth = part(ind.dob_variable?.year)
    m.joinedEmployerMonth = part(ind.joined_employer_variable?.month)
    m.joinedEmployerYear = part(ind.joined_employer_variable?.year)
  }
  const non = c.non_individual_details
  if (non) {
    for (const f of NON_INDIVIDUAL_FIELDS) m[f] = text(non[f])
    m.GSCAFB_DayRegistered = part(non.reg_variable?.day)
    m.GSCAFB_MonthRegistered = part(non.reg_variable?.month)
    m.GSCAFB_YearRegistered = part(non.reg_variable?.year)
  }
  for (const p of ['PCI_', 'SCI_']) {
    const moved = monthYear(c[`${p}MovedTOAddressOn`])
    m[`${p}PeriodAtAddressMonth`] = moved.month
    m[`${p}PeriodAtAddressYear`] = moved.year
    // a customer saved without a dialling code still shows Uganda, as the selects did
    for (const k of ['Primary', 'Mobile', 'Other'])
      if (!m[`${p}${k}CountryDiallingCode`]) m[`${p}${k}CountryDiallingCode`] = '256'
  }
  return m
}

export const isNonIndividual = (m: ProfileModel) => m.classificationCode === NON_INDIVIDUAL
