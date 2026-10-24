import dayjs from 'dayjs'
import type { CbaGenerateBody, DateParts, FileReportBody, ReportForm, ReportType } from './types'

/** The report type select of reports/tabs/crb-reports.blade.php, in order. CML stays disabled (Mopesa export is not built). */
export const REPORT_TYPES: { value: ReportType; label: string; disabled?: boolean }[] = [
  { value: 'BC', label: 'BC: Bounced Cheque Report' },
  { value: 'BS', label: 'BS: Borrower Stakeholders Report' },
  { value: 'CAP', label: 'CAP: Credit Applications Report' },
  { value: 'CBA', label: 'CBA: Customer Borrower Account Report' },
  { value: 'CCG', label: 'CCG: Collateral Guarantors Report' },
  { value: 'CMC', label: 'CMC: Collateral Material Report' },
  { value: 'IB', label: 'IB: Institution Branch Report' },
  { value: 'PI', label: 'PI: Participating Institution Report' },
  { value: 'PIS', label: 'PIS: Participating Institution Stakeholder Report' },
  { value: 'FRA', label: 'FRA: Fraud Report' },
  { value: 'CML', label: 'CML: Closed Mopesa Loans Report', disabled: true },
]

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** Day 1-31. */
export const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1))

/** The current year down to 1920. */
export function yearOptions(now: Date = new Date()): string[] {
  const years: string[] = []
  for (let y = now.getFullYear(); y >= 1920; y--) years.push(String(y))
  return years
}

const parts = (d: Date): DateParts => ({
  day: String(d.getDate()),
  month: String(d.getMonth() + 1),
  year: String(d.getFullYear()),
})

/** From defaults to the first day of the previous month, To to its last day (local clock). */
export function defaultPeriod(now: Date = new Date()): { from: DateParts; to: DateParts } {
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const last = new Date(now.getFullYear(), now.getMonth(), 0)
  return { from: parts(first), to: parts(last) }
}

export function initialForm(now: Date = new Date()): ReportForm {
  const { from, to } = defaultPeriod(now)
  return { fileName: 'BC', from, to, version: '8.0', useCachedCba: false, useInstrumentsCodes: false }
}

export interface Visibility {
  from: boolean
  to: boolean
  version: boolean
  shortCba: boolean
  instruments: boolean
}

/** What `reportTypeChanged` (resources/js/app.js) shows for each type; CML also reveals an "Only" date that is not built. */
export function visibility(type: ReportType): Visibility {
  const base = { from: true, to: true, version: true, shortCba: false, instruments: false }
  switch (type) {
    case 'CBA':
      return { ...base, from: false, shortCba: true }
    case 'BS':
    case 'CCG':
      return { ...base, from: false }
    case 'CMC':
      return { ...base, from: false, instruments: true }
    case 'IB':
    case 'PI':
    case 'PIS':
      return { ...base, from: false, to: false }
    case 'CML':
      return { ...base, from: false, to: false, version: false }
    default:
      return base
  }
}

/** `yyyy-MM-dd` of the three selects, or null when any is missing or the date does not exist (31 February). */
export function composeDate(p: DateParts): string | null {
  if (!p.day || !p.month || !p.year) return null
  const d = dayjs(`${p.year}-${p.month.padStart(2, '0')}-${p.day.padStart(2, '0')}`)
  if (!d.isValid() || d.date() !== Number(p.day) || d.month() + 1 !== Number(p.month)) return null
  return d.format('YYYY-MM-DD')
}

export type ReportRequest =
  { kind: 'file'; type: ReportType; body: FileReportBody } | { kind: 'cba'; body: CbaGenerateBody }

export type RequestResult = { request: ReportRequest } | { error: string }

/**
 * What the form sends. Hidden controls are still sent with their defaults, as the old form did (IB, PI and PIS carry From/To);
 * the CBA type goes to the CBA slice with only the To date, and "Download Short CBA" is its `useCached` flag.
 */
export function buildRequest(form: ReportForm): RequestResult {
  if (form.fileName === 'CML') return { error: 'Unknown report requested!' }
  const to = composeDate(form.to)
  if (!to) return { error: 'Please choose a valid To date.' }
  if (form.fileName === 'CBA') {
    return {
      request: { kind: 'cba', body: { toDate: to, version: form.version, useCached: form.useCachedCba } },
    }
  }
  const from = composeDate(form.from)
  if (!from) return { error: 'Please choose a valid From date.' }
  const body: FileReportBody = { fromDate: from, toDate: to, version: form.version }
  if (form.fileName === 'CMC') body.useInstrumentsCodes = form.useInstrumentsCodes
  return { request: { kind: 'file', type: form.fileName, body } }
}

/** The name the server gives the download: CB011 + To date + type. Used when the header is missing. */
export function fallbackFileName(type: ReportType, toDate: string): string {
  return `CB011${toDate.replaceAll('-', '')}${type}.csv`
}
