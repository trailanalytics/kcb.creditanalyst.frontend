import { describe, expect, it } from 'vitest'
import {
  REPORT_TYPES,
  buildRequest,
  composeDate,
  defaultPeriod,
  fallbackFileName,
  initialForm,
  visibility,
  yearOptions,
} from '@/modules/reports/reportModel'
import type { ReportType } from '@/modules/reports/types'

describe('defaultPeriod', () => {
  it('is the previous month, first day to last day', () => {
    const { from, to } = defaultPeriod(new Date(2026, 9, 24))
    expect(from).toEqual({ day: '1', month: '9', year: '2026' })
    expect(to).toEqual({ day: '30', month: '9', year: '2026' })
  })

  it('crosses the year end and handles a leap February', () => {
    expect(defaultPeriod(new Date(2026, 0, 31)).to).toEqual({ day: '31', month: '12', year: '2025' })
    expect(defaultPeriod(new Date(2024, 2, 31)).to).toEqual({ day: '29', month: '2', year: '2024' })
  })

  it('does not skip a month on the 31st', () => {
    expect(defaultPeriod(new Date(2026, 9, 31)).from).toEqual({ day: '1', month: '9', year: '2026' })
  })
})

describe('form options', () => {
  it('starts on BC with version 8.0 and the CML type cannot be chosen', () => {
    const f = initialForm(new Date(2026, 9, 24))
    expect(f.fileName).toBe('BC')
    expect(f.version).toBe('8.0')
    expect(REPORT_TYPES.map((t) => t.value)).toEqual([
      'BC',
      'BS',
      'CAP',
      'CBA',
      'CCG',
      'CMC',
      'IB',
      'PI',
      'PIS',
      'FRA',
      'CML',
    ])
    expect(REPORT_TYPES.filter((t) => t.disabled).map((t) => t.value)).toEqual(['CML'])
  })

  it('offers the current year down to 1920', () => {
    const years = yearOptions(new Date(2026, 9, 24))
    expect(years[0]).toBe('2026')
    expect(years.at(-1)).toBe('1920')
  })
})

describe('visibility', () => {
  const shown = (t: ReportType) => {
    const v = visibility(t)
    return `${v.from ? 'F' : '-'}${v.to ? 'T' : '-'}${v.version ? 'V' : '-'}${v.shortCba ? 'S' : '-'}${v.instruments ? 'I' : '-'}`
  }

  it.each([
    ['BC', 'FTV--'],
    ['CAP', 'FTV--'],
    ['FRA', 'FTV--'],
    ['CBA', '-TVS-'],
    ['BS', '-TV--'],
    ['CCG', '-TV--'],
    ['CMC', '-TV-I'],
    ['IB', '--V--'],
    ['PI', '--V--'],
    ['PIS', '--V--'],
    ['CML', '-----'],
  ] as [ReportType, string][])('%s shows %s', (type, expected) => {
    expect(shown(type)).toBe(expected)
  })
})

describe('composeDate', () => {
  it('writes yyyy-MM-dd', () => {
    expect(composeDate({ day: '5', month: '9', year: '2026' })).toBe('2026-09-05')
  })

  it('rejects a missing part and a day the month does not have', () => {
    expect(composeDate({ day: '', month: '9', year: '2026' })).toBeNull()
    expect(composeDate({ day: '31', month: '2', year: '2026' })).toBeNull()
    expect(composeDate({ day: '29', month: '2', year: '2025' })).toBeNull()
    expect(composeDate({ day: '29', month: '2', year: '2024' })).toBe('2024-02-29')
  })
})

describe('buildRequest', () => {
  const form = (fileName: ReportType, extra = {}) => ({
    ...initialForm(new Date(2026, 9, 24)),
    fileName,
    ...extra,
  })

  it('sends both dates and the version for a plain file report', () => {
    expect(buildRequest(form('BC'))).toEqual({
      request: {
        kind: 'file',
        type: 'BC',
        body: { fromDate: '2026-09-01', toDate: '2026-09-30', version: '8.0' },
      },
    })
  })

  it('still sends the hidden From and To of IB, PI and PIS', () => {
    const r = buildRequest(form('PIS'))
    expect(r).toMatchObject({
      request: { kind: 'file', type: 'PIS', body: { fromDate: '2026-09-01', toDate: '2026-09-30' } },
    })
  })

  it('sends the instruments flag for CMC only', () => {
    expect(buildRequest(form('CMC', { useInstrumentsCodes: true }))).toMatchObject({
      request: { body: { useInstrumentsCodes: true } },
    })
    const bc = buildRequest(form('BC', { useInstrumentsCodes: true }))
    expect('request' in bc && 'useInstrumentsCodes' in (bc.request.body as object)).toBe(false)
  })

  it('sends CBA to the CBA call with the To date, and Short CBA as useCached', () => {
    expect(buildRequest(form('CBA', { useCachedCba: true }))).toEqual({
      request: { kind: 'cba', body: { toDate: '2026-09-30', version: '8.0', useCached: true } },
    })
  })

  it('refuses an impossible date and the disabled CML type', () => {
    const bad = form('BC')
    bad.to.day = '31'
    bad.to.month = '9'
    expect(buildRequest(bad)).toEqual({ error: 'Please choose a valid To date.' })
    const badFrom = form('CAP')
    badFrom.from.day = ''
    expect(buildRequest(badFrom)).toEqual({ error: 'Please choose a valid From date.' })
    expect(buildRequest(form('CML'))).toEqual({ error: 'Unknown report requested!' })
  })

  it('names the file as the server does when the header is missing', () => {
    expect(fallbackFileName('CAP', '2026-09-30')).toBe('CB01120260930CAP.csv')
  })
})
