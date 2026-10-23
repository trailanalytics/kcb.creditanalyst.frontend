import type { Customer, DateParts } from '@/modules/customer/types'

/** A bank branch as the API returns it: every column under its column name plus the date helpers and the deletion flag. */
export interface BankBranch {
  id: number
  BranchName: string
  bankBranchCode: string | null
  BranchIdentificationCode: string
  BranchType?: string | null
  DateOpened?: string | null
  moved_variable: DateParts
  date_opened_variable: DateParts
  is_deleted: boolean
  [column: string]: unknown
}

/** The participating institution's own record (a single row; empty until it is first saved). */
export interface InstitutionRecord {
  id?: number
  moved_variable: DateParts
  license_issue_variable: DateParts
  [column: string]: unknown
}

export interface Stakeholder {
  id: number
  clientNumber: string
  StakeholderCategory: string | null
  ShareholderPercentage: string | null
  is_deleted: boolean
  customer: Customer | null
}

export interface TransferResult {
  message: string
  customers: number
  loan_accounts: number
}
