'use client'

import { useEffect, useRef, useState } from 'react'
import { getLocalDateString, weekStartKeyFromApi } from '../../lib/utils/dateUtils'
import { apiGet } from '../../lib/api/client'
import { base64ToSlots } from '../lib/slotBitmap'
import {
  FULL_DAY_SLOTS,
  LEGACY_OFFSET,
  LEGACY_SLOTS,
  type EntryType,
} from '../lib/constants'
import type { RowData } from '../lib/types'
import {
  hydrateSlotsFromSavedRow,
  hydrateSlotEntryTypesFromSavedRow,
  serializeTimesheet,
  todayIndexForWeek,
} from '../lib/timesheetUtils'

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

  async function loadAutosavedForWeek() {
    if (
      justSubmittedRef.current &&
      submittedWeek === getLocalDateString(weekStart)
    ) {
      return
    }
    try {
      const data = await apiGet<{ timesheet: any }>('/api/timesheets/draft')
      if (data.timesheet) {
        const autosavedWeek = weekStartKeyFromApi(data.timesheet.weekStartDate)
        const currentWeek = getLocalDateString(weekStart)
        if (autosavedWeek === currentWeek) {
          hydrateFromSavedInComponent(data.timesheet)
          return
        }
      }
    } catch (error) {
      console.error('Failed to load autosaved data:', error)
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

  // When week or submitted list changes: load submitted data or autosaved
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

    if (submittedTimesheets[currentWeek]) {
      if (submittedWeek !== currentWeek) {
        setSubmittedWeek(currentWeek)
      }
      const timesheet = submittedTimesheets[currentWeek]
      if (timesheet) {
        const newRowsByDay: Array<Array<RowData>> = Array.from(
          { length: 7 },
          () => []
        )
        const daysData = timesheet.days || timesheet.data?.days
        // Some API payloads can include summary-only submitted records without day rows.
        // In that case, keep the current UI rows instead of replacing with empty rows.
        if (!Array.isArray(daysData)) {
          return
        }

        daysData?.forEach((dayData: any[], dayIndex: number) => {
          dayData.forEach((job: any) => {
            let slots: boolean[]
            let slotEntryTypes: ('' | EntryType)[]
            if (job.s != null && typeof job.s === 'string') {
              if (job.slotCount === FULL_DAY_SLOTS) {
                slots = base64ToSlots(job.s, FULL_DAY_SLOTS)
                slotEntryTypes = hydrateSlotEntryTypesFromSavedRow(
                  job,
                  slots,
                  FULL_DAY_SLOTS
                )
              } else {
                const legacySlots = base64ToSlots(job.s, LEGACY_SLOTS)
                const legacyTypes = hydrateSlotEntryTypesFromSavedRow(
                  job,
                  legacySlots,
                  LEGACY_SLOTS
                )
                slots = Array(FULL_DAY_SLOTS).fill(false)
                slotEntryTypes = Array(FULL_DAY_SLOTS).fill('')
                for (let i = 0; i < LEGACY_SLOTS; i++) {
                  slots[LEGACY_OFFSET + i] = legacySlots[i]
                  slotEntryTypes[LEGACY_OFFSET + i] = legacyTypes[i]
                }
              }
            } else {
              slots = new Array(FULL_DAY_SLOTS).fill(false)
              slotEntryTypes = new Array(FULL_DAY_SLOTS).fill('')
              const useLegacyOffset = job.slotCount !== FULL_DAY_SLOTS
              job.timeSlots?.forEach((slot: any) => {
                const idx = slot.timeIndex
                const target =
                  useLegacyOffset && idx < LEGACY_SLOTS
                    ? LEGACY_OFFSET + idx
                    : idx
                if (
                  slot.filled &&
                  target >= 0 &&
                  target < FULL_DAY_SLOTS
                ) {
                  slots[target] = true
                  slotEntryTypes[target] =
                    (job.slotEntryTypes?.[idx] as EntryType) || 'standard'
                }
              })
            }
            const totalHours = slots.filter(Boolean).length / 4
            const overtimeHours = overtimeEnabled
              ? slotEntryTypes.filter(
                  (t) => t === 'overtime' || t === 'extra-overtime'
                ).length / 4
              : 0
            const row: RowData = {
              id: `row-${nextRowId.current++}`,
              jobNumber: job.jobNumber || '',
              slots,
              slotEntryTypes,
              totalHours,
              overtimeHours,
            }
            newRowsByDay[dayIndex].push(row)
          })
        })

        newRowsByDay.forEach((dayRows, dayIndex) => {
          while (dayRows.length < 4) {
            dayRows.push(
              createEmptyRow(totalSlots, nextRowId.current++)
            )
          }
        })

        setRowsByDay(newRowsByDay)
        const notesSource =
          (timesheet as any).dayNotes ?? (timesheet as any).data?.dayNotes
        if (Array.isArray(notesSource)) {
          const normalized = Array.from(
            { length: 7 },
            (_v, i) =>
              notesSource[i] != null ? String(notesSource[i]) : ''
          )
          setDayNotes(normalized)
        } else {
          setDayNotes(Array(7).fill(''))
        }
      }
    } else {
      setSubmittedWeek(null)
      loadAutosavedForWeek()
    }
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

  // Load autosaved on mount (or when currentUserId becomes available).
  // IMPORTANT: only apply the draft if its weekStartDate matches the currently-viewed
  // week — otherwise the most recent draft for a *different* week would overwrite
  // the submitted-timesheet data that the main effect already loaded.
  // Uses submittedTimesheetsRef to avoid overwriting submitted data with stale
  // localStorage/draft data when the main effect has already loaded for the week.
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
          return
        }
      } catch {}
      if (currentUserId && !cancelled) {
        if (submittedTimesheetsRef.current[currentWeek]) return
        try {
          const raw = localStorage.getItem(
            `timesheet_autosave_${currentUserId}`
          )
          if (raw) {
            const parsed = JSON.parse(raw)
            const autosavedWeek = weekStartKeyFromApi(parsed.weekStartDate)
            if (autosavedWeek === currentWeek) {
              hydrateFromSavedInComponent(parsed)
            }
          }
        } catch {}
      }
    })()
    return () => {
      cancelled = true
    }
    // hydrateFromSavedInComponent and weekStart are captured at mount; intentionally omitted
    // from deps so this runs only once when currentUserId becomes available.
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
