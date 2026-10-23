import { messageOf } from '@/api/http'
import { hideLoader, showLoader, swalConfirm, swalNotification } from '@/utils/dialogs'
import { profilesApi } from './api'

/**
 * `updateBorrowerClassification`: confirm, then swap the customer's individual/non-individual record. Resolves true when the
 * classification was changed (the caller reloads the profile); false when the user backed out or it failed.
 */
export async function confirmClassificationChange(clientNumber: string, current: string): Promise<boolean> {
  const from = current === '0' ? 'Individual' : 'Non Individual'
  const to = current === '0' ? 'Non Individual' : 'Individual'
  const answer = await swalConfirm.fire({
    icon: 'warning',
    html: `You are about to change the classification of this client from ${from} to ${to}. The current profile will be deleted and a new one will be created! <br/> This action can not be undone! Proceed?`,
    showCancelButton: true,
    confirmButtonText: 'Yes, Proceed',
    reverseButtons: true,
  })
  if (!answer.isConfirmed) return false

  showLoader('applying changes...')
  try {
    const next = current === '0' ? '1' : '0'
    const { message } = await profilesApi.changeClassification(clientNumber, next)
    hideLoader()
    await swalNotification('success', message)
    return true
  } catch (e) {
    await swalNotification('error', messageOf(e, 'Error processing your request. Please try again later!'))
    return false
  }
}
