import axios from 'axios'
import { messageOf, problemOf } from '@/api/http'
import { swalNotification } from '@/utils/dialogs'

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The text of a failed save: every field message of a validation answer, or the server's detail. Server text is escaped. */
export function failureMessage(e: unknown): string {
  const problem = problemOf(e)
  if (axios.isAxiosError(e) && e.response?.status === 422 && problem?.errors)
    return Object.values(problem.errors).flat().map(escapeHtml).join('<br>')
  return escapeHtml(messageOf(e))
}

export const showFailure = (e: unknown) => swalNotification('error', failureMessage(e))
