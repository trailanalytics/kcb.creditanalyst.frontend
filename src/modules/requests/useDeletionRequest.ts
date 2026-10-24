import { http } from '@/api/http'
import { swalDelete } from '@/utils/dialogs'

/**
 * POST /api/v1/deletion-requests (maker-checker): every delete button asks for a reason and files a request instead of deleting.
 * `deletion_scope` is only set for a whole customer profile (`customer_full`).
 */
export interface DeletionRequestBody {
  record_id: number | string
  table_name: string
  deletion_scope?: 'customer_full' | null
  comment: string
}

export function submitDeletionRequest(body: DeletionRequestBody): Promise<{ message: string; id: number }> {
  return http
    .post<{ message: string; id: number }>('/deletion-requests', body, { headers: { 'x-handled': '1' } })
    .then((r) => r.data)
}

export interface ReasonPrompt {
  title?: string
  text: string
  placeholder: string
  confirmText?: string
  /** The message under the box when the reason is left empty. */
  requiredMessage?: string
}

/** The "simple reason form" of the old pages: a warning with a textarea. Resolves the trimmed reason, null when cancelled. */
export async function promptReason(options: ReasonPrompt): Promise<string | null> {
  const answer = await swalDelete.fire({
    icon: 'warning',
    title: options.title,
    text: options.text,
    input: 'textarea',
    inputPlaceholder: options.placeholder,
    showCancelButton: true,
    confirmButtonText: options.confirmText ?? 'Yes, Proceed!',
    cancelButtonText: 'Cancel',
    reverseButtons: true,
    inputValidator: (value: string) =>
      value.trim()
        ? undefined
        : (options.requiredMessage ?? 'A reason for the deletion request is required.'),
  })
  return answer.isConfirmed ? String(answer.value ?? '').trim() : null
}
