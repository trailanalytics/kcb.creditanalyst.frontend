import { emptyProfile, profileFrom } from '@/modules/customer/profileModel'
import type { Customer, ProfileModel } from '@/modules/customer/types'
import { contextFields } from './collateralModel'
import type { GuarantorRow, PartyKind, PartyStart, SecurityContext, StakeholderRow } from './types'

/** Fields the guarantor and stakeholder modals add around the profile. */
const EXTRAS: Record<PartyKind, string[]> = {
  guarantor: ['ValueOfGuarantorsCollateral', 'GuaranteeType', 'GuarantorType'],
  stakeholder: ['ShareholderPercentage', 'StakeholderCategory'],
}

const text = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

function withExtras(kind: PartyKind, profile: ProfileModel): ProfileModel {
  const m = { ...profile }
  for (const f of EXTRAS[kind]) m[f] ??= ''
  return m
}

/** The form for a classification picked from the "Individual" / "Non Individual" menu items. */
export const newPartyForm = (kind: PartyKind, classification: string): ProfileModel =>
  withExtras(kind, emptyProfile(classification))

/** The form for a customer picked from the existing customer or existing stakeholder lists. */
export const existingPartyForm = (kind: PartyKind, customer: Customer): ProfileModel =>
  withExtras(kind, { ...profileFrom(customer), profile_id: String(customer.id) })

/** The form for a guarantor or stakeholder row opened for editing. */
export function editPartyForm(kind: PartyKind, row: GuarantorRow | StakeholderRow): ProfileModel {
  const profile =
    kind === 'guarantor'
      ? (row as GuarantorRow).guarantor_profile
      : (row as StakeholderRow).stakeholder_profile
  const m = withExtras(kind, profile ? profileFrom(profile) : emptyProfile())
  if (kind === 'guarantor') {
    const g = row as GuarantorRow
    m.ValueOfGuarantorsCollateral = text(g.valueOfGuarantorCollateral)
    m.GuaranteeType = text(g.guarateeType)
    m.GuarantorType = text(g.guarantorType)
  } else {
    const s = row as StakeholderRow
    m.ShareholderPercentage = text(s.ShareholderPercentage)
    m.StakeholderCategory = text(s.StakeholderCategory)
  }
  return m
}

export function partyFormFor(kind: PartyKind, start: PartyStart): ProfileModel {
  if (start.mode === 'new') return newPartyForm(kind, start.classification)
  if (start.mode === 'existing') return existingPartyForm(kind, start.customer)
  return editPartyForm(kind, start.row)
}

/** The modal title: stakeholders say "Update" once a shareholding is set, guarantors always say "Add" (as the originals did). */
export function partyTitle(kind: PartyKind, form: ProfileModel): string {
  if (kind === 'guarantor') return 'Add Guarantor'
  return text(form.ShareholderPercentage) || text(form.StakeholderCategory)
    ? 'Update Stakeholder'
    : 'Add Stakeholder'
}

/** Switching the classification of a new party starts the profile again but keeps what was typed in the modal's own fields. */
export function switchClassification(
  kind: PartyKind,
  form: ProfileModel,
  classification: string,
): ProfileModel {
  const next = newPartyForm(kind, classification)
  next.branchCode = form.branchCode ?? ''
  for (const f of EXTRAS[kind]) next[f] = form[f] ?? ''
  return next
}

/** What is posted: the form as it is (the API reads the profile columns by name) plus the application or loan it was opened on. */
export function partyPayload(form: ProfileModel, context?: SecurityContext): Record<string, unknown> {
  const body: Record<string, unknown> = { ...form, ...contextFields(context) }
  for (const k of ['clientNumber', 'GuarantorClientNumber', 'StakeholderClientNumber']) delete body[k]
  if (!body.profile_id) delete body.profile_id
  return body
}
