import axios from 'axios'
import { problemOf } from '@/api/http'

export const UPLOAD_FAILED = 'An error occurred. Please try again.'

export type FixKind = 'delete' | 'customer'

export interface FixTabConfig {
  kind: FixKind
  endpoint: 'delete-records' | 'fix-customer-details'
  accept: string
  /** Largest file the server accepts, in kilobytes (the message of a 422 says so too). */
  maxKb: number
}

export const FIX_TABS: Record<FixKind, FixTabConfig> = {
  delete: { kind: 'delete', endpoint: 'delete-records', accept: '.csv,.txt,.xlsx,.xls', maxKb: 102_400 },
  customer: {
    kind: 'customer',
    endpoint: 'fix-customer-details',
    accept: '.csv,.txt,.xlsx,.xls',
    maxKb: 51_200,
  },
}

/**
 * The text of the error dialog for a failed upload: the validation messages one per line, else the server's text, else the generic
 * line. HTML, as the old dialog rendered it, so what the server sent is escaped first.
 */
export function uploadFailureHtml(e: unknown): string {
  const problem = problemOf(e)
  if (axios.isAxiosError(e) && e.response?.status === 422 && problem?.errors) {
    const messages = Object.values(problem.errors).flat()
    if (messages.length > 0) return messages.map(escapeHtml).join('<br>')
  }
  return problem?.detail ? escapeHtml(problem.detail) : UPLOAD_FAILED
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`)
}

/** The label of the file box: its name once chosen. */
export function fileLabel(file: File | null): string {
  return file ? file.name : 'Choose file (.csv or .xlsx)'
}

/** The size check the server repeats: true when the file is within the limit. */
export function withinLimit(file: File, maxKb: number): boolean {
  return file.size <= maxKb * 1024
}

/** The in-bar percentage shows only when the bar is wide enough to hold it. */
export function showBarText(progress: number): boolean {
  return progress > 15
}
