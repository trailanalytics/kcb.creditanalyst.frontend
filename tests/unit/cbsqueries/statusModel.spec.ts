import { describe, expect, it } from 'vitest'
import {
  availableActions,
  isInProgress,
  latestInProgress,
  statusInfo,
  validationBadge,
  whenText,
} from '@/modules/cbsqueries/statusModel'
import { toVersionSummary } from '@/modules/cbsqueries/normalize'
import type { VersionStatus } from '@/modules/cbsqueries/types'

const flags = { canEdit: false, canSubmit: false, canReview: false, canActivate: false }
const base = (status: VersionStatus, extra = {}) => ({
  status,
  isSample: false,
  activatedAt: null as string | null,
  ...flags,
  ...extra,
})
const summary = (id: number, module: string, versionNo: number, status: VersionStatus) =>
  toVersionSummary({ id, coreSystem: 'T24', module, versionNo, status })

describe('statusInfo', () => {
  it('says in plain words where each status stands', () => {
    expect(statusInfo('CHANGES_RECOMMENDED').label).toBe('Changes recommended')
    expect(statusInfo('CHANGES_RECOMMENDED').message).toMatch(/Revise/)
    expect(statusInfo('VALIDATION_FAILED').tone).toBe('danger')
    expect(statusInfo('ACTIVE').tone).toBe('success')
  })
})

describe('availableActions', () => {
  it('follows the server flags for edit, submit, review and activate', () => {
    const a = availableActions(base('VALIDATED', { canReview: true }), false)
    expect(a).toMatchObject({ edit: false, submit: false, review: true, activate: false })
    const b = availableActions(base('APPROVED', { canActivate: true }), true)
    expect(b.activate).toBe(true)
  })

  it('offers revise only after changes were recommended, and only to a DBA', () => {
    expect(availableActions(base('CHANGES_RECOMMENDED'), true).revise).toBe(true)
    expect(availableActions(base('CHANGES_RECOMMENDED'), false).revise).toBe(false)
    expect(availableActions(base('DRAFT'), true).revise).toBe(false)
  })

  it('offers promote for a version that was active and is not a sample yet, and remove for a sample', () => {
    expect(availableActions(base('ACTIVE'), true).promoteSample).toBe(true)
    expect(
      availableActions(base('SUPERSEDED', { activatedAt: '2026-10-01T00:00:00Z' }), true).promoteSample,
    ).toBe(true)
    expect(availableActions(base('SUPERSEDED'), true).promoteSample).toBe(false)
    expect(availableActions(base('APPROVED'), true).promoteSample).toBe(false)
    expect(availableActions(base('ACTIVE', { isSample: true }), true)).toMatchObject({
      promoteSample: false,
      removeSample: true,
    })
    expect(availableActions(base('ACTIVE'), false)).toMatchObject({
      promoteSample: false,
      removeSample: false,
    })
  })
})

describe('in progress', () => {
  it('counts every status between draft and approved', () => {
    expect(isInProgress('DRAFT')).toBe(true)
    expect(isInProgress('APPROVED')).toBe(true)
    expect(isInProgress('ACTIVE')).toBe(false)
    expect(isInProgress('SUPERSEDED')).toBe(false)
  })

  it('picks the highest version number per module', () => {
    const latest = latestInProgress([
      summary(1, 'extract-loans', 1, 'ACTIVE'),
      summary(2, 'extract-loans', 2, 'VALIDATED'),
      summary(3, 'extract-loans', 3, 'DRAFT'),
      summary(4, 'extract-customers', 1, 'SUPERSEDED'),
      summary(5, 'pr4-loans', 4, 'APPROVED'),
    ])
    expect(latest.get('extract-loans')?.id).toBe(3)
    expect(latest.has('extract-customers')).toBe(false)
    expect(latest.get('pr4-loans')?.id).toBe(5)
  })
})

describe('validationBadge', () => {
  it('is green for an active version, names the version in progress otherwise, and warns when there is neither', () => {
    expect(validationBadge({ id: 1 }, undefined)).toEqual({ label: 'Validated', tone: 'success' })
    expect(validationBadge(null, summary(2, 'm', 4, 'VALIDATION_FAILED'))).toEqual({
      label: 'Validation failed, v4',
      tone: 'danger',
    })
    expect(validationBadge(null, undefined)).toEqual({ label: 'No active query', tone: 'danger' })
  })
})

describe('whenText', () => {
  it('reads a time without a zone as UTC and ignores an empty value', () => {
    expect(whenText('')).toBe('')
    expect(whenText(null)).toBe('')
    expect(whenText('2026-10-24T08:30:00Z')).toBe(whenText('2026-10-24T08:30:00'))
    expect(whenText('2026-10-24T08:30:00Z')).toMatch(/^24 Oct 2026, \d\d:\d\d$/)
  })
})
