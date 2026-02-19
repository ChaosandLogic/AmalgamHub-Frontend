/**
 * Pure utilities for timesheet timeline: segments, time labels, summary, hydration.
 */

import { startOfWeek, getLocalDateString, normalizeToMidnight } from '../lib/utils/dateUtils'
import { base64ToSlots, slotsToBase64 } from './slotBitmap'
import { FULL_DAY_SLOTS, LEGACY_OFFSET, LEGACY_SLOTS, type EntryType } from './constants'

// --- Time / slot helpers ---

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  const minuteStr = String(minute).padStart(2, '0')
  return `${displayHour}:${minuteStr}${period}`
}

export function slotLabel(startHour: number, quarterIndex: number): string {
  const totalMinutes = startHour * 60 + quarterIndex * 15
  const hour24 = Math.floor(totalMinutes / 60) % 24
  const minute = totalMinutes % 60
  return formatTime(hour24, minute)
}

/** Full-day slot index (0–95) to time string (12am–11:45pm). */
export function slotLabelFullDay(slotIndex: number): string {
  const hour24 = Math.floor(slotIndex / 4) % 24
  const minute = (slotIndex % 4) * 15
  return formatTime(hour24, minute)
}

/** "HH:MM" (24-hour) string to formatted time string. */
export function formatTimeFromString(timeStr: string): string {
  if (!timeStr) return ''
  const [hour, minute] = timeStr.split(':').map(Number)
  return formatTime(hour ?? 0, minute ?? 0)
}

export function formatDateInput(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

// --- Segment helpers ---

export interface Segment {
  start: number
  end: number
}

export function getSegments(slots: boolean[]): Segment[] {
  const segs: Segment[] = []
  let i = 0
  while (i < slots.length) {
    if (slots[i]) {
      let j = i
      while (j + 1 < slots.length && slots[j + 1]) j++
      segs.push({ start: i, end: j })
      i = j + 1
    } else {
      i++
    }
  }
  return segs
}

export function getSegmentAt(slots: boolean[], idx: number): Segment | undefined {
  const segs = getSegments(slots)
  return segs.find((s) => idx >= s.start && idx <= s.end)
}

export function getSegmentNearEdge(slots: boolean[], idx: number): Segment | undefined {
  const segs = getSegments(slots)
  const near = 1
  return segs.find((s) => Math.abs(idx - s.start) <= near || Math.abs(idx - s.end) <= near)
}

// --- Date / week helpers ---

export function todayIndexForWeek(weekStart: Date): number {
  const monday = startOfWeek(weekStart)
  const today = normalizeToMidnight(new Date())
  const mondayNormalized = normalizeToMidnight(monday)
  const diffDays = Math.floor((today.getTime() - mondayNormalized.getTime()) / 86400000)
  if (diffDays < 0 || diffDays > 6) return 0
  return diffDays
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

export function formatDayLabel(weekStart: Date, index: number): string {
  const dt = addDays(startOfWeek(weekStart), index)
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// --- Summary & overlaps ---

export function computeWeeklySummary(rowsByDay: any[][], overtimeEnabled?: boolean) {
  const byJob = new Map<string, any>()
  const dayTotals = Array(7).fill(0)
  let totalHours = 0
  let totalOvertimeHours = 0

  for (let day = 0; day < 7; day++) {
    const rows = rowsByDay[day] || []
    for (const r of rows) {
      const jobNumber = `${r.jobPrefix || ''}${r.jobNumber || ''}`.trim()
      const hours = (r.slots?.filter(Boolean).length || 0) * 0.25
      const overtime = r.overtimeHours || 0

      if (!jobNumber) continue

      if (!byJob.has(jobNumber)) {
        byJob.set(jobNumber, {
          days: Array(7).fill(0),
          overtimeDays: Array(7).fill(0),
          total: 0,
          overtimeTotal: 0,
        })
      }

      const entry = byJob.get(jobNumber)!
      entry.days[day] += hours
      entry.overtimeDays[day] += overtime
      entry.total += hours
      entry.overtimeTotal += overtime
      entry.standardTotal = entry.total - entry.overtimeTotal

      dayTotals[day] += hours
      totalHours += hours
      if (overtimeEnabled) {
        totalOvertimeHours += overtime
      }
    }
  }

  const standardHours = overtimeEnabled ? Math.max(0, totalHours - totalOvertimeHours) : totalHours

  return {
    byJob,
    dayTotals,
    totalHours,
    standardHours,
    overtimeHours: totalOvertimeHours,
    overtimeEnabled,
  }
}

export function computeOverlaps(rows: any[], totalSlots: number): boolean[] {
  const counts = Array(totalSlots).fill(0)
  for (const r of rows) {
    for (let i = 0; i < totalSlots; i++) if (r.slots[i]) counts[i]++
  }
  return counts.map((c: number) => c > 1)
}

/** Last 5 job numbers used this week (by order in summary), with optional title from projects. */
export function lastUsedJobsFromSummary(
  summary: any,
  projects: any[]
): Array<{ jobNumber: string; title: string }> {
  if (!summary?.byJob?.size) return []
  const keys = Array.from(summary.byJob.keys()) as string[]
  const lastFive = keys.slice(-5)
  return lastFive.map((jobNumber: string) => {
    const project = projects?.find(
      (p: any) =>
        (p.code && String(p.code) === String(jobNumber)) ||
        (p.name && String(p.name) === String(jobNumber))
    )
    const title = project?.name ?? jobNumber
    return { jobNumber, title }
  })
}

// --- Hydration (saved / submitted data → row data) ---

export function hydrateSlotsFromSavedRow(savedRow: any, totalSlots: number): boolean[] {
  if (savedRow?.s != null && typeof savedRow.s === 'string' && savedRow.s.length > 0) {
    if (savedRow.slotCount === FULL_DAY_SLOTS) {
      return base64ToSlots(savedRow.s, FULL_DAY_SLOTS)
    }
    const legacy = base64ToSlots(savedRow.s, LEGACY_SLOTS)
    const slots = Array(FULL_DAY_SLOTS).fill(false)
    for (let i = 0; i < LEGACY_SLOTS; i++) slots[LEGACY_OFFSET + i] = legacy[i]
    return slots
  }
  const slots = Array(FULL_DAY_SLOTS).fill(false)
  const arr = Array.isArray(savedRow?.timeSlots) ? savedRow.timeSlots : []
  const useLegacy = savedRow?.slotCount !== FULL_DAY_SLOTS
  for (const s of arr) {
    if (typeof s === 'object') {
      const idx = (s as any).timeIndex | 0
      const target = useLegacy && idx < LEGACY_SLOTS ? LEGACY_OFFSET + idx : idx
      if (target >= 0 && target < FULL_DAY_SLOTS && (s as any).filled) slots[target] = true
    }
  }
  return slots
}

export function hydrateSlotEntryTypesFromSavedRow(
  savedRow: any,
  slots: boolean[],
  totalSlots: number
): ('' | EntryType)[] {
  const out: ('' | EntryType)[] = Array.from({ length: FULL_DAY_SLOTS }, () => '')
  const raw = savedRow?.slotEntryTypes
  const isLegacyTypes = Array.isArray(raw) && raw.length === LEGACY_SLOTS
  if (Array.isArray(raw) && raw.length > 0) {
    for (let i = 0; i < raw.length; i++) {
      const target = isLegacyTypes ? LEGACY_OFFSET + i : i
      if (
        target >= 0 &&
        target < FULL_DAY_SLOTS &&
        slots[target] &&
        (raw[i] === 'standard' || raw[i] === 'overtime' || raw[i] === 'extra-overtime')
      ) {
        out[target] = raw[i] as EntryType
      } else if (target >= 0 && target < FULL_DAY_SLOTS && slots[target]) {
        out[target] = 'standard'
      }
    }
  } else {
    for (let i = 0; i < FULL_DAY_SLOTS; i++) {
      if (slots[i]) out[i] = 'standard'
    }
  }
  return out
}

// --- Serialization (row data → API payload) ---

export function serializeTimesheet(
  rowsByDay: any[][],
  dayNotes: string[],
  weekStart: Date,
  userName: string,
  overtimeEnabled: boolean
): {
  name: string
  weekStartDate: string
  days: any[]
  dayNotes: string[]
  summary: any
  submissionDate: string
} {
  const summary: any = { jobs: {}, totalHours: 0, standardHours: 0, overtimeHours: 0 }
  const days = rowsByDay.map((rows) => {
    return rows.map((r: any) => {
      const jobNumber = r.jobNumber || ''
      const totalHours = r.slots.filter(Boolean).length * 0.25
      const types = r.slotEntryTypes || Array(r.slots.length).fill('')
      const overtimeSlots = types.filter((t: string) => t === 'overtime' || t === 'extra-overtime').length
      const overtimeHours = overtimeEnabled ? overtimeSlots * 0.25 : 0

      if (jobNumber) {
        if (!summary.jobs[jobNumber]) {
          summary.jobs[jobNumber] = { totalHours: 0, overtimeHours: 0, standardHours: 0 }
        }
        summary.jobs[jobNumber].totalHours += totalHours
        summary.jobs[jobNumber].overtimeHours += overtimeHours
        summary.jobs[jobNumber].standardHours += Math.max(0, totalHours - overtimeHours)
        summary.totalHours += totalHours
      }

      return {
        jobNumber,
        s: slotsToBase64(r.slots, FULL_DAY_SLOTS),
        slotCount: FULL_DAY_SLOTS,
        slotEntryTypes: r.slotEntryTypes?.length === r.slots.length ? r.slotEntryTypes : undefined,
        totalHours,
        overtimeHours: overtimeEnabled ? overtimeHours : undefined,
      }
    })
  })

  if (overtimeEnabled) {
    summary.overtimeHours = Object.values(summary.jobs).reduce(
      (sum: number, job: any) => sum + (job.overtimeHours || 0),
      0
    )
    summary.overtimeHours = Math.min(summary.overtimeHours, summary.totalHours)
    summary.standardHours = Math.max(0, summary.totalHours - summary.overtimeHours)
  } else {
    summary.overtimeHours = 0
    summary.standardHours = summary.totalHours
    Object.keys(summary.jobs).forEach((jobNumber) => {
      if (summary.jobs[jobNumber]) {
        summary.jobs[jobNumber].overtimeHours = 0
        summary.jobs[jobNumber].standardHours = summary.jobs[jobNumber].totalHours
      }
    })
  }

  const calculatedTotal = summary.standardHours + summary.overtimeHours
  if (Math.abs(calculatedTotal - summary.totalHours) > 0.01) {
    summary.standardHours = Math.max(0, summary.totalHours - summary.overtimeHours)
  }

  return {
    name: userName || 'User',
    weekStartDate: weekStart.toISOString(),
    days,
    dayNotes,
    summary,
    submissionDate: new Date().toISOString(),
  }
}
