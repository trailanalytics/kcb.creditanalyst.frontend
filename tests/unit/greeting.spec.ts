import { describe, expect, it } from 'vitest'
import { timeOfDayGreeting } from '@/utils/greeting'

// Uganda is UTC+3 all year; the greeting follows Africa/Kampala, not the browser's zone.
const utc = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 23, h, m))

describe('timeOfDayGreeting', () => {
  it('changes at 12:00 and 17:00 Kampala time', () => {
    expect(timeOfDayGreeting(utc(8, 59))).toBe('Good morning') // 11:59
    expect(timeOfDayGreeting(utc(9, 0))).toBe('Good afternoon') // 12:00
    expect(timeOfDayGreeting(utc(13, 59))).toBe('Good afternoon') // 16:59
    expect(timeOfDayGreeting(utc(14, 0))).toBe('Good evening') // 17:00
    expect(timeOfDayGreeting(utc(21, 0))).toBe('Good morning') // 00:00 next day
  })
})
