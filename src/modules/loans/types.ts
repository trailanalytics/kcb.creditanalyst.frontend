import type { Customer } from '@/modules/customer/types'

/** What the loan lists show of a borrower (no identity details). */
export interface LoanCustomer {
  id: number
  clientNumber: string
  classificationCode: string | null
  branchCode: string | null
  II_FCSNumber: string | null
  full_name: string
  customer_type: string
}

/** A row of the loans, write-offs, ignored and force-closed lists: the loan's columns plus `loan_type` and the customer. */
export interface LoanRow {
  id: number
  contractCode: string
  clientNumber: string
  contractDate: string | null
  maturityDate: string | null
  currency: string | null
  creditAmount: string | null
  currentBalanceAmount: string | null
  creditAccountStatus: string | null
  loan_type: string
  customer: LoanCustomer | null
}

/** Header facts of the details, repayments and write-off pages (already formatted by the server). */
export interface LoanFacts {
  amount: string
  contractCode: string
  contractDate: string | null
  maturityDate: string | null
  currentBalance: string
  status: string
  loanType: string
  purpose: string
  balanceOverdue: string
  dueDays: string | null
  arrearsDate: string | null
}

export interface DetailRow {
  label: string
  /** Missing when the loan has no value; shown as a dash. */
  value?: string | null
}

export interface DetailGroup {
  title: string
  rows: DetailRow[]
}

export interface RepaymentRow {
  no: number
  paymentDate: string | null
  paymentAmount: string
  lastStatusChangeDate: string
}

/** GET /loans/{id}, /loans/{id}/repayments and /loans/{id}/write-off. */
export interface LoanView {
  loan: {
    id: number
    contractCode: string
    clientNumber: string
    currency: string | null
    creditAmount: string | null
    currentBalanceAmount: string | null
    creditAccountStatus: string | null
    [column: string]: unknown
  }
  customer: Customer
  header: LoanFacts
  groups?: DetailGroup[]
  repayments?: RepaymentRow[]
}

export interface IgnoreResult {
  message: string
  ignored: string[]
  already_ignored: string[]
  unknown: string[]
}

/** One row of the manual force close form. */
export interface ForceCloseEntry {
  contractCode: string
  creditAccountClosureDate: string
  creditAccountClosureReason: string
  lastPaymentDate: string
  lastPaymentAmount: string
}

export interface ForceCloseImportResult {
  message: string
  rows: number
  removed: number
  closed: number
  updated: number
  not_found: string[]
  not_found_count: number
  skipped: string[]
  skipped_count: number
}

export interface CreditCardResult {
  message: string
  uploaded: number
  not_found: string[]
  skipped: string[]
}

export interface OffBalanceItem {
  id: number
  contractCode: string
  customerName: string | null
  contractType: string | null
  amount: string
  contractDate: string
  maturityDate: string | null
  clientNumber: string | null
}

export interface OffBalanceSaveResult {
  message: string
  updated: number
  not_found: string[]
  missing_items: string[]
}
