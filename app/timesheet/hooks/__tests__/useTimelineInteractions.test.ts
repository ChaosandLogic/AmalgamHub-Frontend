import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTimelineInteractions } from '../useTimelineInteractions'

const mockSerialize = vi.fn()
const mockApiPut = vi.fn()
const mockApiPost = vi.fn()
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}

vi.mock('../../../lib/api/client', () => ({
  apiPut: (...args: unknown[]) => mockApiPut(...args),
  apiPost: (...args: unknown[]) => mockApiPost(...args),
}))

function draftPayload(jobNumber = 'JOB1') {
  return {
    name: 'Test User',
    weekStartDate: '2025-04-21',
    submissionDate: new Date().toISOString(),
    days: Array.from({ length: 7 }, () => []),
    dayNotes: Array(7).fill(''),
    summary: { totalHours: 1, standardHours: 1, overtimeHours: 0, jobs: { [jobNumber]: { totalHours: 1 } } },
  }
}

function defaultParams(overrides: Partial<Parameters<typeof useTimelineInteractions>[0]> = {}) {
  return {
    rowsByDay: Array.from({ length: 7 }, () => []),
    updateRow: vi.fn(),
    totalSlots: 96,
    overtimeEnabled: false,
    weekStart: new Date(2025, 3, 21),
    serialize: mockSerialize,
    currentUserId: 'user-1',
    setSubmittedWeek: vi.fn(),
    setSubmittedTimesheets: vi.fn(),
    justSubmittedRef: { current: false },
    toast: mockToast,
    getLocalDateString: (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    setWeekStart: vi.fn(),
    editUserId: null,
    ...overrides,
  }
}

describe('useTimelineInteractions — draft autosave before submission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockSerialize.mockReturnValue(draftPayload())
    mockApiPut.mockResolvedValue({})
    mockApiPost.mockResolvedValue({ timesheet: { id: 'ts-1' } })
  })

  it('autoSave writes draft to localStorage and PUT /api/timesheets/draft', async () => {
    const { result } = renderHook(() => useTimelineInteractions(defaultParams()))

    await act(async () => {
      result.current.autoSave()
    })

    const stored = localStorage.getItem('timesheet_autosave_user-1')
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.weekStartDate).toBe('2025-04-21')
    expect(parsed.summary.totalHours).toBe(1)

    expect(mockApiPut).toHaveBeenCalledWith('/api/timesheets/draft', expect.objectContaining({
      weekStartDate: '2025-04-21',
    }))
    expect(mockApiPost).not.toHaveBeenCalled()
  })

  it('autoSave uses generic localStorage key when no user id', async () => {
    const { result } = renderHook(() =>
      useTimelineInteractions(defaultParams({ currentUserId: null }))
    )

    await act(async () => {
      result.current.autoSave()
    })

    expect(localStorage.getItem('timesheet_autosave')).not.toBeNull()
    expect(localStorage.getItem('timesheet_autosave_user-1')).toBeNull()
  })

  it('autoSave skips localStorage when editing another user but still saves draft to server', async () => {
    const { result } = renderHook(() =>
      useTimelineInteractions(defaultParams({ editUserId: 'other-user' }))
    )

    await act(async () => {
      result.current.autoSave()
    })

    expect(localStorage.getItem('timesheet_autosave_user-1')).toBeNull()
    expect(mockApiPut).toHaveBeenCalledWith(
      '/api/timesheets/draft',
      expect.objectContaining({ userId: 'other-user' })
    )
  })

  it('autoSave does not persist while a drag is in progress', async () => {
    const { result } = renderHook(() => useTimelineInteractions(defaultParams()))

    act(() => {
      result.current.isDraggingRef.current = true
    })

    await act(async () => {
      result.current.autoSave()
    })

    expect(localStorage.getItem('timesheet_autosave_user-1')).toBeNull()
    expect(mockApiPut).not.toHaveBeenCalled()
  })

  it('deleteSegment triggers autoSave so removals persist as draft', async () => {
    const updateRow = vi.fn()
    const { result } = renderHook(() =>
      useTimelineInteractions(defaultParams({ updateRow }))
    )

    await act(async () => {
      result.current.deleteSegment(0, 'row-0', 0, 3)
    })

    expect(updateRow).toHaveBeenCalled()
    expect(mockApiPut).toHaveBeenCalledWith('/api/timesheets/draft', expect.any(Object))
  })

  it('confirmSubmit posts to /api/timesheets without replacing draft autosave path', async () => {
    const setSubmittedWeek = vi.fn()
    const setSubmittedTimesheets = vi.fn()
    const justSubmittedRef = { current: false }

    const { result } = renderHook(() =>
      useTimelineInteractions(
        defaultParams({ setSubmittedWeek, setSubmittedTimesheets, justSubmittedRef })
      )
    )

    await act(async () => {
      await result.current.confirmSubmit()
    })

    expect(mockApiPost).toHaveBeenCalledWith('/api/timesheets', expect.objectContaining({
      weekStartDate: '2025-04-21',
    }))
    expect(mockApiPut).not.toHaveBeenCalled()
    expect(setSubmittedWeek).toHaveBeenCalledWith('2025-04-21')
    expect(justSubmittedRef.current).toBe(true)
  })

  it('shows local-only warning when server autosave fails', async () => {
    mockApiPut.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useTimelineInteractions(defaultParams()))

    await act(async () => {
      result.current.autoSave()
    })

    expect(localStorage.getItem('timesheet_autosave_user-1')).not.toBeNull()
    expect(mockToast.error).toHaveBeenCalledWith(
      'Autosave failed — changes are saved locally only.'
    )
  })
})
