import { describe, expect, it } from 'vitest'
import {
  crbDate,
  dateInputFormat,
  formatDate,
  formatNumber,
  numberWithCommas,
  readableDate,
} from '@/utils/format'

describe('format helpers (ports of the Vue 2 filters)', () => {
  it('formats numbers with thousands separators and no decimals', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
    expect(formatNumber('1500.6')).toBe('1,501')
    expect(formatNumber(null)).toBe('0')
    expect(formatNumber('abc')).toBe('0')
  })

  it('formats dates like moment did', () => {
    expect(formatDate('2024-09-30')).toBe('30/09/2024')
    expect(readableDate('2024-09-30')).toBe('30/Sep/2024')
    expect(crbDate('2024-09-30')).toBe('240930')
    expect(dateInputFormat('2024-09-30T10:00:00')).toBe('2024-09-30')
    expect(formatDate('')).toBe('')
    expect(formatDate(null)).toBe('')
  })

  it('adds commas without touching decimals', () => {
    expect(numberWithCommas(1234567)).toBe('1,234,567')
    expect(numberWithCommas('')).toBe('')
  })
})
