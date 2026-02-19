/**
 * Date utility functions
 */

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function getDaysInMonth(date: Date): number {
  const year = date.getFullYear()
  const month = date.getMonth()
  return new Date(year, month + 1, 0).getDate()
}

export function getDateForDay(monthStart: Date, dayIndex: number): Date {
  const date = new Date(monthStart)
  date.setDate(monthStart.getDate() + dayIndex)
  return date
}

export function getLocalDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parse a YYYY-MM-DD date string as a local date (not UTC)
 * This prevents timezone shifts when parsing date-only strings
 */
export function parseLocalDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  // Create date in local timezone (month is 0-indexed in Date constructor)
  // Explicitly set hours to 0 to ensure we're at midnight local time
  const date = new Date(year, month - 1, day, 0, 0, 0, 0)
  return date
}

/**
 * Normalize a date to midnight in local timezone
 */
export function normalizeToMidnight(date: Date): Date {
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)
  return normalized
}

/**
 * Calculate the day index (days since monthStart) for a given date
 * This uses date component arithmetic to avoid timezone/DST issues
 */
export function getDayIndex(date: Date, monthStart: Date): number {
  // Parse dates if they're strings, otherwise use as-is
  const dateObj = typeof date === 'string' ? parseLocalDateString(date) : normalizeToMidnight(new Date(date))
  const monthStartObj = normalizeToMidnight(new Date(monthStart))
  
  // Get date components
  const dateYear = dateObj.getFullYear()
  const dateMonth = dateObj.getMonth()
  const dateDay = dateObj.getDate()
  
  const startYear = monthStartObj.getFullYear()
  const startMonth = monthStartObj.getMonth()
  const startDay = monthStartObj.getDate()
  
  // Calculate the difference in days using a more reliable method
  // Create two dates at midnight and calculate the difference
  const dateAtMidnight = new Date(dateYear, dateMonth, dateDay, 0, 0, 0, 0)
  const startAtMidnight = new Date(startYear, startMonth, startDay, 0, 0, 0, 0)
  
  // Calculate milliseconds difference
  const msDiff = dateAtMidnight.getTime() - startAtMidnight.getTime()
  
  // Convert to days - since both are at midnight, this should be exact
  // Use Math.round to handle any floating point precision issues
  const days = Math.round(msDiff / (1000 * 60 * 60 * 24))
  
  return days
}

export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export function isMonthStart(date: Date): boolean {
  return date.getDate() === 1
}

export function getMonthName(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function isToday(date: Date): boolean {
  const today = new Date()
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear()
}

/**
 * Get the start of the week (Monday) for a given date
 */
export function startOfWeek(date: Date): Date {
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day // Monday is day 1, Sunday is day 0
  const monday = new Date(date)
  monday.setDate(date.getDate() + diff)
  return normalizeToMidnight(monday)
}



