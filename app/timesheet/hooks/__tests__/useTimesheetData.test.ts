import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FULL_DAY_SLOTS } from '../../lib/constants'
import { slotsToBase64 } from '../../lib/slotBitmap'
import { useTimesheetData } from '../useTimesheetData'

const mockApiGet = vi.fn()
const mockSetActiveDay = vi.fn()

vi.mock('../../../lib/api/client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
}))

function defaultParams(overrides: Partial<Parameters<typeof useTimesheetData>[0]> = {}) {
  return {
    weekStart: new Date(2025, 3, 21),
    userName: 'Test User',
    overtimeEnabled: false,
    totalSlots: FULL_DAY_SLOTS,
    submittedTimesheets: {},
    submittedTimesheetsLoaded: true,
    setActiveDay: mockSetActiveDay,
    currentUserId: 'user-1',
    ...overrides,
  }
}

function draftPayload(jobNumber: string, submissionDate?: string) {
  const slots = Array(FULL_DAY_SLOTS).fill(false)
  slots[0] = true
  slots[1] = true
  slots[2] = true
  slots[3] = true
  return {
    weekStartDate: '2025-04-21',
    submissionDate: submissionDate ?? new Date().toISOString(),
    days: [
      [{ jobNumber, s: slotsToBase64(slots, FULL_DAY_SLOTS), slotCount: FULL_DAY_SLOTS }],
      [],
      [],
      [],
      [],
      [],
      [],
    ],
    dayNotes: Array(7).fill(''),
  }
}

function storeLocalDraft(userId: string, payload: ReturnType<typeof draftPayload>) {
  localStorage.setItem(`timesheet_autosave_${userId}`, JSON.stringify(payload))
}

describe('useTimesheetData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApiGet.mockResolvedValue({ timesheet: null })
    localStorage.clear()
  })

  it('createEmptyRow produces correct shape with all-false slots', async () => {
    const { result } = renderHook(() => useTimesheetData(defaultParams()))
    await waitFor(() => {
      expect(result.current.rowsByDay[0].length).toBeGreaterThan(0)
    })
    const row = result.current.createEmptyRow(FULL_DAY_SLOTS, 99)
    expect(row.id).toBe('row-99')
    expect(row.jobNumber).toBe('')
    expect(row.slots).toHaveLength(FULL_DAY_SLOTS)
    expect(row.slots.every((s) => s === false)).toBe(true)
    expect(row.totalHours).toBe(0)
  })

  it('addRow adds a row to the specified day', async () => {
    const { result } = renderHook(() => useTimesheetData(defaultParams()))
    await waitFor(() => {
      expect(result.current.rowsByDay[0].length).toBe(4)
    })
    const initialCount = result.current.rowsByDay[1].length
    act(() => {
      result.current.addRow(1)
    })
    expect(result.current.rowsByDay[1].length).toBe(initialCount + 1)
  })

  it('removeRow removes a row from the specified day', async () => {
    const { result } = renderHook(() => useTimesheetData(defaultParams()))
    await waitFor(() => {
      expect(result.current.rowsByDay[0].length).toBe(4)
    })
    const rowId = result.current.rowsByDay[0][0].id
    act(() => {
      result.current.removeRow(0, rowId)
    })
    await waitFor(() => {
      expect(result.current.rowsByDay[0].find((r) => r.id === rowId)).toBeUndefined()
    })
    expect(result.current.rowsByDay[0].length).toBe(4)
  })

  it('serialize returns payload with correct weekStartDate and name', async () => {
    const { result } = renderHook(() => useTimesheetData(defaultParams()))
    await waitFor(() => {
      expect(result.current.rowsByDay[0].length).toBe(4)
    })
    act(() => {
      result.current.hydrateFromSavedInComponent(draftPayload('JOB1'))
    })
    const payload = result.current.serialize()
    expect(payload.name).toBe('Test User')
    expect(payload.weekStartDate).toBe('2025-04-21')
    expect(payload.summary.totalHours).toBe(1)
  })

  it('resetWeek sets 4 empty rows per day and clears notes', async () => {
    const { result } = renderHook(() => useTimesheetData(defaultParams()))
    await waitFor(() => {
      expect(result.current.rowsByDay[0].length).toBe(4)
    })
    act(() => {
      result.current.setDayNotes(['note0', '', '', '', '', '', ''])
      result.current.updateRow(0, result.current.rowsByDay[0][0].id, (row) => {
        row.jobNumber = 'JOB1'
        row.slots[0] = true
        return row
      })
    })
    act(() => {
      result.current.resetWeek()
    })
    expect(result.current.rowsByDay.every((day) => day.length === 4)).toBe(true)
    expect(result.current.rowsByDay[0][0].jobNumber).toBe('')
    expect(result.current.rowsByDay[0][0].slots.every((s) => !s)).toBe(true)
    expect(result.current.dayNotes).toEqual(Array(7).fill(''))
  })
})

describe('useTimesheetData — draft persistence before submission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('restores unsaved entries from server draft on load', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/api/timesheets/draft')) {
        return Promise.resolve({ timesheet: draftPayload('DRAFT-JOB') })
      }
      return Promise.resolve({ timesheet: null })
    })

    const { result } = renderHook(() => useTimesheetData(defaultParams()))

    await waitFor(() => {
      expect(result.current.rowsByDay[0][0].jobNumber).toBe('DRAFT-JOB')
    })
    expect(result.current.submittedWeek).toBeNull()
  })

  it('restores draft from localStorage when server has no draft', async () => {
    storeLocalDraft('user-1', draftPayload('LOCAL-JOB'))
    mockApiGet.mockResolvedValue({ timesheet: null })

    const { result } = renderHook(() => useTimesheetData(defaultParams()))

    await waitFor(() => {
      expect(result.current.rowsByDay[0][0].jobNumber).toBe('LOCAL-JOB')
    })
  })

  it('prefers newer localStorage draft over older server draft', async () => {
    const older = draftPayload('SERVER-JOB', '2025-04-20T10:00:00.000Z')
    const newer = draftPayload('LOCAL-JOB', '2025-04-21T12:00:00.000Z')
    storeLocalDraft('user-1', newer)

    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/api/timesheets/draft')) {
        return Promise.resolve({ timesheet: older })
      }
      return Promise.resolve({ timesheet: null })
    })

    const { result } = renderHook(() => useTimesheetData(defaultParams()))

    await waitFor(() => {
      expect(result.current.rowsByDay[0][0].jobNumber).toBe('LOCAL-JOB')
    })
  })

  it('prefers newer server draft over older localStorage draft', async () => {
    const older = draftPayload('LOCAL-JOB', '2025-04-20T10:00:00.000Z')
    const newer = draftPayload('SERVER-JOB', '2025-04-21T12:00:00.000Z')
    storeLocalDraft('user-1', older)

    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/api/timesheets/draft')) {
        return Promise.resolve({ timesheet: newer })
      }
      return Promise.resolve({ timesheet: null })
    })

    const { result } = renderHook(() => useTimesheetData(defaultParams()))

    await waitFor(() => {
      expect(result.current.rowsByDay[0][0].jobNumber).toBe('SERVER-JOB')
    })
  })

  it('ignores localStorage draft for a different week', async () => {
    const otherWeek = draftPayload('OTHER-WEEK')
    otherWeek.weekStartDate = '2025-04-14'
    storeLocalDraft('user-1', otherWeek)
    mockApiGet.mockResolvedValue({ timesheet: null })

    const { result } = renderHook(() => useTimesheetData(defaultParams()))

    await waitFor(() => {
      expect(result.current.rowsByDay[0].length).toBe(4)
    })
    expect(result.current.rowsByDay[0][0].jobNumber).toBe('')
  })

  it('loads post-submission draft edits instead of submitted snapshot', async () => {
    const submitted = draftPayload('SUBMITTED-JOB')
    submitted.id = 'ts-1'
    const postSubmitDraft = draftPayload('EDITED-AFTER-SUBMIT')

    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/api/timesheets/draft')) {
        return Promise.resolve({ timesheet: postSubmitDraft })
      }
      return Promise.resolve({ timesheet: null })
    })

    const { result } = renderHook(() =>
      useTimesheetData(
        defaultParams({
          submittedTimesheets: { '2025-04-21': submitted },
        })
      )
    )

    await waitFor(() => {
      expect(result.current.rowsByDay[0][0].jobNumber).toBe('EDITED-AFTER-SUBMIT')
    })
    expect(result.current.submittedWeek).toBe('2025-04-21')
  })

  it('does not load localStorage when editing another user timesheet', async () => {
    storeLocalDraft('user-1', draftPayload('LOCAL-JOB'))
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('userId=other-user')) {
        return Promise.resolve({ timesheet: draftPayload('OTHER-USER-JOB') })
      }
      return Promise.resolve({ timesheet: null })
    })

    const { result } = renderHook(() =>
      useTimesheetData(
        defaultParams({
          editUserId: 'other-user',
          currentUserId: 'admin-1',
        })
      )
    )

    await waitFor(() => {
      expect(result.current.rowsByDay[0][0].jobNumber).toBe('OTHER-USER-JOB')
    })
  })
})
