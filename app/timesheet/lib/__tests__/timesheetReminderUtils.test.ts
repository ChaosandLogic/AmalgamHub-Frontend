import { describe, expect, it } from 'vitest'
import {
  isPastReminderTrigger,
  parseReminderTriggerTime,
  shouldShowTimesheetReminder,
} from '../timesheetReminderUtils'
import { parseSubmittedDays } from '../timesheetUtils'

describe('parseReminderTriggerTime', () => {
  it('parses valid HH:mm', () => {
    expect(parseReminderTriggerTime('09:00')).toBe(9 * 60)
    expect(parseReminderTriggerTime('16:30')).toBe(16 * 60 + 30)
  })

  it('returns null for invalid values', () => {
    expect(parseReminderTriggerTime('9:00')).toBeNull()
    expect(parseReminderTriggerTime('25:00')).toBeNull()
    expect(parseReminderTriggerTime(undefined)).toBeNull()
  })
})

describe('isPastReminderTrigger', () => {
  it('uses weekday time on Tuesday', () => {
    // 2025-04-22 is a Tuesday
    const before = new Date('2025-04-22T08:30:00Z')
    const after = new Date('2025-04-22T10:30:00Z')
    const settings = {
      timezone: 'UTC',
      timesheet_reminder_weekday_time: '09:00',
      timesheet_reminder_monday_time: '16:00',
    }
    expect(isPastReminderTrigger(before, settings)).toBe(false)
    expect(isPastReminderTrigger(after, settings)).toBe(true)
  })

  it('uses monday time on Monday', () => {
    const morning = new Date('2025-04-21T10:00:00Z')
    const evening = new Date('2025-04-21T17:00:00Z')
    const settings = {
      timezone: 'UTC',
      timesheet_reminder_weekday_time: '09:00',
      timesheet_reminder_monday_time: '16:00',
    }
    expect(isPastReminderTrigger(morning, settings)).toBe(false)
    expect(isPastReminderTrigger(evening, settings)).toBe(true)
  })
})

describe('shouldShowTimesheetReminder', () => {
  const baseStatus = {
    weekSubmitted: false,
    todayDayIndex: 2,
    todayDaySubmitted: false,
    weekStartDate: '2025-04-21',
  }

  it('shows when all gates pass', () => {
    expect(
      shouldShowTimesheetReminder({
        timesheetsEnabled: true,
        reminderEnabled: true,
        dismissedToday: false,
        pastTrigger: true,
        status: baseStatus,
      })
    ).toBe(true)
  })

  it('hides when week or day already submitted', () => {
    expect(
      shouldShowTimesheetReminder({
        timesheetsEnabled: true,
        reminderEnabled: true,
        dismissedToday: false,
        pastTrigger: true,
        status: { ...baseStatus, weekSubmitted: true },
      })
    ).toBe(false)
    expect(
      shouldShowTimesheetReminder({
        timesheetsEnabled: true,
        reminderEnabled: true,
        dismissedToday: false,
        pastTrigger: true,
        status: { ...baseStatus, todayDaySubmitted: true },
      })
    ).toBe(false)
  })
})

describe('parseSubmittedDays', () => {
  it('defaults to seven false flags', () => {
    expect(parseSubmittedDays(undefined)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ])
  })

  it('parses JSON string', () => {
    expect(parseSubmittedDays('[true,false,false,false,false,false,false]')[0]).toBe(true)
  })
})
