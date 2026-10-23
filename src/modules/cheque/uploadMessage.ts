import { escapeHtml } from '@/modules/institution/failure'
import type { UploadResult } from './types'

/**
 * The success text of an upload as the page shows it: the count, and when some accounts matched no customer (or no loan
 * account) the list of them with what to do next. Account numbers come from the file, so they are escaped.
 */
export function uploadMessage(result: UploadResult, fullyPaid: boolean): string {
  const base = fullyPaid
    ? `${result.uploaded} Fully Paid / Written Off Accounts Uploaded Successfully`
    : `${result.uploaded} Bounced Cheques Uploaded Successfully`
  if (result.not_found.length === 0) return base
  const list = escapeHtml(result.not_found.join(','))
  return fullyPaid
    ? `${base}<br/><br/> Contract codes: ${list} were not found among the loan accounts and were not updated.`
    : `${base}<br/><br/> Accounts Numbers: ${list} could not find corresponding customers. <br/>Please make sure that these customers exist in credit analyst and re-upload Bounced Cheques for these clients!`
}
