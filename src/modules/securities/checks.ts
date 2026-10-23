import { checkProfile, MSG_REQUIRED, type ProfileCheck } from '@/modules/customer/profileRules'
import { INDIVIDUAL, type ProfileModel } from '@/modules/customer/types'
import type { PartyKind } from './types'

/** The extra checks of the guarantor and stakeholder forms (ManageSecurity.validateApplicationForm), as pure functions. */

export const MSG_FCS = 'The FCS Number should be 13 characters in length!'
// the trailing space is in the original message
export const MSG_NIN = 'The County ID (NIN) should be 14 characters in length! '
export const MSG_AGE = 'Date Of Birth, must be greater than or equal to 16 years'
export const MSG_PERCENTAGE = 'Share holder Percentage cannot be greater than 100%!'

export const FCS_LENGTH = 13
export const NIN_LENGTH = 14
export const MINIMUM_AGE = 16

const text = (v: string | undefined) => (v ?? '').trim()
const blank = (v: string | undefined) => text(v) === ''
const isIndividual = (m: ProfileModel) => (m.classificationCode || INDIVIDUAL) === INDIVIDUAL

export const fcsNumberError = (m: ProfileModel): string | null =>
  text(m.II_FCSNumber).length === FCS_LENGTH ? null : MSG_FCS

/** An individual whose identity document comes from Uganda needs a 14 character national ID. */
export const ninError = (m: ProfileModel): string | null =>
  isIndividual(m) && m.II_CountryOfIssue === 'UG' && text(m.II_CountryID).length !== NIN_LENGTH
    ? MSG_NIN
    : null

/** Age by year of birth only, as the original did: this year minus the birth year, so a birthday later this year still counts. */
export function ageError(m: ProfileModel, now: Date = new Date()): string | null {
  if (!isIndividual(m)) return null
  return now.getFullYear() - Number(m.GSCAFB_YearOfBirth) < MINIMUM_AGE ? MSG_AGE : null
}

export const percentageError = (percentage: string | undefined): string | null =>
  Number(percentage) > 100 ? MSG_PERCENTAGE : null

/** Fields of the surrounding modal that are required (the `required` attributes of the Blade modals). */
export const OWN_REQUIRED: Record<PartyKind, string[]> = {
  guarantor: ['branchCode', 'ValueOfGuarantorsCollateral', 'GuaranteeType', 'GuarantorType'],
  stakeholder: ['branchCode', 'ShareholderPercentage', 'StakeholderCategory'],
}

/**
 * The whole check before a guarantor or stakeholder is saved: the modal's own required fields and the embedded profile first
 * (the red-border message), then the FCS number, national ID, age and, for stakeholders, the shareholding.
 */
export function checkParty(m: ProfileModel, kind: PartyKind, now: Date = new Date()): ProfileCheck {
  const own = OWN_REQUIRED[kind].filter((f) => blank(m[f]))
  const profile = checkProfile(m, { embedded: true })
  if (own.length || profile.message === MSG_REQUIRED) {
    return {
      invalid: [...own, ...(profile.message === MSG_REQUIRED ? profile.invalid : [])],
      message: MSG_REQUIRED,
    }
  }
  if (profile.message) return profile

  const extra =
    fcsNumberError(m) ??
    ninError(m) ??
    ageError(m, now) ??
    (kind === 'stakeholder' ? percentageError(m.ShareholderPercentage) : null)
  if (!extra) return { invalid: [], message: null }
  const field =
    extra === MSG_FCS
      ? 'II_FCSNumber'
      : extra === MSG_NIN
        ? 'II_CountryID'
        : extra === MSG_AGE
          ? 'GSCAFB_YearOfBirth'
          : 'ShareholderPercentage'
  return { invalid: [field], message: extra }
}
