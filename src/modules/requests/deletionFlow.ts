import { messageOf } from '@/api/http'
import { hideLoader, showLoader, swalNotification } from '@/utils/dialogs'
import { promptReason, submitDeletionRequest } from './useDeletionRequest'

/** What the old pages said and sent for each kind of record (see the inventory in the M7 screen spec, section 2). */
export interface DeletionKind {
  table: string
  /** The swal text. */
  text: string
  placeholder: string
  /** Shown when the reason is left empty. */
  required: string
}

/** `subject` is how the reason box names the record: "record" on most pages, "Loan Application" on the CAP list, "user" on the users list. */
const kind = (table: string, noun: string, subject = 'record'): DeletionKind => ({
  table,
  text: `You are about to submit a request to delete this ${noun}! Proceed?`,
  placeholder: `Type your reason for deleting this ${subject} here...`,
  required: `The reason for your request to delete this ${subject} is required!`,
})

export const deletionKinds = {
  application: kind('loan_applications', 'Loan Application', 'Loan Application'),
  collateral: kind('collaterals', 'Collateral'),
  guarantor: kind('borrower_guarantors', 'Guarantor'),
  stakeholder: kind('borrower_stakeholders', 'Stakeholder'),
  pis: kind('institution_stakeholders', 'Institution Stakeholder'),
  branch: kind('bank_branches', 'Branch'),
  user: kind('users', 'User', 'user'),
} satisfies Record<string, DeletionKind>

export type DeletionKindName = keyof typeof deletionKinds

/** The permission that shows the delete button of each list (seeded names, see the deviations). */
export const deletePermissions: Record<DeletionKindName, string> = {
  application: 'Delete Applications',
  collateral: 'Delete Collateral',
  guarantor: 'Delete Guarantors',
  stakeholder: 'Delete Stakeholder',
  pis: 'Delete PIS',
  branch: 'Delete Branches',
  user: 'Create, Update and Delete Users',
}

/**
 * The shared delete button flow of the lists: ask for a reason, file the request, show the server's message.
 * Resolves true once the request is filed, so the caller can flag the row; false when cancelled or refused.
 */
export async function requestDeletion(name: DeletionKindName, recordId: number | string): Promise<boolean> {
  const k = deletionKinds[name]
  const reason = await promptReason({
    text: k.text,
    placeholder: k.placeholder,
    requiredMessage: k.required,
  })
  if (reason === null) return false
  showLoader('sending...')
  try {
    const result = await submitDeletionRequest({ record_id: recordId, table_name: k.table, comment: reason })
    hideLoader()
    await swalNotification('success', escapeHtml(result.message))
    return true
  } catch (e) {
    hideLoader()
    await swalNotification(
      'error',
      escapeHtml(messageOf(e, 'Failed to submit deletion request. Please try again.')),
    )
    return false
  }
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}
