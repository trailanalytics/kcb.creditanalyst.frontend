import axios from 'axios'
import { messageOf, problemOf } from '@/api/http'
import type { ImportedRecords, ImportLog } from './types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `24, Oct 2026` from `2026-10-24` or `20261024` (the T24 page's "D, MMM YYYY"). Anything else comes back as typed. */
export function dateLabel(value: string | null | undefined): string {
  if (!value) return ''
  const m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(value)
  if (!m) return value
  const month = Number(m[2])
  if (month < 1 || month > 12) return value
  return `${Number(m[3])}, ${MONTHS[month - 1]} ${m[1]}`
}

/** The last day of the previous month as `yyyyMMdd`, the only month a rate can be added for. */
export function previousMonthEnd(now: Date = new Date()): string {
  const last = new Date(now.getFullYear(), now.getMonth(), 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${last.getFullYear()}${pad(last.getMonth() + 1)}${pad(last.getDate())}`
}

export interface DateGroup {
  date: string
  label: string
  logs: ImportLog[]
}

/** Import logs as one group per date, newest date first. The server sends `{}` or `[]` when there is nothing. */
export function groupImports(data: ImportedRecords | null | undefined): DateGroup[] {
  if (!data || Array.isArray(data)) return []
  return Object.keys(data)
    .filter((date) => (data[date] ?? []).length > 0)
    .sort((a, b) => b.localeCompare(a))
    .map((date) => ({ date, label: dateLabel(date), logs: data[date] ?? [] }))
}

/** UGX rate as typed: a number above zero that fits decimal(8,2). Null when fine, else the message to show. */
export function rateProblem(text: string): string | null {
  const t = text.trim().replace(/,/g, '')
  if (t === '') return 'Enter the UGX equivalent.'
  const n = Number(t)
  if (!Number.isFinite(n)) return 'The UGX equivalent must be a number.'
  if (n <= 0) return 'The UGX equivalent must be greater than zero.'
  if (n >= 1_000_000) return 'The UGX equivalent must be less than 1,000,000.'
  return null
}

/** The server's reason for a failed request, or null when a global handler (expired session, server error) already showed it. */
export function failureMessage(error: unknown, fallback: string): string | null {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    if (status === 401 || status === 419 || (status !== undefined && status >= 500)) return null
  }
  return messageOf(error, fallback)
}

/** Field messages of a 422, first message per field. */
export function fieldErrors(error: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  const errors = axios.isAxiosError(error) && error.response?.status === 422 ? problemOf(error)?.errors : null
  for (const [field, messages] of Object.entries(errors ?? {})) {
    if (messages.length) out[field] = messages[0] ?? ''
  }
  return out
}

/** `Password expires on 30, Nov 2026 (36 days left)` and the like, for the saved login. */
export function expiryLine(status: {
  configured: boolean
  expiry_date?: string | null
  expired?: boolean
  days_to_expiry?: number | null
}): string {
  if (!status.configured) return 'No credentials are saved yet.'
  if (!status.expiry_date) return 'No expiry date is saved.'
  const when = dateLabel(status.expiry_date)
  if (status.expired) return `The password expired on ${when}.`
  const days = status.days_to_expiry
  return days === null || days === undefined
    ? `The password expires on ${when}.`
    : `The password expires on ${when} (${days} ${days === 1 ? 'day' : 'days'} left).`
}

/** What the CRB charge form checks before sending: a suspense account and an amount of at least 100 (commas allowed). */
export function chargeProblems(account: string, amount: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!account.trim()) out.crb_suspense_account = 'Enter the CRB suspense account.'
  const n = Number(amount.replace(/,/g, '').trim())
  if (!Number.isFinite(n) || n < 100) out.credit_amount = 'Invalid CRB Charge Amount!'
  return out
}
