import { describe, expect, it } from 'vitest'
import { columnStates, columnSummary } from '@/modules/cbsqueries/columnModel'
import { COLUMNS, finding } from './fixtures'

describe('columnStates', () => {
  it('is unknown for every column until a result exists', () => {
    const states = columnStates(COLUMNS, null)
    expect([...states.values()]).toEqual(['unknown', 'unknown', 'unknown'])
  })

  it('ticks every column when there is no finding about it', () => {
    const states = columnStates(COLUMNS, [finding({ code: 'EXTRA_COLUMN', severity: 'WARNING' })])
    expect([...states.values()]).toEqual(['ok', 'ok', 'ok'])
  })

  it('marks a column missing from MISSING_COLUMN, by its expected alias or by the name in the message', () => {
    const states = columnStates(COLUMNS, [
      finding({ code: 'MISSING_COLUMN', expectedAlias: 'CUS_NAME' }),
      finding({
        ordinal: 2,
        code: 'MISSING_COLUMN',
        severity: 'WARNING',
        message: 'Column `CUS_PHONE_1` is not produced.',
      }),
    ])
    expect(states.get('CUS_ID')).toBe('ok')
    expect(states.get('CUS_NAME')).toBe('missing')
    expect(states.get('CUS_PHONE_1')).toBe('missing')
  })

  it('treats a missing or wrong alias as not yet producing the column it should name', () => {
    const states = columnStates(COLUMNS, [
      finding({ code: 'MISSING_ALIAS', expectedAlias: 'cus_id' }),
      finding({ ordinal: 2, code: 'WRONG_ALIAS', foundText: 'NM', expectedAlias: 'CUS_NAME' }),
      finding({ ordinal: 3, code: 'WRONG_ALIAS', foundText: 'ZZ', expectedAlias: null }),
    ])
    expect(states.get('CUS_ID')).toBe('missing')
    expect(states.get('CUS_NAME')).toBe('missing')
    expect(states.get('CUS_PHONE_1')).toBe('ok')
  })

  it('does not tick anything when the select list cannot be read', () => {
    for (const code of ['PARSE_ERROR', 'NOT_SELECT', 'STAR_SELECT']) {
      const states = columnStates(COLUMNS, [finding({ code })])
      expect([...states.values()]).toEqual(['unknown', 'unknown', 'unknown'])
    }
  })
})

describe('columnSummary', () => {
  it('counts the ticks and says nothing while unknown', () => {
    expect(columnSummary(columnStates(COLUMNS, null))).toBeNull()
    expect(
      columnSummary(columnStates(COLUMNS, [finding({ code: 'MISSING_COLUMN', expectedAlias: 'CUS_ID' })])),
    ).toBe('2 of 3 expected columns produced')
  })
})
