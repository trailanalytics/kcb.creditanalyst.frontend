import type { Customer } from '@/modules/customer/types'

export const PENDING = '2'
export const APPROVED = '0'

export interface Approval {
  contractCode: string | null
  createdby: string | null
  approvedOn: string | null
}

export interface Rejection {
  rejectionReason: string | null
  createdby: string | null
  rejectedOn: string | null
}

export interface Restructured {
  contractCode: string | null
  restructuredDate: string | null
  restructuredAmount: string | null
}

/** A credit application as the API returns it: the table's columns under their own names, plus the customer. */
export interface Application {
  id: number
  creditApplicationReference: string
  clientNumber: string
  branchCode: string | null
  creditApplicationDate: string | null
  Amount: string | null
  creditAmountApproved: number | string | null
  currency: string | null
  creditAccountLoanProductType: string | null
  creditApplicationStatus: string | null
  lastStatusChangeDate: string | null
  creditApplicationDuration: number | string | null
  Term: string | null
  TermPeriod: string | null
  termInDays: string | null
  loanPurpose: string | null
  jointAccountNumber: string | null
  createdby: string | null
  created_at: string | null
  updated_at: string | null
  is_deleted: boolean
  customer: Customer | null
  approval?: Approval | null
  rejection?: Rejection | null
  restructured?: Restructured | null
}

export interface LoanAccountRow {
  id: number
  contractCode: string
  contractDate: string | null
  creditAmount: string | null
  currency: string | null
  creditAccountStatus: string | null
}

/** The loan section of the CAP form (names as posted). */
export interface LoanModel {
  creditApplicationDate: string
  creditApplicationReference: string
  currency: string
  amount: number | null
  CreditAccountLoanProductType: string
  Term: string
  Term_Period: string
  loanPurpose: string
  branch: string
  jointAccountNumber: string
  restructuredAccountNumber: string
}

/** A reference on the user's bulk-approval list, with its application when it still exists. */
export interface PendingRow {
  id: number
  creditApplicationReference: string
  application: Application | null
}

export interface BulkItem {
  creditApplicationReference: string
  creditApplicationStatus: string
  contractCode?: string
  rejectionReason?: string
}
