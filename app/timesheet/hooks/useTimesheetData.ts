'use client'

import { useEffect, useRef, useState } from 'react'
import { getLocalDateString, weekStartKeyFromApi } from '../../lib/utils/dateUtils'
import { apiGet } from '../../lib/api/client'
import {
  FULL_DAY_SLOTS,
  type EntryType,
} from '../lib/constants'
import type { RowData } from '../lib/types'
import {
  hydrateSlotsFromSavedRow,
  hydrateSlotEntryTypesFromSavedRow,
  serializeTimesheet,
  todayIndexForWeek,
} from '../lib/timesheetUtils'

/** List endpoint can return a row without `days` if enrichment failed; fetch by id in that case. */
function submittedTimesheetNeedsFullFetch(ts: any): boolean {
  if (ts == null || !ts.id) return false
  const hasDays = Array.isArray(ts.days) && ts.days.length === 7
  if (!hasDays) return true
  const hasAnyJob = ts.days.some(
    (day: any) =>
      Array.isArray(day) &&
      day.some((row: any) => {
        const j = row?.jobNumber != null ? String(row.jobNumber).trim() : ''
        return j.length > 0 || (Number(row?.totalHours) > 0)
      })
  )
  if (hasAnyJob) return false
  const totalH = Number(ts.summary?.totalHours ?? 0)
  return totalH > 0.001
}

export interface UseTimesheetDataParams {
  weekStart: Date
  userName: string
  overtimeEnabled: boolean
  totalSlots: number
  submittedTimesheets: { [week: string]: any }
  submittedTimesheetsLoaded: boolean
  setActiveDay: (day: number) => void
  currentUserId: string | null
}

export function useTimesheetData({
  weekStart,
  userName,
  overtimeEnabled,
  totalSlots,
  submittedTimesheets,
  submittedTimesheetsLoaded,
  setActiveDay,
  currentUserId,
}: UseTimesheetDataParams) {
  const [rowsByDay, setRowsByDay] = useState<Array<Array<RowData>>>(() =>
    Array.from({ length: 7 }, () => [])
  )
  const [dayNotes, setDayNotes] = useState<string[]>(() => Array(7).fill(''))
  const [submittedWeek, setSubmittedWeek] = useState<string | null>(null)

  const nextRowId = useRef(0)
  const justSubmittedRef = useRef(false)
  const submittedTimesheetsRef = useRef(submittedTimesheets)

  function createEmptyRow(total: number, id: number): RowData {
    return {
      id: `row-${id}`,
      jobNumber: '',
      slots: Array.from({ length: total }, () => false),
      slotEntryTypes: Array.from({ length: total }, () => ''),
      totalHours: 0,
      overtimeHours: 0,
    }
  }

  function updateRow(
    dayIndex: number,
    rowId: string,
    updater: (row: any) => any
  ) {
    setRowsByDay((prev) =>
      prev.map((rows, d) => {
        if (d !== dayIndex) return rows
        return rows.map((r: any) =>
          r.id === rowId ? updater({ ...r }) : r
        )
      })
    )
  }

  function addRow(dayIndex: number) {
    setRowsByDay((prev) =>
      prev.map((rows, d) =>
        d === dayIndex
          ? [...rows, createEmptyRow(totalSlots, nextRowId.current++)]
          : rows
      )
    )
  }

  function removeRow(dayIndex: number, rowId: string) {
    setRowsByDay((prev) =>
      prev.map((rows, d) =>
        d === dayIndex ? rows.filter((r: any) => r.id !== rowId) : rows
      )
    )
  }

  function serialize() {
    return serializeTimesheet(
      rowsByDay,
      dayNotes,
      weekStart,
      userName || 'User',
      overtimeEnabled
    )
  }

  function hydrateFromSavedInComponent(saved: any) {
    try {
      const rows: any[][] = Array.from({ length: 7 }, () => [])
      for (let day = 0; day < 7; day++) {
        const dayRows = Array.isArray(saved?.days?.[day]) ? saved.days[day] : []
        for (const jobData of dayRows) {
          const id = nextRowId.current++
          const slots = hydrateSlotsFromSavedRow(jobData, totalSlots)
          const slotEntryTypes = hydrateSlotEntryTypesFromSavedRow(
            jobData,
            slots,
            totalSlots
          )
          const totalHours = slots.filter(Boolean).length / 4
          const overtimeHours = overtimeEnabled
            ? slotEntryTypes.filter(
                (t): t is EntryType =>
                  t === 'overtime' || t === 'extra-overtime'
              ).length / 4
            : 0
          rows[day].push({
            id: `row-${id}`,
            jobNumber: jobData?.jobNumber || '',
            slots,
            slotEntryTypes,
            totalHours,
            overtimeHours,
          })
        }
        while (rows[day].length < 4) {
          rows[day].push(
            createEmptyRow(totalSlots, nextRowId.current++)
          )
        }
      }
      setRowsByDay(rows)
      const notesSource =
        (saved as any).dayNotes ?? (saved as any).data?.dayNotes
      if (Array.isArray(notesSource)) {
        const normalized = Array.from(
          { length: 7 },
          (_v, i) => (notesSource[i] != null ? String(notesSource[i]) : '')
        )
        setDayNotes(normalized)
      } else {
        setDayNotes(Array(7).fill(''))
      }
    } catch {}
  }

  function loadLocalStorageSnapshot(currentWeek: string): any | null {
    try {
      const key = currentUserId
        ? `timesheet_autosave_${currentUserId}`
        : 'timesheet_autosave'
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const saved = JSON.parse(raw)
      const savedWeek = weekStartKeyFromApi(saved?.weekStartDate)
      if (savedWeek === currentWeek) return saved
    } catch {}
    return null
  }

  async function loadAutosavedForWeek() {
    if (
      justSubmittedRef.current &&
      submittedWeek === getLocalDateString(weekStart)
    ) {
      return
    }
    const currentWeek = getLocalDateString(weekStart)
    // A submitted timesheet for this week may have arrived while this async
    // load was in flight; never clobber the grid with an empty / draft state.
    if (submittedTimesheetsRef.current[currentWeek]) {
      return
    }

    let serverDraft: any = null
    try {
      const data = await apiGet<{ timesheet: any }>(`/api/timesheets/draft?week=${currentWeek}`)
      serverDraft = data.timesheet || null
    } catch (error) {
      console.error('Failed to load autosaved data:', error)
    }

    if (submittedTimesheetsRef.current[currentWeek]) {
      return
    }

    const localSnapshot = loadLocalStorageSnapshot(currentWeek)

    if (serverDraft && localSnapshot) {
      const serverDate = serverDraft.submissionDate ? new Date(serverDraft.submissionDate).getTime() : 0
      const localDate = localSnapshot.submissionDate ? new Date(localSnapshot.submissionDate).getTime() : 0
      if (submittedTimesheetsRef.current[currentWeek]) return
      hydrateFromSavedInComponent(localDate > serverDate ? localSnapshot : serverDraft)
      return
    }

    if (serverDraft) {
      if (submittedTimesheetsRef.current[currentWeek]) return
      hydrateFromSavedInComponent(serverDraft)
      return
    }

    if (localSnapshot) {
      if (submittedTimesheetsRef.current[currentWeek]) return
      hydrateFromSavedInComponent(localSnapshot)
      return
    }

    if (submittedTimesheetsRef.current[currentWeek]) {
      return
    }

    setRowsByDay(
      Array.from({ length: 7 }, () =>
        Array.from(
          { length: 4 },
          () => createEmptyRow(totalSlots, nextRowId.current++)
        )
      )
    )
    setDayNotes(Array(7).fill(''))
  }

  useEffect(() => { submittedTimesheetsRef.current = submittedTimesheets }, [submittedTimesheets])

  // When week or submitted list changes: load draft override, submitted data, or autosaved
  useEffect(() => {
    if (!submittedTimesheetsLoaded) return

    const currentWeek = getLocalDateString(weekStart)
    if (
      justSubmittedRef.current &&
      submittedWeek === currentWeek
    ) {
      justSubmittedRef.current = false
      return
    }

    // No submission for this week — load draft or empty form
    if (!submittedTimesheets[currentWeek]) {
      setSubmittedWeek(null)
      loadAutosavedForWeek()
      return
    }

    // Submitted record exists — check for a draft with post-submission edits
    let cancelled = false
    ;(async () => {
      try {
        const draftRes = await apiGet<{ timesheet: any }>(`/api/timesheets/draft?week=${currentWeek}`)
        if (!cancelled && draftRes.timesheet) {
          setSubmittedWeek(currentWeek)
          hydrateFromSavedInComponent(draftRes.timesheet)
          return
        }
      } catch {}
      if (cancelled) return

      // No draft override — load from submitted data
      if (submittedWeek !== currentWeek) setSubmittedWeek(currentWeek)
      let timesheet = submittedTimesheets[currentWeek]
      if (timesheet && submittedTimesheetNeedsFullFetch(timesheet)) {
        try {
          const id = String(timesheet.id)
          const res = await apiGet<{ timesheet: any }>(`/api/timesheets/${encodeURIComponent(id)}`)
          if (res?.timesheet) {
            timesheet = res.timesheet
          }
        } catch {
          /* use list row if full fetch fails */
        }
      }
      if (cancelled) return
      if (timesheet) hydrateFromSavedInComponent(timesheet)
    })()

    return () => { cancelled = true }
  }, [
    weekStart,
    submittedTimesheets,
    submittedTimesheetsLoaded,
    totalSlots,
    overtimeEnabled,
  ])

  // Ensure at least 4 rows per day after data is loaded
  useEffect(() => {
    if (!submittedTimesheetsLoaded) return
    if (
      justSubmittedRef.current &&
      submittedWeek === getLocalDateString(weekStart)
    ) {
      return
    }
    setRowsByDay((prev) => {
      let changed = false
      const newRowsByDay = prev.map((dayRows) => {
        if (dayRows.length < 4) {
          changed = true
          const needed = 4 - dayRows.length
          const newRows = Array.from({ length: needed }, () =>
            createEmptyRow(totalSlots, nextRowId.current++)
          )
          return [...dayRows, ...newRows]
        }
        return dayRows
      })
      return changed ? newRowsByDay : prev
    })
    setActiveDay(todayIndexForWeek(weekStart))
  }, [totalSlots, weekStart, submittedTimesheetsLoaded, setActiveDay, submittedWeek])

  // Early draft prefetch when currentUserId becomes available.
  // Only hydrates if the draft matches the current week AND no submitted timesheet
  // exists for that week (the main effect above is the canonical loader).
  // localStorage fallback is intentionally omitted here — it caused a race condition
  // where stale autosave data would overwrite correctly-loaded submitted timesheets.
  useEffect(() => {
    let cancelled = false
    const currentWeek = getLocalDateString(weekStart)
    ;(async () => {
      try {
        const data = await apiGet<{ timesheet: any }>('/api/timesheets/draft')
        if (cancelled) return
        if (submittedTimesheetsRef.current[currentWeek]) return
        if (data.timesheet) {
          const autosavedWeek = weekStartKeyFromApi(data.timesheet.weekStartDate)
          if (autosavedWeek === currentWeek) {
            hydrateFromSavedInComponent(data.timesheet)
          }
        }
      } catch {}
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId])

  /** Reset the form to 4 empty rows per day — call after a week has been cleared. */
  function resetWeek() {
    setRowsByDay(
      Array.from({ length: 7 }, () =>
        Array.from({ length: 4 }, () =>
          createEmptyRow(totalSlots, nextRowId.current++)
        )
      )
    )
    setDayNotes(Array(7).fill(''))
  }

  return {
    rowsByDay,
    setRowsByDay,
    dayNotes,
    setDayNotes,
    submittedWeek,
    setSubmittedWeek,
    createEmptyRow,
    updateRow,
    addRow,
    removeRow,
    serialize,
    loadAutosavedForWeek,
    hydrateFromSavedInComponent,
    justSubmittedRef,
    nextRowId,
    resetWeek,
  }
}
