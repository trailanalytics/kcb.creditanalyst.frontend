/** Shapes of /api/v1/t24/* and /api/v1/admin/configuration. */

export interface T24Command {
  name: string
  description: string
}

export interface ImportLog {
  id: number
  imported_records: number | null
  record_category: string | null
  started_at: string | null
  ended_at: string | null
  imported_by: string | null
  /** Ready to show, such as `1h 5m 3s`. */
  time_taken: string
}

/** Logs by creation date (`yyyy-MM-dd`), newest first. An empty answer can arrive as `{}` or `[]`. */
export type ImportedRecords = Record<string, ImportLog[]> | ImportLog[]

export interface RunResult {
  status: number
  message: string
  process_id?: number
}

/** The saved warehouse login. The password is never sent to the browser. */
export interface DatabaseStatus {
  configured: boolean
  username?: string | null
  expiry_date?: string | null
  expired?: boolean
  days_to_expiry?: number | null
}

export interface CredentialsBody {
  username: string
  password: string
  expiry_date: string
}

export interface UnsyncedClient {
  id: number
  client_number: string
  full_name: string
  nin: string
}

export interface SyncBody {
  clientNumber: string
  t24ClientNumber: string
  autoMap: boolean
}

export interface ForexRate {
  id: number
  currency: string
  ugx_equivalent: number | string
  month_ending: string
  added_by: string | null
}

export interface ForexBody {
  currency: string
  ugx: string
  month_ending: string
}

export interface CrbCharge {
  crb_suspense_account: string
  credit_amount: number
}

export interface AdminConfiguration {
  t24: DatabaseStatus
  crb_charge: CrbCharge
}

export interface CrbChargeBody {
  crb_suspense_account: string
  credit_amount: string
}

export interface MessageResponse {
  message: string
}
