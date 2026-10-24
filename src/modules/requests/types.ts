/** 0 pending, 1 approved, 2 cancelled (deletion_requests.request_status). */
export type RequestStatus = 0 | 1 | 2

/** One line of GET /deletion-requests. `requested_by` and `actioned_by` are user ids, the names are for display. */
export interface DeletionRequestRow {
  id: number
  request_id: string
  record_id: number
  table_name: string
  deletion_scope: string | null
  request_status: RequestStatus
  request_comment: string | null
  requested_by: number | null
  requested_by_name: string | null
  /** Server time (UTC) without a zone, e.g. 2026-10-24T08:30:00. */
  requested_at: string | null
  actioned_by: number | null
  actioned_by_name: string | null
  actioned_at: string | null
  approval_comment: string | null
  record_label: string | null
}

/** GET /deletion-requests/{id}: the record behind a request; `record` is null when the row no longer exists. */
export interface RecordView {
  id: number
  request_id: string
  table_name: string
  record_id: number
  record_label: string | null
  record: Record<string, unknown> | null
}

export interface RequestMessage {
  message: string
}
