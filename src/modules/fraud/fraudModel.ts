import { emptyProfile, profileFrom } from '@/modules/customer/profileModel'
import type { Customer, ProfileModel } from '@/modules/customer/types'
import type { FraudRecord } from './types'

/** The register form: the profile fields plus the incident fields, all strings except the two amounts. */
export interface FraudForm {
  profile: ProfileModel
  savings: number | null
  loss: number | null
}

const text = (v: unknown): string => (v === null || v === undefined ? '' : String(v))
const amount = (v: string | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** A new incident for a chosen customer: Uganda shillings, the amounts at 0, the customer's own classification. */
export function newFraudForm(customer: Customer | null): FraudForm {
  const profile = customer ? profileFrom(customer) : emptyProfile('0')
  return {
    profile: {
      ...profile,
      profile_id: customer ? String(customer.id) : '',
      fraudCategory: '',
      incident_day: '',
      incident_month: '',
      incident_year: '',
      currency: 'UGX',
      incidentDetails: '',
      forensicInformation: '',
    },
    savings: 0,
    loss: 0,
  }
}

/** Editing a saved incident: its own fields and the profile of its customer. */
export function fraudFormFrom(record: FraudRecord): FraudForm {
  const form = newFraudForm(record.customer)
  const d = record.incident_date_variable
  Object.assign(form.profile, {
    fraudCategory: text(record.fraudCategory),
    incident_day: text(d?.day),
    incident_month: text(d?.month),
    incident_year: text(d?.year),
    currency: text(record.currency) || 'UGX',
    incidentDetails: text(record.IncidentDetails),
    forensicInformation: text(record.forensicInformationAvailable),
  })
  form.savings = amount(record.SavingsAmount)
  form.loss = amount(record.LossAmount)
  return form
}

/** What is posted: the flat form, the way the Laravel form posted it, with the amounts as numbers. */
export function fraudBody(form: FraudForm): Record<string, unknown> {
  return { ...form.profile, saving_amount: form.savings ?? 0, loss_amount: form.loss ?? 0 }
}

/** The incident fields that must be filled (the profile fields are checked by the profile rules). */
export const FRAUD_REQUIRED = [
  'fraudCategory',
  'incident_day',
  'incident_month',
  'incident_year',
  'currency',
  'incidentDetails',
  'forensicInformation',
]
