import { describe, expect, it } from 'vitest'
import {
  listOf,
  toModuleSummary,
  toOutcome,
  toVersionDetail,
  toVersionSummary,
  unwrap,
} from '@/modules/cbsqueries/normalize'
import { versionJson } from './fixtures'

describe('listOf and unwrap', () => {
  it('accept a bare array or a data wrapper', () => {
    expect(listOf([1, 2])).toEqual([1, 2])
    expect(listOf({ data: [1] })).toEqual([1])
    expect(listOf(null)).toEqual([])
    expect(unwrap({ data: { id: 1 } })).toEqual({ id: 1 })
    expect(unwrap({ id: 2, data: 'x' })).toEqual({ id: 2, data: 'x' })
  })
})

describe('toModuleSummary', () => {
  const module = {
    code: 'extract-loans',
    name: 'Extract loans',
    bindCount: 2,
    columns: [
      { ordinal: 2, name: 'B', required: false, description: null },
      { ordinal: 1, name: 'A', required: true, description: 'first' },
    ],
  }

  it('reads the per core system state from an array and sorts the columns by ordinal', () => {
    const m = toModuleSummary({
      ...module,
      coreSystems: [
        {
          coreSystem: 'T24',
          activeVersion: { id: 5, versionNo: 3, activatedAt: '2026-10-01T00:00:00Z', activatedBy: 'Ann' },
          sampleCount: 2,
        },
        { coreSystem: 'FINACLE', activeVersion: null, sampleCount: 0 },
      ],
    })
    expect(m.columns.map((c) => c.name)).toEqual(['A', 'B'])
    expect(m.systems).toHaveLength(2)
    expect(m.systems[0]).toMatchObject({
      coreSystem: 'T24',
      sampleCount: 2,
      activeVersion: { id: 5, versionNo: 3, activatedBy: 'Ann' },
    })
    expect(m.systems[1]?.activeVersion).toBeNull()
  })

  it('reads the same state keyed by the core system code, with a person as an object', () => {
    const m = toModuleSummary({
      ...module,
      coreSystems: {
        T24: { activeVersion: { id: 5, versionNo: 1, activatedBy: { name: 'Bob' } }, sampleCount: 1 },
      },
    })
    expect(m.systems[0]).toMatchObject({ coreSystem: 'T24', activeVersion: { activatedBy: 'Bob' } })
  })
})

describe('toOutcome', () => {
  it('keeps the finding fields and fills the counts when they are missing', () => {
    const o = toOutcome({
      findings: [
        {
          ordinal: 1,
          severity: 'ERROR',
          code: 'MISSING_ALIAS',
          columnPosition: 5,
          foundText: 'A.X',
          expectedAlias: 'X',
          suggestedOffset: 12,
          message: 'm',
        },
        { ordinal: 2, severity: 'WARNING', code: 'EXTRA_COLUMN', message: 'w' },
      ],
    })
    expect(o).toMatchObject({ passed: false, errorCount: 1, warningCount: 1 })
    expect(o.findings[0]).toMatchObject({ columnPosition: 5, expectedAlias: 'X', suggestedOffset: 12 })
    expect(o.findings[1]).toMatchObject({ columnPosition: null, suggestedOffset: null })
  })

  it('takes the server counts and passed flag as they are', () => {
    expect(toOutcome({ passed: true, errorCount: 0, warningCount: 3, findings: [] })).toMatchObject({
      passed: true,
      warningCount: 3,
    })
  })
})

describe('toVersionDetail', () => {
  it('reads the documented version with its module, validation, reviews, events and flags', () => {
    const v = toVersionDetail(
      versionJson({
        status: 'CHANGES_RECOMMENDED',
        latestValidation: { passed: true, runAt: '2026-10-21T08:00:00Z', findings: [] },
        reviews: [
          {
            outcome: 'CHANGES_RECOMMENDED',
            comment: 'c',
            reviewer: 'Amy Analyst',
            createdAt: '2026-10-22T08:00:00Z',
            recommendations: [{ id: 9, text: 'Alias it', appliedInVersionId: 4 }],
          },
        ],
        events: [
          { id: 1, event: 'CREATED', actor: 'Dan DBA', detail: null, createdAt: '2026-10-20T08:00:00Z' },
        ],
        canReview: true,
      }),
    )
    expect(v).toMatchObject({
      id: 12,
      coreSystem: 'T24',
      module: 'extract-customers',
      moduleName: 'Extract customers',
      versionNo: 3,
      status: 'CHANGES_RECOMMENDED',
      canEdit: true,
      canReview: true,
      canActivate: false,
    })
    expect(v.moduleInfo.columns).toHaveLength(3)
    expect(v.latestValidation?.passed).toBe(true)
    expect(v.reviews[0]?.recommendations[0]).toEqual({ id: 9, text: 'Alias it', appliedInVersionId: 4 })
    expect(v.events[0]?.event).toBe('CREATED')
  })

  it('accepts the text as sqlText and a data wrapper, and defaults flags to false', () => {
    const v = toVersionDetail({
      data: { id: 1, coreSystem: { code: 'FINACLE' }, module: 'x', status: 'nonsense', sqlText: 'SELECT 1' },
    })
    expect(v).toMatchObject({
      coreSystem: 'FINACLE',
      module: 'x',
      status: 'DRAFT',
      sql: 'SELECT 1',
      canEdit: false,
      canSubmit: false,
    })
  })
})

describe('toVersionSummary', () => {
  it('reads codes and people given as objects', () => {
    const s = toVersionSummary({
      id: 3,
      coreSystem: { code: 'T24' },
      module: { code: 'm', name: 'M' },
      versionNo: 1,
      status: 'ACTIVE',
      isSample: true,
      createdBy: { name: 'Zed' },
    })
    expect(s).toMatchObject({
      coreSystem: 'T24',
      module: 'm',
      moduleName: 'M',
      isSample: true,
      createdBy: 'Zed',
    })
  })
})
