import { describe, expect, it } from 'vitest'
import { FULL_DAY_SLOTS, LEGACY_OFFSET, LEGACY_SLOTS } from '../constants'
import { slotsToBase64 } from '../slotBitmap'
import {
  addDays,
  clamp,
  computeOverlaps,
  computeWeeklySummary,
  formatDateInput,
  formatTime,
  formatTimeFromString,
  getSegmentAt,
  getSegmentNearEdge,
  getSegments,
  hydrateSlotEntryTypesFromSavedRow,
  hydrateSlotsFromSavedRow,
  lastUsedJobsFromSummary,
  serializeTimesheet,
  slotLabel,
  slotLabelFullDay,
} from '../timesheetUtils'

function makeSlots(filledIndices: number[], total = FULL_DAY_SLOTS): boolean[] {
  const slots = Array(total).fill(false)
  for (const i of filledIndices) slots[i] = true
  return slots
}

function makeRow(
  jobNumber: string,
  filledIndices: number[],
  slotEntryTypes?: ('' | 'standard' | 'overtime' | 'extra-overtime')[]
) {
  const slots = makeSlots(filledIndices)
  const types =
    slotEntryTypes ??
    slots.map((filled) => (filled ? ('standard' as const) : ('' as const)))
  return {
    id: `row-${jobNumber}`,
    jobNumber,
    slots,
    slotEntryTypes: types,
    totalHours: filledIndices.length * 0.25,
    overtimeHours: 0,
  }
}

describe('formatTime', () => {
  it('formats midnight and afternoon times', () => {
    expect(formatTime(0, 0)).toBe('12:00AM')
    expect(formatTime(13, 30)).toBe('1:30PM')
  })
})

describe('slotLabel / slotLabelFullDay', () => {
  it('labels boundary slots correctly', () => {
    expect(slotLabelFullDay(0)).toBe('12:00AM')
    expect(slotLabelFullDay(47)).toBe('11:45AM')
    expect(slotLabelFullDay(95)).toBe('11:45PM')
    expect(slotLabel(7, 0)).toBe('7:00AM')
  })
})

describe('formatTimeFromString', () => {
  it('formats HH:MM strings and handles empty input', () => {
    expect(formatTimeFromString('09:15')).toBe('9:15AM')
    expect(formatTimeFromString('')).toBe('')
  })
})

describe('formatDateInput', () => {
  it('produces YYYY-MM-DD', () => {
    const d = new Date(2025, 3, 21, 15, 30)
    expect(formatDateInput(d)).toBe('2025-04-21')
  })
})

describe('getSegments', () => {
  it('extracts contiguous segments', () => {
    expect(getSegments([false, true, true, false, true])).toEqual([
      { start: 1, end: 2 },
      { start: 4, end: 4 },
    ])
  })

  it('returns empty for all-false and single segment for all-true', () => {
    expect(getSegments([false, false])).toEqual([])
    expect(getSegments([true, true, true])).toEqual([{ start: 0, end: 2 }])
  })
})

describe('getSegmentAt / getSegmentNearEdge', () => {
  const slots = [false, true, true, false, true]

  it('finds segment containing index', () => {
    expect(getSegmentAt(slots, 2)).toEqual({ start: 1, end: 2 })
    expect(getSegmentAt(slots, 0)).toBeUndefined()
  })

  it('finds segment near edge within 1 slot', () => {
    expect(getSegmentNearEdge(slots, 0)).toEqual({ start: 1, end: 2 })
    expect(getSegmentNearEdge(slots, 3)).toEqual({ start: 1, end: 2 })
  })
})

describe('computeWeeklySummary', () => {
  it('returns zero totals for empty week', () => {
    const summary = computeWeeklySummary(Array.from({ length: 7 }, () => []))
    expect(summary.totalHours).toBe(0)
    expect(summary.standardHours).toBe(0)
    expect(summary.overtimeHours).toBe(0)
    expect(summary.byJob.size).toBe(0)
  })

  it('sums single row with 4 slots on day 0 as 1 hour', () => {
    const rowsByDay = Array.from({ length: 7 }, () => [])
    rowsByDay[0] = [makeRow('JOB1', [0, 1, 2, 3])]
    const summary = computeWeeklySummary(rowsByDay)
    expect(summary.totalHours).toBe(1)
    expect(summary.dayTotals[0]).toBe(1)
    expect(summary.byJob.get('JOB1')?.total).toBe(1)
  })

  it('aggregates multiple jobs across days', () => {
    const rowsByDay = Array.from({ length: 7 }, () => [])
    rowsByDay[0] = [makeRow('A', [0, 1])]
    rowsByDay[1] = [makeRow('B', [0, 1, 2, 3])]
    const summary = computeWeeklySummary(rowsByDay)
    expect(summary.totalHours).toBe(1.5)
    expect(summary.byJob.get('A')?.days[0]).toBe(0.5)
    expect(summary.byJob.get('B')?.days[1]).toBe(1)
  })

  it('splits overtime when enabled', () => {
    const rowsByDay = Array.from({ length: 7 }, () => [])
    const types: ('' | 'standard' | 'overtime')[] = Array(FULL_DAY_SLOTS).fill('')
    types[0] = 'standard'
    types[1] = 'standard'
    types[2] = 'overtime'
    types[3] = 'overtime'
    rowsByDay[0] = [makeRow('JOB1', [0, 1, 2, 3], types)]
    const summary = computeWeeklySummary(rowsByDay, true)
    expect(summary.totalHours).toBe(1)
    expect(summary.overtimeHours).toBe(0.5)
    expect(summary.extraOvertimeHours).toBe(0)
    expect(summary.standardHours).toBe(0.5)
  })

  it('keeps overtime+ independent of overtime', () => {
    const rowsByDay = Array.from({ length: 7 }, () => [])
    const types: ('' | 'standard' | 'overtime' | 'extra-overtime')[] = Array(FULL_DAY_SLOTS).fill('')
    types[0] = 'standard'
    types[1] = 'overtime'
    types[2] = 'extra-overtime'
    types[3] = 'extra-overtime'
    rowsByDay[0] = [makeRow('JOB1', [0, 1, 2, 3], types)]
    const summary = computeWeeklySummary(rowsByDay, true)
    expect(summary.totalHours).toBe(1)
    expect(summary.standardHours).toBe(0.25)
    expect(summary.overtimeHours).toBe(0.25)
    expect(summary.extraOvertimeHours).toBe(0.5)
  })

  it('ignores overtime when disabled', () => {
    const rowsByDay = Array.from({ length: 7 }, () => [])
    const types: ('' | 'standard' | 'overtime')[] = Array(FULL_DAY_SLOTS).fill('')
    types[0] = 'overtime'
    types[1] = 'overtime'
    rowsByDay[0] = [makeRow('JOB1', [0, 1], types)]
    const summary = computeWeeklySummary(rowsByDay, false)
    expect(summary.totalHours).toBe(0.5)
    expect(summary.overtimeHours).toBe(0)
    expect(summary.standardHours).toBe(0.5)
  })
})

describe('computeOverlaps', () => {
  it('detects no overlaps for non-overlapping rows', () => {
    const rows = [makeRow('A', [0, 1]), makeRow('B', [2, 3])]
    expect(computeOverlaps(rows, FULL_DAY_SLOTS).some(Boolean)).toBe(false)
  })

  it('detects overlap at shared slot index', () => {
    const rows = [makeRow('A', [0, 1]), makeRow('B', [1, 2])]
    const overlaps = computeOverlaps(rows, FULL_DAY_SLOTS)
    expect(overlaps[1]).toBe(true)
    expect(overlaps[0]).toBe(false)
    expect(overlaps[2]).toBe(false)
  })

  it('never overlaps with a single row', () => {
    const rows = [makeRow('A', [0, 1, 2])]
    expect(computeOverlaps(rows, FULL_DAY_SLOTS).some(Boolean)).toBe(false)
  })
})

describe('hydrateSlotsFromSavedRow', () => {
  it('decodes full-day base64 when slotCount is 96', () => {
    const slots = makeSlots([10, 11])
    const savedRow = {
      s: slotsToBase64(slots, FULL_DAY_SLOTS),
      slotCount: FULL_DAY_SLOTS,
    }
    const hydrated = hydrateSlotsFromSavedRow(savedRow, FULL_DAY_SLOTS)
    expect(hydrated[10]).toBe(true)
    expect(hydrated[11]).toBe(true)
  })

  it('maps legacy base64 into full-day at offset 28', () => {
    const legacy = Array(LEGACY_SLOTS).fill(false)
    legacy[0] = true
    const savedRow = { s: slotsToBase64(legacy, LEGACY_SLOTS) }
    const hydrated = hydrateSlotsFromSavedRow(savedRow, FULL_DAY_SLOTS)
    expect(hydrated[LEGACY_OFFSET]).toBe(true)
    expect(hydrated[0]).toBe(false)
  })

  it('hydrates from legacy timeSlots object array', () => {
    const savedRow = {
      timeSlots: [{ timeIndex: 0, filled: true }, { timeIndex: 2, filled: true }],
    }
    const hydrated = hydrateSlotsFromSavedRow(savedRow, FULL_DAY_SLOTS)
    expect(hydrated[LEGACY_OFFSET]).toBe(true)
    expect(hydrated[LEGACY_OFFSET + 2]).toBe(true)
  })

  it('returns all-false for missing row', () => {
    expect(hydrateSlotsFromSavedRow(null, FULL_DAY_SLOTS)).toEqual(
      Array(FULL_DAY_SLOTS).fill(false)
    )
  })
})

describe('hydrateSlotEntryTypesFromSavedRow', () => {
  it('maps full-day entry types where slots are filled', () => {
    const slots = makeSlots([0, 1])
    const raw = Array(FULL_DAY_SLOTS).fill('')
    raw[0] = 'overtime'
    raw[1] = 'standard'
    const types = hydrateSlotEntryTypesFromSavedRow({ slotEntryTypes: raw }, slots, FULL_DAY_SLOTS)
    expect(types[0]).toBe('overtime')
    expect(types[1]).toBe('standard')
  })

  it('offsets legacy-length entry types by 28', () => {
    const slots = makeSlots([LEGACY_OFFSET])
    const raw = Array(LEGACY_SLOTS).fill('')
    raw[0] = 'overtime'
    const types = hydrateSlotEntryTypesFromSavedRow({ slotEntryTypes: raw }, slots, FULL_DAY_SLOTS)
    expect(types[LEGACY_OFFSET]).toBe('overtime')
  })

  it('defaults filled slots to standard when entry types missing', () => {
    const slots = makeSlots([5, 6])
    const types = hydrateSlotEntryTypesFromSavedRow({}, slots, FULL_DAY_SLOTS)
    expect(types[5]).toBe('standard')
    expect(types[6]).toBe('standard')
    expect(types[0]).toBe('')
  })
})

describe('serializeTimesheet', () => {
  const weekStart = new Date(2025, 3, 21)

  it('produces correct weekStartDate and totalHours', () => {
    const rowsByDay = Array.from({ length: 7 }, () => [])
    rowsByDay[0] = [makeRow('JOB1', [0, 1, 2, 3])]
    const result = serializeTimesheet(rowsByDay, Array(7).fill(''), weekStart, 'Test User', false)
    expect(result.weekStartDate).toBe('2025-04-21')
    expect(result.summary.totalHours).toBe(1)
    expect(result.name).toBe('Test User')
  })

  it('splits overtime when enabled', () => {
    const rowsByDay = Array.from({ length: 7 }, () => [])
    const types: ('' | 'standard' | 'overtime')[] = Array(FULL_DAY_SLOTS).fill('')
    types[0] = 'standard'
    types[1] = 'overtime'
    types[2] = 'overtime'
    types[3] = 'overtime'
    rowsByDay[0] = [makeRow('JOB1', [0, 1, 2, 3], types)]
    const result = serializeTimesheet(rowsByDay, Array(7).fill(''), weekStart, 'User', true)
    expect(result.summary.totalHours).toBe(1)
    expect(result.summary.overtimeHours).toBe(0.75)
    expect(result.summary.extraOvertimeHours).toBe(0)
    expect(result.summary.standardHours).toBe(0.25)
    expect(result.summary.overtimeHours + result.summary.standardHours).toBeCloseTo(1)
  })

  it('keeps overtime+ independent of overtime', () => {
    const rowsByDay = Array.from({ length: 7 }, () => [])
    const types: ('' | 'standard' | 'overtime' | 'extra-overtime')[] = Array(FULL_DAY_SLOTS).fill('')
    types[0] = 'standard'
    types[1] = 'overtime'
    types[2] = 'extra-overtime'
    types[3] = 'extra-overtime'
    rowsByDay[0] = [makeRow('JOB1', [0, 1, 2, 3], types)]
    const result = serializeTimesheet(rowsByDay, Array(7).fill(''), weekStart, 'User', true)
    expect(result.summary.totalHours).toBe(1)
    expect(result.summary.standardHours).toBe(0.25)
    expect(result.summary.overtimeHours).toBe(0.25)
    expect(result.summary.extraOvertimeHours).toBe(0.5)
    expect(result.days[0][0].overtimeHours).toBe(0.25)
    expect(result.days[0][0].extraOvertimeHours).toBe(0.5)
  })

  it('zeros overtime when disabled', () => {
    const rowsByDay = Array.from({ length: 7 }, () => [])
    const types: ('' | 'standard' | 'overtime')[] = Array(FULL_DAY_SLOTS).fill('')
    types[0] = 'overtime'
    types[1] = 'overtime'
    rowsByDay[0] = [makeRow('JOB1', [0, 1], types)]
    const result = serializeTimesheet(rowsByDay, Array(7).fill(''), weekStart, 'User', false)
    expect(result.summary.overtimeHours).toBe(0)
    expect(result.summary.standardHours).toBe(0.5)
  })

  it('includes per-job breakdown in summary.jobs', () => {
    const rowsByDay = Array.from({ length: 7 }, () => [])
    rowsByDay[0] = [makeRow('A', [0, 1]), makeRow('B', [2, 3, 4, 5])]
    const result = serializeTimesheet(rowsByDay, Array(7).fill(''), weekStart, 'User', false)
    expect(result.summary.jobs.A.totalHours).toBe(0.5)
    expect(result.summary.jobs.B.totalHours).toBe(1)
  })
})

describe('clamp', () => {
  it('clamps values within range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(11, 0, 10)).toBe(10)
  })
})

describe('addDays', () => {
  it('wraps across month boundaries', () => {
    const date = new Date(2025, 0, 30)
    const result = addDays(date, 3)
    expect(result.getMonth()).toBe(1)
    expect(result.getDate()).toBe(2)
  })
})

describe('lastUsedJobsFromSummary', () => {
  it('returns last 5 jobs with project title lookup', () => {
    const byJob = new Map<string, { total: number }>()
    ;['J1', 'J2', 'J3', 'J4', 'J5', 'J6'].forEach((k) => byJob.set(k, { total: 1 }))
    const summary = { byJob }
    const projects = [{ code: 'J6', name: 'Project Six' }]
    const result = lastUsedJobsFromSummary(summary, projects)
    expect(result).toHaveLength(5)
    expect(result[4].jobNumber).toBe('J6')
    expect(result[4].title).toBe('Project Six')
    expect(result[0].jobNumber).toBe('J2')
  })

  it('returns empty array when no jobs', () => {
    expect(lastUsedJobsFromSummary({ byJob: new Map() }, [])).toEqual([])
    expect(lastUsedJobsFromSummary(null, [])).toEqual([])
  })
})
