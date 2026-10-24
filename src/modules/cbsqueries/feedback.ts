import axios from 'axios'
import { messageOf } from '@/api/http'
import { swalNotification } from '@/utils/dialogs'

/** The status of a failed request, or null when it never got an answer. */
export const statusOf = (e: unknown): number | null =>
  axios.isAxiosError(e) ? (e.response?.status ?? null) : null

/**
 * Tell the user why a call failed, in the server's words (409 SELF_REVIEW, 403, 404 ...). 401, 419 and 5xx already have a
 * dialog from the global interceptor, so they are not shown twice.
 */
export async function showApiError(e: unknown, fallback = 'The request failed. Please try again.') {
  const status = statusOf(e)
  if (status === 401 || status === 419 || (status !== null && status >= 500)) return
  await swalNotification('error', messageOf(e, fallback))
}
