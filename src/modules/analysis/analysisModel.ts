import axios from 'axios'
import dayjs from 'dayjs'
import { problemOf } from '@/api/http'
import type { AnalysisResults } from './types'

export const DATE_FORMAT = 'YYYY-MM-DD'

export const UPLOAD_FAILED = 'An error occurred while uploading. Please try again.'

export interface AnalysisAction {
  value: string
  label: string
  analyze: boolean
}

export const ACTIONS: AnalysisAction[] = [
  { value: 'update_cba', label: 'UPDATE CBA REPORT', analyze: false },
  { value: 'analyse_pr4', label: 'ANALYZE PR4 AGAINST CBA', analyze: true },
]

/** The chosen action; with nothing chosen it is the first one, so the form always submits (as the Laravel page did). */
export function actionFor(value: string): AnalysisAction {
  return ACTIONS.find((a) => a.value === value) ?? ACTIONS[0]!
}

/** The last day of the month before `today`: the usual reporting month, and the default of the date field. */
export function previousMonthEnd(today: Date = new Date()): string {
  return dayjs(today).startOf('month').subtract(1, 'day').format(DATE_FORMAT)
}

export function isMonthEnd(iso: string): boolean {
  const d = dayjs(iso, DATE_FORMAT, true)
  return d.isValid() && d.isSame(d.endOf('month'), 'day')
}

export interface UploadForm {
  reportingMonth: string | null
  exchangeRate: string
  file: File | null
}

/** The first problem with the form, in the order the page reports them; null when it can be sent. */
export function validateForm(form: UploadForm): string | null {
  if (!form.reportingMonth) return 'Please make sure the submission date is selected!'
  if (!isMonthEnd(form.reportingMonth))
    return 'Submission date must be the last day of a month (e.g. 31 Mar, 30 Apr).'
  const rate = Number(form.exchangeRate)
  if (!form.exchangeRate || !(rate > 0)) return 'Please enter a valid exchange rate greater than 0!'
  if (!form.file) return 'Please make sure the PR4 file is attached!'
  return null
}

/** The multipart body of the upload. `analyze` is the text "true" or "false", as the Laravel page sent it. */
export function uploadBody(form: UploadForm, action: AnalysisAction): FormData {
  const body = new FormData()
  body.append('reporting_month', form.reportingMonth ?? '')
  body.append('file', form.file as File)
  body.append('analyze', String(action.analyze))
  body.append('exchange_rate', form.exchangeRate)
  return body
}

/**
 * What the error dialog says for a failed upload: for a validation answer the first message and how many more there are, for
 * 409 and 500 the text the server sent, and when there is none the generic line.
 */
export function uploadFailureMessage(e: unknown): string {
  const problem = problemOf(e)
  if (axios.isAxiosError(e) && e.response?.status === 422 && problem?.errors) {
    const messages = Object.values(problem.errors).flat()
    if (messages.length > 0) {
      const more = messages.length - 1
      return more > 0 ? `${messages[0]} (and ${more} more error${more === 1 ? '' : 's'})` : messages[0]!
    }
  }
  return problem?.detail || UPLOAD_FAILED
}

/** The path of the link the server returns for the background processes page, so it works whatever host the API sees. */
export function pathOf(url: string, fallback = '/background-processes'): string {
  try {
    return new URL(url, 'http://localhost').pathname || fallback
  } catch {
    return fallback
  }
}

/** 12345 -> "12,345": the stored count as text, with separators. */
export function numberWithCommas(value: string | number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export interface ResultLine {
  key: string
  /** Bold values and the plain text between them, in reading order. */
  parts: { text: string; bold?: boolean }[]
  danger?: boolean
  divider?: 'after'
}

const b = (text: string) => ({ text, bold: true })
const t = (text: string) => ({ text })

/** The six lines of the results page, from the stored strings. Counts get separators, percentages are printed as stored. */
export function resultLines(r: AnalysisResults): ResultLine[] {
  const n = numberWithCommas
  return [
    {
      key: 'compared',
      parts: [
        b(n(r.pr4_records_count)),
        t(' records found in the Pr4 File compared against '),
        b(n(r.cba_records_count)),
        t(' records in the CBA.'),
      ],
    },
    {
      key: 'matching',
      divider: 'after',
      parts: [
        b(n(r.matching_records_count)),
        t(' ('),
        b(`${r.matching_records_percentage}%`),
        t(') records found in the Pr4 File were also found in the CBA.'),
      ],
    },
    {
      key: 'balance',
      parts: [
        b(n(r.balance_records_count)),
        t(' ('),
        b(`${r.balance_records_percentage}%`),
        t(') records found in the Pr4 have a balance, of these, '),
        b(n(r.matching_balance_count)),
        t(' ('),
        b(`${r.matching_balance_percentage}%`),
        t(') have identical balances of the same record in the CBA.'),
      ],
    },
    {
      key: 'installment',
      parts: [
        b(n(r.installment_records_count)),
        t(' ('),
        b(`${r.installment_records_percentage}%`),
        t(') records found in the Pr4 have installment amount, of these, '),
        b(n(r.matching_installment_count)),
        t(' ('),
        b(`${r.matching_installment_percentage}%`),
        t(') have identical installment amount of the same record in the CBA.'),
      ],
    },
    {
      key: 'arrears',
      divider: 'after',
      parts: [
        b(n(r.arrears_records_count)),
        t(' ('),
        b(`${r.arrears_records_percentage}%`),
        t(') records found in the Pr4 are in arrears, of these, '),
        b(n(r.matching_arrears_count)),
        t(' ('),
        b(`${r.matching_arrears_percentage}%`),
        t(') have identical arrears days and amounts of the same record in the CBA.'),
      ],
    },
    {
      key: 'float',
      danger: true,
      parts: [
        b(n(r.pr4_records_count)),
        t(' records found in the Pr4 File, of these, '),
        b(n(r.pr4_float_loans_records_count)),
        t(' ('),
        b(`${r.pr4_float_loans_records_percentage}%`),
        t(') are KCB AIRTEL AGENT FLOAT LOAN and are not reported in the CBA.'),
      ],
    },
  ]
}
