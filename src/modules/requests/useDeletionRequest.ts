import { http, messageOf } from '@/api/http'
import { hideLoader, showLoader, swalDelete, swalNotification, toast } from '@/utils/dialogs'

/** What a delete button sends: the record, the table it lives in and why. `deletion_scope` is only `customer_full`. */
export interface DeletionRequestPayload {
  record_id: number
  table_name: string
  deletion_scope?: 'customer_full' | null
  comment: string
}

export interface DeletionRequestResult {
  message: string
  id: number
}

/** POST /deletion-requests. Rejects with the axios error (422 validation, 403, 404, 409 already requested); use `messageOf` for the text. */
export function submitDeletionRequest(payload: DeletionRequestPayload): Promise<DeletionRequestResult> {
  return http.post<DeletionRequestResult>('/deletion-requests', payload).then((r) => r.data)
}

const DEFAULT_EMPTY = 'The reason for your request is required!'

/**
 * The reason dialog every delete button opens: a warning with a textarea, "Yes, Proceed!" and "Cancel".
 * Resolves with the trimmed reason, or null when the user cancels or closes the dialog. A blank reason shows a toast
 * and opens the dialog again (Laravel's recursive call was broken on four pages), so the caller only ever sees a real
 * reason or null.
 */
export async function promptReason(
  title: string,
  text: string,
  placeholder: string,
  emptyMessage: string = DEFAULT_EMPTY,
): Promise<string | null> {
  for (;;) {
    const answer = await swalDelete.fire({
      icon: 'warning',
      title,
      text,
      input: 'textarea',
      inputPlaceholder: placeholder,
      showCancelButton: true,
      confirmButtonText: 'Yes, Proceed!',
      reverseButtons: true,
      allowOutsideClick: false,
    })
    if (!answer.isConfirmed) return null
    const reason = typeof answer.value === 'string' ? answer.value.trim() : ''
    if (reason) return reason
    toast.error(emptyMessage)
  }
}

export interface DeletionFlow {
  recordId: number
  tableName: string
  scope?: 'customer_full' | null
  title: string
  text: string
  placeholder: string
  emptyMessage?: string
}

/**
 * The whole simple flow of the list pages: ask for the reason, show "sending...", submit, then show the server's message
 * (an error dialog on failure). Resolves true when a request was created, so the page can reload its list.
 */
export async function requestDeletion(flow: DeletionFlow): Promise<boolean> {
  const reason = await promptReason(flow.title, flow.text, flow.placeholder, flow.emptyMessage)
  if (reason === null) return false
  showLoader('sending...')
  try {
    const result = await submitDeletionRequest({
      record_id: flow.recordId,
      table_name: flow.tableName,
      deletion_scope: flow.scope ?? null,
      comment: reason,
    })
    hideLoader()
    await swalNotification('success', result.message)
    return true
  } catch (e) {
    hideLoader()
    await swalNotification('error', messageOf(e, 'Failed to submit deletion request. Please try again.'))
    return false
  }
}
