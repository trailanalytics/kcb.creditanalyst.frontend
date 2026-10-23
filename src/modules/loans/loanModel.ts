import type { ForceCloseEntry } from './types'

/** Status text of the loan lists: anything else shows empty, as in the Blade lists. */
const STATUS: Record<string, string> = {
  '5': 'Current',
  '4': 'Closed',
  '3': 'Written Off',
  '6': 'Written Off Recovery',
  '1': 'Overdue',
}

export const statusText = (code: string | null | undefined): string => STATUS[String(code ?? '')] ?? ''

export function statusClass(code: string | null | undefined): string {
  switch (String(code ?? '')) {
    case '5':
      return 'text-success'
    case '1':
    case '3':
    case '6':
      return 'text-danger'
    default:
      return 'text-slate-600'
  }
}

/** The text of the Add Accounts box as contract codes: split on commas and line breaks, trimmed, empty pieces dropped. */
export function parseContractCodes(text: string): string[] {
  return text
    .split(/[,\n\r]+/)
    .map((c) => c.trim())
    .filter(Boolean)
}

export const blankForceClose = (): ForceCloseEntry => ({
  contractCode: '',
  creditAccountClosureDate: '',
  creditAccountClosureReason: '',
  lastPaymentDate: '',
  lastPaymentAmount: '',
})

/**
 * Removes row `index` from the manual force close form. Each row is one object, so the rows after it keep their own
 * values (the old form spliced five parallel arrays and shifted later values up).
 */
export function removeRow<T>(rows: T[], index: number): T[] {
  return rows.filter((_, i) => i !== index)
}

/** True for a form row with nothing typed in it (number inputs hand back numbers, so every value goes through String). */
export const isBlankRow = (r: ForceCloseEntry): boolean =>
  Object.values(r).every((v) => String(v ?? '').trim() === '')

/** The row as the API takes it: every value text, as typed. */
export const asText = (r: ForceCloseEntry): ForceCloseEntry => ({
  contractCode: String(r.contractCode ?? '').trim(),
  creditAccountClosureDate: String(r.creditAccountClosureDate ?? ''),
  creditAccountClosureReason: String(r.creditAccountClosureReason ?? ''),
  lastPaymentDate: String(r.lastPaymentDate ?? ''),
  lastPaymentAmount: String(r.lastPaymentAmount ?? ''),
})

/** The error messages of an API validation answer, one per line. */
export function errorLines(errors: Record<string, string[]> | undefined): string[] {
  return errors ? Object.values(errors).flat() : []
}

/** A server message with its markup neutralised before it goes into a SweetAlert body. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** The text of the credit card upload result, with the clients that were not found listed under it. */
export function creditCardSummary(result: {
  message: string
  not_found: string[]
  skipped: string[]
}): string {
  let html = escapeHtml(result.message)
  if (result.not_found.length)
    html +=
      `<br/><br/>Client Numbers: ${escapeHtml(result.not_found.join(', '))} could not find corresponding customers.` +
      '<br/>Please make sure that these customers exist in credit analyst and re-upload Credit Cards for these clients!'
  if (result.skipped.length) html += `<br/><br/>Skipped:<br/>${result.skipped.map(escapeHtml).join('<br/>')}`
  return html
}

/**
 * Validation errors of the manual force close, one line each: `accounts.1.contractCode` becomes "Row 2: ..." so the user
 * can find the row; other keys keep the message alone.
 */
export function rowErrorLines(errors: Record<string, string[]> | undefined): string[] {
  if (!errors) return []
  const lines: string[] = []
  for (const [key, messages] of Object.entries(errors)) {
    const m = /^accounts\.(\d+)\./.exec(key)
    for (const message of messages) lines.push(m ? `Row ${Number(m[1]) + 1}: ${message}` : message)
  }
  return lines
}

/** The client numbers worth saving: those with at least one digit, as the old screen filtered them. */
export function filledClients(entries: Record<number, string>): { id: number; clientNumber: string }[] {
  return Object.entries(entries)
    .map(([id, clientNumber]) => ({ id: Number(id), clientNumber: clientNumber.trim() }))
    .filter((e) => /\d/.test(e.clientNumber))
}
