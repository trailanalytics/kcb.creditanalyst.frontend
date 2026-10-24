/** One of the 130 grid columns: GET /api/v1/cba/columns. `key` is the name a cell is saved under. */
export interface CbaColumn {
  key: string
  label: string
  readonly: boolean
  numeric: boolean
}

/** A row of GET /api/v1/cba/accounts: the values follow the order of the columns, NULL cells are null. */
export interface CbaRow {
  id: number
  values: (string | null)[]
}

export interface GridPage {
  data: CbaRow[]
  current_page: number
  last_page: number
  per_page: number
  total: number
  from: number | null
  to: number | null
}

export interface RuleResult {
  name: string
  desc: string
  count: number
  percentage: number
  fixable: boolean
}

/** GET /api/v1/cba/validations; the keys of `validations` are in the order the rules are listed. */
export interface Validations {
  validations: Record<string, RuleResult>
  total_accounts: number
}

export interface Unmatched {
  reference: string
  client: string
}

/** PUT /api/v1/cba/accounts */
export interface SaveResult {
  updated: number
  unchanged: number
  unmatched: Unmatched[]
  message: string
}

/** DELETE /api/v1/cba/accounts/{reference} */
export interface RemoveResult {
  cba_rows: number
  loan_accounts: number
  message: string
}

export interface FixResult {
  rule: string
  updated: number
  message: string
}

export interface FixAllResult {
  fixed: FixResult[]
  updated: number
  message: string
}

/** The answer of the two upload endpoints (202). */
export interface QueuedProcess {
  message: string
  process_id: number
  bg_url: string
}

/** What the CBA generation slice answers to POST /api/v1/cba/download (202). */
export interface DownloadQueued {
  process_id: number
}
