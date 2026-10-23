import axios from 'axios'
import { messageOf, problemOf } from '@/api/http'
import { swalNotification } from '@/utils/dialogs'

/** The text of a failed save: the duplicate/conflict detail, or every field message of a validation answer. */
export function failureMessage(e: unknown): string {
  const problem = problemOf(e)
  if (axios.isAxiosError(e) && e.response?.status === 422 && problem?.errors)
    return Object.values(problem.errors).flat().join('<br>')
  return messageOf(e)
}

export const showFailure = (e: unknown) => swalNotification('error', failureMessage(e))
