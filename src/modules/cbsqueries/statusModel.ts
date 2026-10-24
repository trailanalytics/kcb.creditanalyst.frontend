import dayjs from 'dayjs'
import type { Severity, VersionDetail, VersionStatus, VersionSummary } from './types'

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export interface StatusInfo {
  label: string
  tone: Tone
  /** The banner text: where the version stands and what happens next. */
  message: string
}

const INFO: Record<VersionStatus, StatusInfo> = {
  DRAFT: {
    label: 'Draft',
    tone: 'neutral',
    message: 'This version is a draft. Edit the query, then submit it for validation and review.',
  },
  VALIDATION_FAILED: {
    label: 'Validation failed',
    tone: 'danger',
    message: 'The submitted query failed validation. Fix the findings and submit it again.',
  },
  VALIDATED: {
    label: 'Validated',
    tone: 'info',
    message: 'The query passed validation. It now waits for a credit analyst to review it.',
  },
  CHANGES_RECOMMENDED: {
    label: 'Changes recommended',
    tone: 'warning',
    message: 'A credit analyst recommended changes. Revise this version to apply them in a new draft.',
  },
  APPROVED: {
    label: 'Approved',
    tone: 'success',
    message: 'A credit analyst approved this query. It can now be activated.',
  },
  ACTIVE: {
    label: 'Active',
    tone: 'success',
    message: 'The extractors read this query now.',
  },
  SUPERSEDED: {
    label: 'Superseded',
    tone: 'neutral',
    message:
      'A newer version replaced this one. An approved older version can be activated again to roll back.',
  },
}

export const statusInfo = (status: VersionStatus): StatusInfo => INFO[status]

/** Still moving through draft, validation and review; neither live nor retired. */
const IN_PROGRESS: VersionStatus[] = [
  'DRAFT',
  'VALIDATION_FAILED',
  'VALIDATED',
  'CHANGES_RECOMMENDED',
  'APPROVED',
]
export const isInProgress = (status: VersionStatus) => IN_PROGRESS.includes(status)

/** The highest version number still in progress, per module code, for one core system's versions. */
export function latestInProgress(versions: VersionSummary[]): Map<string, VersionSummary> {
  const latest = new Map<string, VersionSummary>()
  for (const v of versions) {
    if (!isInProgress(v.status)) continue
    const known = latest.get(v.module)
    if (!known || v.versionNo > known.versionNo) latest.set(v.module, v)
  }
  return latest
}

export const SEVERITY_TONE: Record<Severity, Tone> = { ERROR: 'danger', WARNING: 'warning', INFO: 'info' }

/** The classes of a small coloured badge. */
export const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  info: 'bg-sky-100 text-sky-800',
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-900',
  danger: 'bg-red-100 text-red-800',
}

/** The validation badge of an overview row: what the active or in-progress version says about the query. */
export function validationBadge(
  active: { id: number } | null,
  inProgress: VersionSummary | undefined,
): { label: string; tone: Tone } {
  // activation re-runs the validator, so an active version always passed
  if (active) return { label: 'Validated', tone: 'success' }
  if (inProgress) {
    const info = statusInfo(inProgress.status)
    return { label: `${info.label}, v${inProgress.versionNo}`, tone: info.tone }
  }
  return { label: 'No active query', tone: 'danger' }
}

export interface AvailableActions {
  edit: boolean
  submit: boolean
  review: boolean
  revise: boolean
  activate: boolean
  promoteSample: boolean
  removeSample: boolean
}

/**
 * What the buttons of a version offer the caller. `edit`, `submit`, `review` and `activate` are the server's flags; revise
 * and the sample actions have no flag, so they follow the status and the permission, and the server refuses the rest.
 */
export function availableActions(
  v: Pick<
    VersionDetail,
    'status' | 'isSample' | 'activatedAt' | 'canEdit' | 'canSubmit' | 'canReview' | 'canActivate'
  >,
  canManage: boolean,
): AvailableActions {
  const wasActive = v.status === 'ACTIVE' || (v.status === 'SUPERSEDED' && v.activatedAt !== null)
  return {
    edit: v.canEdit,
    submit: v.canSubmit,
    review: v.canReview,
    activate: v.canActivate,
    revise: canManage && v.status === 'CHANGES_RECOMMENDED',
    promoteSample: canManage && wasActive && !v.isSample,
    removeSample: canManage && v.isSample,
  }
}

/** "24 Oct 2026, 08:30". The server sends UTC, with or without a zone; it is shown in the browser's zone. */
export function whenText(value: string | null | undefined): string {
  if (!value) return ''
  const d = dayjs(/(Z|[+-]\d\d:?\d\d)$/.test(value) ? value : `${value}Z`)
  return d.isValid() ? d.format('D MMM YYYY, HH:mm') : ''
}

export function dateText(value: string | null | undefined): string {
  if (!value) return ''
  const d = dayjs(/(Z|[+-]\d\d:?\d\d)$/.test(value) ? value : `${value}Z`)
  return d.isValid() ? d.format('D MMM YYYY') : ''
}

/** "Version 3 of extract-customers" style heading for a version. */
export const versionTitle = (v: Pick<VersionSummary, 'coreSystem' | 'module' | 'versionNo'>) =>
  `${v.coreSystem} / ${v.module} / v${v.versionNo}`
