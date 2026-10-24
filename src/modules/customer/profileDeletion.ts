import Swal from 'sweetalert2'
import { messageOf } from '@/api/http'
import { escapeHtml } from '@/modules/requests/deletionFlow'
import { submitDeletionRequest } from '@/modules/requests/useDeletionRequest'
import { hideLoader, popupDefaults, showLoader, swalNotification, swalOk } from '@/utils/dialogs'
import { profilesApi } from './api'
import type { Existence } from './types'

/**
 * The Delete button of the profiles list (ProfileIndex.vue): look up which detail records the customer has, let the user pick what to
 * remove (one record or the whole profile), ask for a reason, then file the deletion request.
 */
export type DeleteChoice = 'individual' | 'non_individual' | 'full'

const confirmBtn = 'rounded px-4 py-2 text-sm font-medium text-white bg-danger m-2'
const cancelBtn = 'rounded px-4 py-2 text-sm font-medium text-white bg-slate-500 m-2'
const steps = Swal.mixin({
  customClass: { confirmButton: confirmBtn, cancelButton: cancelBtn },
  buttonsStyling: false,
  ...popupDefaults,
})

type DeletionBody = Parameters<typeof submitDeletionRequest>[0]

export const bothRecords = (e: Existence) => e.has_individual && e.has_non_individual

export const displayName = (e: Existence) => e.full_name?.trim() || 'this customer'

const named = (name: string | null) => escapeHtml(name?.trim() || 'no name')
const badge =
  '<span class="ml-1 whitespace-nowrap rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">current classification</span>'

function radio(value: DeleteChoice, label: string, note = '', checked = false) {
  return (
    `<label class="mb-3 block cursor-pointer text-left"><input type="radio" name="deleteType" value="${value}" class="mr-2"` +
    `${checked ? ' checked' : ''}> ${label}${note ? `<small class="block pl-5 text-slate-500">${note}</small>` : ''}</label>`
  )
}

/** The body of the first dialog: the choices of what to delete. */
export function choicesHtml(e: Existence): string {
  const intro = `<p class="mb-3 text-left">Select the type of deletion for <b>${escapeHtml(displayName(e))}</b>:</p>`
  if (!bothRecords(e))
    return `${intro}${radio('full', '<b class="text-danger">Delete entire profile</b>', '', true)}`
  return (
    `${intro}<p class="mb-3 text-left text-sm text-slate-500">This customer has both an Individual and a Non-Individual record. ` +
    'Remove the wrong one; the customer will be classified by the record kept.</p>' +
    radio(
      'individual',
      `Remove <b>Individual</b> record (${named(e.individual_name)})${e.classification === 0 ? badge : ''}`,
      `Keeps the Non-Individual record (${named(e.non_individual_name)})`,
    ) +
    radio(
      'non_individual',
      `Remove <b>Non-Individual</b> record (${named(e.non_individual_name)})${e.classification === 1 ? badge : ''}`,
      `Keeps the Individual record (${named(e.individual_name)})`,
    ) +
    radio('full', '<b class="text-danger">Delete entire profile</b> (removes all records)')
  )
}

/** The body of the second dialog: what exactly the request will ask for. */
export function confirmationHtml(choice: DeleteChoice, e: Existence): string {
  const name = `<b>${escapeHtml(displayName(e))}</b>`
  if (choice === 'individual')
    return `Submit a request to remove the <b>Individual</b> record for ${name}? Once approved, the customer will be classified as <b>Non-Individual</b>.`
  if (choice === 'non_individual')
    return `Submit a request to remove the <b>Non-Individual</b> record for ${name}? Once approved, the customer will be classified as <b>Individual</b>.`
  return `Submit a request to <b class="text-danger">permanently delete the entire profile</b> for ${name}? This will remove all associated individual and non-individual records.`
}

/** What each choice sends: one detail record, or the customer with every record. */
export function deletionBody(choice: DeleteChoice, e: Existence, comment: string): DeletionBody {
  if (choice === 'individual')
    return {
      record_id: e.individual_id as number,
      table_name: 'customer_individuals',
      deletion_scope: null,
      comment,
    }
  if (choice === 'non_individual')
    return {
      record_id: e.non_individual_id as number,
      table_name: 'customer_non_individuals',
      deletion_scope: null,
      comment,
    }
  return { record_id: e.customer_id, table_name: 'customers', deletion_scope: 'customer_full', comment }
}

/** Resolves true once a request has been filed (the caller flags the row), false when cancelled or when something failed. */
export async function requestProfileDeletion(customerId: number): Promise<boolean> {
  showLoader('Checking customer data, please wait...')
  let existence: Existence
  try {
    existence = await profilesApi.existence(customerId)
  } catch {
    hideLoader()
    await swalOk.fire({
      icon: 'error',
      title: 'Error',
      text: 'Could not load customer data. Please try again.',
    })
    return false
  }
  hideLoader()

  const picked = await steps.fire({
    icon: 'warning',
    title: 'Delete Customer Profile',
    html: choicesHtml(existence),
    showCancelButton: true,
    confirmButtonText: 'Next',
    cancelButtonText: 'Cancel',
    reverseButtons: true,
    preConfirm: () => {
      const input = Swal.getPopup()?.querySelector<HTMLInputElement>('input[name="deleteType"]:checked')
      if (!input) {
        Swal.showValidationMessage('Please select a deletion option to proceed.')
        return false
      }
      return input.value
    },
  })
  if (!picked.isConfirmed) return false
  const choice = picked.value as DeleteChoice

  const reason = await steps.fire({
    icon: 'warning',
    title: 'Confirm Deletion Request',
    html: confirmationHtml(choice, existence),
    input: 'textarea',
    inputPlaceholder: 'State your reason for this deletion request...',
    showCancelButton: true,
    confirmButtonText: 'Yes, Submit Request',
    cancelButtonText: 'Cancel',
    reverseButtons: true,
    inputValidator: (value: string) =>
      value.trim() ? undefined : 'A reason for the deletion request is required.',
  })
  if (!reason.isConfirmed) return false

  showLoader('Submitting deletion request...')
  try {
    const result = await submitDeletionRequest(deletionBody(choice, existence, String(reason.value).trim()))
    hideLoader()
    await swalNotification('success', escapeHtml(result.message))
    return true
  } catch (e) {
    hideLoader()
    await swalOk.fire({
      icon: 'error',
      title: 'Error',
      text: messageOf(e, 'Failed to submit deletion request. Please try again.'),
    })
    return false
  }
}
