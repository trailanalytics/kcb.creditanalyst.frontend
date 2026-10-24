import { describe, expect, it } from 'vitest'
import {
  chargeProblems,
  dateLabel,
  expiryLine,
  groupImports,
  previousMonthEnd,
  rateProblem,
} from '@/modules/t24/logic'
import { adminConfigRoutes, t24Routes } from '@/modules/t24/routes'
import type { ImportLog } from '@/modules/t24/types'

const log = (id: number): ImportLog => ({
  id,
  imported_records: 5,
  record_category: 'loans',
  started_at: null,
  ended_at: null,
  imported_by: null,
  time_taken: '1m',
})

describe('dateLabel', () => {
  it('writes D, MMM YYYY from either date shape', () => {
    expect(dateLabel('2026-10-24')).toBe('24, Oct 2026')
    expect(dateLabel('20260930')).toBe('30, Sep 2026')
    expect(dateLabel('2026-01-05 10:00:00')).toBe('5, Jan 2026')
  })
  it('leaves what it cannot read alone', () => {
    expect(dateLabel('soon')).toBe('soon')
    expect(dateLabel('20261340')).toBe('20261340')
    expect(dateLabel(null)).toBe('')
  })
})

describe('previousMonthEnd', () => {
  it('is the last day of the previous month', () => {
    expect(previousMonthEnd(new Date(2026, 9, 24))).toBe('20260930')
    expect(previousMonthEnd(new Date(2026, 2, 31))).toBe('20260228')
    expect(previousMonthEnd(new Date(2024, 2, 1))).toBe('20240229')
  })
  it('crosses the year', () => expect(previousMonthEnd(new Date(2027, 0, 15))).toBe('20261231'))
})

describe('groupImports', () => {
  it('lists the newest date first', () => {
    const groups = groupImports({ '2026-10-23': [log(1)], '2026-10-24': [log(2), log(3)] })
    expect(groups.map((g) => g.date)).toEqual(['2026-10-24', '2026-10-23'])
    expect(groups[0]?.label).toBe('24, Oct 2026')
    expect(groups[0]?.logs).toHaveLength(2)
  })
  it('accepts the empty answers {} and [] and nothing', () => {
    expect(groupImports({})).toEqual([])
    expect(groupImports([])).toEqual([])
    expect(groupImports(null)).toEqual([])
  })
  it('skips a date with no logs', () => expect(groupImports({ '2026-10-24': [] })).toEqual([]))
})

describe('rateProblem', () => {
  it.each([
    ['', 'Enter the UGX equivalent.'],
    ['abc', 'The UGX equivalent must be a number.'],
    ['0', 'The UGX equivalent must be greater than zero.'],
    ['-5', 'The UGX equivalent must be greater than zero.'],
    ['1000000', 'The UGX equivalent must be less than 1,000,000.'],
  ])('%s -> %s', (text, message) => expect(rateProblem(text)).toBe(message))
  it('accepts a rate that fits decimal(8,2)', () => {
    expect(rateProblem('3,700.50')).toBeNull()
    expect(rateProblem('999999.99')).toBeNull()
  })
})

describe('chargeProblems', () => {
  it('asks for an account and an amount of at least 100', () => {
    expect(chargeProblems('', '5,000')).toEqual({ crb_suspense_account: 'Enter the CRB suspense account.' })
    expect(chargeProblems('UGX1', '99')).toEqual({ credit_amount: 'Invalid CRB Charge Amount!' })
    expect(chargeProblems('UGX1', '')).toEqual({ credit_amount: 'Invalid CRB Charge Amount!' })
    expect(chargeProblems('UGX1', '5,000')).toEqual({})
  })
})

describe('expiryLine', () => {
  it('tells the three states apart', () => {
    expect(expiryLine({ configured: false })).toBe('No credentials are saved yet.')
    expect(expiryLine({ configured: true })).toBe('No expiry date is saved.')
    expect(expiryLine({ configured: true, expiry_date: '2026-10-01', expired: true })).toBe(
      'The password expired on 1, Oct 2026.',
    )
    expect(
      expiryLine({ configured: true, expiry_date: '2026-11-30', expired: false, days_to_expiry: 1 }),
    ).toBe('The password expires on 30, Nov 2026 (1 day left).')
  })
})

describe('routes', () => {
  it('serves /t24 and /t24/sync behind Sync T24', () => {
    expect(t24Routes.map((r) => r.path)).toEqual(['/t24/sync', '/t24'])
    expect(t24Routes.every((r) => r.meta?.permission === 'Sync T24')).toBe(true)
  })
  it('gates the configuration page on Manage Configurations', () => {
    expect(adminConfigRoutes[0]?.path).toBe('/admin/configuration')
    expect(adminConfigRoutes[0]?.meta?.permission).toBe('Manage Configurations')
  })
})
