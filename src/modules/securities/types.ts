import type { Customer } from '@/modules/customer/types'

/** Where a security is being attached: a credit application (CAP reference) or a loan account (contract code). */
export type SecurityContext =
  { type: 'application'; referenceNumber: string } | { type: 'loan'; contractCode: string }

/** A collateral as the API returns it: the table's columns under their own names, plus the lookups the screens read. */
export interface CollateralRow {
  id: number
  BorrowerClientNumber: string
  BranchIdentificationCode: string | null
  CollateralType: string
  CollateralReferenceNumber: string
  CollateralDescription: string
  CollateralCurrency: string
  CollateralOpenMarketValue: string
  CollateralForcedSaleValue: string
  CollateralExpiryDate: string
  InstrumentofClaim: string
  ValuationDate: string
  cmc_type: string
  is_deleted: boolean
  customer: Customer | null
  /** Only on the application / loan panels: whether it is attached to that application or loan. */
  attached?: boolean
}

export interface GuarantorRow {
  id: number
  BorrowerClientNumber: string
  GuarantorClientNumber: string
  valueOfGuarantorCollateral: string | null
  guarateeType: string | null
  guarantorType: string | null
  is_deleted: boolean
  guarantor_profile: Customer | null
  borrower: Customer | null
  attached?: boolean
}

export interface StakeholderRow {
  id: number
  BorrowerClientNumber: string
  StakeholderClientNumber: string
  ShareholderPercentage: string | null
  StakeholderCategory: string | null
  category_name: string
  is_deleted: boolean
  stakeholder_profile: Customer | null
  borrower: Customer | null
  attached?: boolean
}

/** GET /securities: everything the borrower has, each flagged with whether it is on this application or loan. */
export interface Overview {
  context: { type: 'application' | 'loan'; reference: string; clientNumber: string; editable: boolean }
  borrower: Customer | null
  collaterals: CollateralRow[]
  guarantors: GuarantorRow[]
  stakeholders: StakeholderRow[]
}

export interface AttachResult {
  message: string
  attached: boolean
}

export type PartyKind = 'guarantor' | 'stakeholder'

/** How the guarantor / stakeholder form was opened. */
export type PartyStart =
  | { mode: 'new'; classification: string }
  | { mode: 'existing'; customer: Customer }
  | { mode: 'edit'; row: GuarantorRow | StakeholderRow }
