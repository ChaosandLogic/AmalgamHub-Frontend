export interface ReminderTimeSettings {
  timezone?: string
  timesheet_reminder_weekday_time?: string
  timesheet_reminder_monday_time?: string
}

/** Parse HH:mm into minutes since midnight. Returns null if invalid. */
export function parseReminderTriggerTime(value: string | undefined): number | null {
  if (!value || typeof value !== 'string') return null
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim())
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? ''
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  return { weekday, minutes: hour * 60 + minute }
}

/**
 * True when local time in the configured timezone is on or after the reminder trigger.
 * Monday uses monday_time; Tue–Sun use weekday_time.
 */
export function isPastReminderTrigger(
  now: Date,
  settings: ReminderTimeSettings
): boolean {
  const timeZone = settings.timezone || 'UTC'
  const { weekday, minutes } = getZonedParts(now, timeZone)
  const isMonday = weekday === 'Mon'
  const triggerMinutes = parseReminderTriggerTime(
    isMonday
      ? settings.timesheet_reminder_monday_time || '16:00'
      : settings.timesheet_reminder_weekday_time || '09:00'
  )
  if (triggerMinutes == null) return false
  return minutes >= triggerMinutes
}

export function reminderDismissStorageKey(userId: string, dateKey: string): string {
  return `timesheet_reminder_${userId}_${dateKey}`
}

export function isReminderDismissedToday(userId: string, dateKey: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(reminderDismissStorageKey(userId, dateKey)) === '1'
  } catch {
    return false
  }
}

export function dismissReminderForToday(userId: string, dateKey: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(reminderDismissStorageKey(userId, dateKey), '1')
  } catch {
    /* ignore */
  }
}

export interface ReminderStatusResponse {
  weekSubmitted: boolean
  todayDayIndex: number
  todayDaySubmitted: boolean
  weekStartDate: string
}

export function shouldShowTimesheetReminder(params: {
  timesheetsEnabled: boolean
  reminderEnabled: boolean
  dismissedToday: boolean
  pastTrigger: boolean
  status: ReminderStatusResponse | null
}): boolean {
  if (!params.timesheetsEnabled || !params.reminderEnabled) return false
  if (params.dismissedToday || !params.pastTrigger) return false
  if (!params.status) return false
  if (params.status.weekSubmitted) return false
  if (params.status.todayDaySubmitted) return false
  return true
}
