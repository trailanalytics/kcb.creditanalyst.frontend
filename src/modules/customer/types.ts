/** Shapes of the profile API (Laravel model JSON: every column under its column name plus the appended attributes). */

export interface DateParts {
  day: number | ''
  month: number | ''
  year: number | ''
}

export interface IndividualDetails {
  id: number
  [column: string]: unknown
  dob_variable: DateParts
  joined_employer_variable: DateParts
}

export interface NonIndividualDetails {
  id: number
  [column: string]: unknown
  reg_variable: DateParts
}

/** A customer as the list returns it. */
export interface CustomerRow {
  id: number
  clientNumber: string
  II_FCSNumber: string | null
  full_name: string
  customer_type: string
  classificationCode: string | null
  /** A deletion request is waiting for this profile (the list adds it; absent on older responses). */
  is_deleted?: boolean
}

/** A customer with its details (show, edit and the application screens). */
export interface Customer extends CustomerRow {
  currentAccount: string | null
  branchCode: string | null
  is_borrower?: boolean
  individual_details: IndividualDetails | null
  non_individual_details: NonIndividualDetails | null
  [column: string]: unknown
}

export const INDIVIDUAL = '0'
export const NON_INDIVIDUAL = '1'

/** Every form value is a string, as it was in the Blade forms. */
export type ProfileModel = Record<string, string>

export interface Existence {
  customer_id: number
  client_number: string
  full_name: string
  classification: number
  individual_name: string | null
  non_individual_name: string | null
  has_individual: boolean
  has_non_individual: boolean
  individual_id: number | null
  non_individual_id: number | null
}
