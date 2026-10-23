import { checkProfile, MSG_REQUIRED, type ProfileCheck } from '@/modules/customer/profileRules'
import type { ProfileModel } from '@/modules/customer/types'
import { blank } from './addressModel'

/**
 * The checks of a form that carries a profile (the fraud and PI stakeholder forms): the form's own required fields first, then
 * the embedded profile rules. The surrounding form supplies branch and classification, so they are checked here.
 */
export function checkEmbedded(form: ProfileModel, ownRequired: string[]): ProfileCheck {
  const own = [...ownRequired, 'branchCode', 'classificationCode'].filter((f) => blank(form[f]))
  const profile = checkProfile(form, { embedded: true })
  const invalid = [...own, ...profile.invalid]
  if (own.length) return { invalid, message: MSG_REQUIRED }
  return { invalid, message: profile.message }
}
