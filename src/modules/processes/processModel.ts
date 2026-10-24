import type { BackgroundProcess, ProcessStatus, ProcessUpdate } from './types'

/** The process types a retry is offered for: the PR4 upload and the loan update, which re-run from the rows already imported. */
export const RETRYABLE_TYPES = ['pr4_import_update', 'pr4_import_analyse', 'pr4_loan_update']

export const ACTIVE_POLL_MS = 4000
export const FULL_REFRESH_MS = 120000

export const isActive = (p: Pick<BackgroundProcess, 'status'>) =>
  p.status === 'pending' || p.status === 'processing'

export const isRetryable = (p: Pick<BackgroundProcess, 'status' | 'type'>) =>
  p.status === 'failed' && RETRYABLE_TYPES.includes(p.type)

const BADGE_LABELS: Record<ProcessStatus, string> = {
  completed: 'Completed',
  failed: 'Failed',
  processing: 'Processing',
  pending: 'Pending',
}

export const badgeLabel = (status: string) => BADGE_LABELS[status as ProcessStatus] ?? status

const BADGE_CLASSES: Record<ProcessStatus, string> = {
  completed: 'bg-success text-white',
  failed: 'bg-danger text-white',
  processing: 'bg-primary-1 text-white',
  pending: 'bg-slate-500 text-white',
}

export const badgeClass = (status: string) =>
  BADGE_CLASSES[status as ProcessStatus] ?? 'bg-slate-500 text-white'

/** Green when done, red when failed, a moving blue bar while it runs. */
export function progressBarClass(status: string) {
  if (status === 'completed') return 'bg-success'
  if (status === 'failed') return 'bg-danger'
  return 'bg-primary-1 progress-striped'
}

/** The start time, or the time it was queued while it has not started. */
export const startedLabel = (p: Pick<BackgroundProcess, 'started_at' | 'created_at'>) =>
  p.started_at ? p.started_at : `${p.created_at} (queued)`

/** `cba_generation` is shown as CBA GENERATION (the page uppercases it). */
export const typeLabel = (type: string) => type.replace(/_/g, ' ')

export function truncate(text: string | null, length = 80) {
  return text && text.length > length ? `${text.slice(0, length)}…` : text
}

/** The list with the polled fields of one process replaced; a process that is not on the page is ignored. */
export function applyUpdate(list: BackgroundProcess[], update: ProcessUpdate): BackgroundProcess[] {
  return list.map((p) => (p.id === update.id ? { ...p, ...update } : p))
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Titles hold file names a user chose, and the confirmation dialogs render HTML. */
export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c)
