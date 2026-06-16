import { describe, expect, it } from 'vitest'
import {
  getLocalDateString,
  normalizeToMidnight,
  parseLocalDateString,
  startOfWeek,
  weekStartKeyFromApi,
} from '../dateUtils'

describe('getLocalDateString', () => {
  it('returns YYYY-MM-DD in local timezone without UTC shift', () => {
    const date = new Date(2025, 3, 21, 23, 59, 59)
    expect(getLocalDateString(date)).toBe('2025-04-21')
  })
})

describe('parseLocalDateString', () => {
  it('parses date at midnight local time', () => {
    const date = parseLocalDateString('2025-04-21')
    expect(date.getFullYear()).toBe(2025)
    expect(date.getMonth()).toBe(3)
    expect(date.getDate()).toBe(21)
    expect(date.getHours()).toBe(0)
    expect(date.getMinutes()).toBe(0)
    expect(date.getSeconds()).toBe(0)
  })
})

describe('weekStartKeyFromApi', () => {
  it('extracts date prefix from ISO strings', () => {
    expect(weekStartKeyFromApi('2025-04-21')).toBe('2025-04-21')
    expect(weekStartKeyFromApi('2025-04-21T12:00:00Z')).toBe('2025-04-21')
  })

  it('handles null and invalid values', () => {
    expect(weekStartKeyFromApi(null)).toBe('')
    expect(weekStartKeyFromApi(undefined)).toBe('')
    expect(weekStartKeyFromApi('garbage')).toBe('')
  })
})

describe('startOfWeek', () => {
  it('returns Monday at midnight for a Wednesday', () => {
    const wednesday = new Date(2025, 3, 23)
    const monday = startOfWeek(wednesday)
    expect(monday.getDay()).toBe(1)
    expect(monday.getDate()).toBe(21)
    expect(monday.getHours()).toBe(0)
  })

  it('returns previous Monday for a Sunday', () => {
    const sunday = new Date(2025, 3, 27)
    const monday = startOfWeek(sunday)
    expect(monday.getDay()).toBe(1)
    expect(monday.getDate()).toBe(21)
  })
})

describe('normalizeToMidnight', () => {
  it('zeroes hours, minutes, seconds, and milliseconds', () => {
    const date = new Date(2025, 3, 21, 14, 30, 45, 123)
    const normalized = normalizeToMidnight(date)
    expect(normalized.getHours()).toBe(0)
    expect(normalized.getMinutes()).toBe(0)
    expect(normalized.getSeconds()).toBe(0)
    expect(normalized.getMilliseconds()).toBe(0)
    expect(normalized.getDate()).toBe(21)
  })
})
