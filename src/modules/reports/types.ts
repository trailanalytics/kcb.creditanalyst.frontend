/** Report types of the CRB form. */
export type ReportType = 'BC' | 'BS' | 'CAP' | 'CBA' | 'CCG' | 'CMC' | 'IB' | 'PI' | 'PIS' | 'FRA' | 'CML'

export interface DateParts {
  day: string
  month: string
  year: string
}

export interface ReportForm {
  fileName: ReportType
  from: DateParts
  to: DateParts
  version: string
  useCachedCba: boolean
  useInstrumentsCodes: boolean
}

/** Body of POST /reports/{type} (the nine files built in the request). */
export interface FileReportBody {
  fromDate: string
  toDate: string
  version: string
  useInstrumentsCodes?: boolean
}

/** Body of POST /cba/generate (the CBA slice). */
export interface CbaGenerateBody {
  toDate: string
  version: string
  useCached: boolean
}

export interface LoanWithoutRow {
  id: number
  contractCode: string
  clientNumber: string
  creditAmount: string
  currency: string
  contractDate: string
  maturityDate: string
  lackFactor: string
  loan_id: number | string
  name: string
}

export interface OutputFileRow {
  id: number
  rule_name: string
  records_count: number | null
  report_type: string | null
  submission_date: string | null
  version: string
  time_remaining: string
  expired: boolean
  download_name: string
  created_at: string
}

export interface CountRow {
  count: number
}
export interface CodeLabelRow extends CountRow {
  code: string
  label: string
}
export interface BranchRow extends CountRow {
  code: string
  name: string
}
export interface CurrencyRow extends CountRow {
  currency: string
  amount?: number
  balance?: number
}

export interface SubmissionAnalysis {
  generated_on: string
  stakeholders: {
    count: number
    as_of: string
    rows: { name: string; category: string; category_code: string; percentage: string }[]
  }
  bounced_cheques: {
    count: number
    min_date: string
    max_date: string
    by_currency: CurrencyRow[]
    by_branch: BranchRow[]
    by_reason: CodeLabelRow[]
  }
  credit_applications: {
    count: number
    min_date: string
    max_date: string
    by_currency: CurrencyRow[]
    by_branch: BranchRow[]
    by_product: CodeLabelRow[]
    by_status: CodeLabelRow[]
  }
  credit_accounts: {
    count: number
    min_date: string
    max_date: string
    by_currency: CurrencyRow[]
    by_branch: BranchRow[]
    by_product: CodeLabelRow[]
    by_status: CodeLabelRow[]
    by_risk: CodeLabelRow[]
    largest: { name: string; reference: string; amount: number | string; currency: string }[]
    worst: { name: string; reference: string; days: number | string }[]
  }
}

/** A row of one analysis table: a first cell with an optional second line, then right-hand cells. */
export interface AnalysisRow {
  key: string
  first: string
  sub?: string
  cells: (string | number)[]
}
