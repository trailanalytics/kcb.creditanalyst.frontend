import dayjs from 'dayjs'
import type { DeletionRequestRow, RequestStatus } from './types'

export const STATUS_OPTIONS: { value: RequestStatus; label: string }[] = [
  { value: 0, label: 'Pending' },
  { value: 1, label: 'Approved' },
  { value: 2, label: 'Canceled' },
]

export const APPROVE_TEXT =
  'This Request will be approved and the corresponding record will be deleted and removed from listing! Proceed?'
export const CANCEL_TEXT =
  'This Request will be canceled and the corresponding record will not be deleted! Proceed?'

/** "10, Apr 2026". The server sends UTC without a zone, so it is read as UTC and shown in the browser's zone. */
export function requestedOn(value: string | null | undefined): string {
  if (!value) return ''
  const d = dayjs(/(Z|[+-]\d\d:?\d\d)$/.test(value) ? value : `${value}Z`)
  return d.isValid() ? d.format('D, MMM YYYY') : ''
}

/** What a pending row offers the signed-in user: the server refuses the maker and anyone without the permission, so those buttons are not shown. */
export function actionsFor(
  row: Pick<DeletionRequestRow, 'request_status' | 'requested_by'>,
  me: { id: number | null; canApprove: boolean; canCancel: boolean },
): { approve: boolean; cancel: boolean } {
  if (row.request_status !== 0 || (me.id !== null && row.requested_by === me.id))
    return { approve: false, cancel: false }
  return { approve: me.canApprove, cancel: me.canCancel }
}

/** One line that says what a request is about: the label the server made, else the table and id. */
export function recordText(
  row: Pick<DeletionRequestRow, 'record_label' | 'table_name' | 'record_id'>,
): string {
  return row.record_label ?? `${row.table_name} #${row.record_id}`
}
