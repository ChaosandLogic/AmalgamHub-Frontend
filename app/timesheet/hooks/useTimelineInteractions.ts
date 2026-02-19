'use client'

import { useEffect, useRef, useState } from 'react'
import { DAYS } from '../constants'
import type { EntryType } from '../constants'
import {
  clamp,
  formatTime,
  getSegments,
  getSegmentAt,
} from '../timesheetUtils'

export type SelectedSegment = {
  dayIndex: number
  rowId: string
  start: number
  end: number
} | null

export interface UseTimelineInteractionsParams {
  rowsByDay: Array<Array<any>>
  updateRow: (
    dayIndex: number,
    rowId: string,
    updater: (row: any) => any
  ) => void
  totalSlots: number
  overtimeEnabled: boolean
  weekStart: Date
  serialize: () => any
  currentUserId: string | null
  setSubmittedWeek: (v: string | null) => void
  setSubmittedTimesheets: React.Dispatch<
    React.SetStateAction<{ [week: string]: any }>
  >
  justSubmittedRef: React.MutableRefObject<boolean>
  toast: { success: (msg: string) => void; error: (msg: string) => void; info: (msg: string) => void }
  getLocalDateString: (d: Date) => string
  setWeekStart: (d: Date) => void
}

export function useTimelineInteractions({
  rowsByDay,
  updateRow,
  totalSlots,
  overtimeEnabled,
  weekStart,
  serialize,
  currentUserId,
  setSubmittedWeek,
  setSubmittedTimesheets,
  justSubmittedRef,
  toast,
  getLocalDateString,
  setWeekStart,
}: UseTimelineInteractionsParams) {
  const [selectedSegment, setSelectedSegment] =
    useState<SelectedSegment>(null)
  const [entryTypePopup, setEntryTypePopup] = useState<SelectedSegment>(
    null
  )
  const [entryTypeConfirm, setEntryTypeConfirm] =
    useState<EntryType | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showOverlapWarning, setShowOverlapWarning] = useState(false)
  const [overlapDetails, setOverlapDetails] = useState<any[]>([])

  const draggingRef = useRef<any>(null)
  const isDraggingRef = useRef(false)

  function trackId(dayIndex: number, rowId: string) {
    return `track-${dayIndex}-${rowId}`
  }

  async function post(path: string, body: any) {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    })
    if (!r.ok) throw new Error('Request failed')
    return r.json().catch(() => ({}))
  }

  function autoSave() {
    if (isDraggingRef.current) return
    const payload = serialize()
    try {
      if (currentUserId) {
        localStorage.setItem(
          `timesheet_autosave_${currentUserId}`,
          JSON.stringify(payload)
        )
      } else {
        localStorage.setItem('timesheet_autosave', JSON.stringify(payload))
      }
    } catch {}
    post('/api/autosave', payload).catch(() => {})
  }

  function onMouseDownCell(
    dayIndex: number,
    row: any,
    slotIndex: number,
    e: any
  ) {
    e.preventDefault()
    isDraggingRef.current = true
    const originalSlots = [...row.slots]
    const seg = getSegmentAt(originalSlots, slotIndex)
    const nearThreshold = 1

    if (seg) {
      if (Math.abs(slotIndex - seg.start) <= nearThreshold) {
        draggingRef.current = {
          dayIndex,
          rowId: row.id,
          type: 'resize',
          side: 'left',
          segmentStart: seg.start,
          segmentEnd: seg.end,
          anchor: seg.end,
          endSlot: slotIndex,
          originalSlots,
        }
        return
      }
      if (Math.abs(slotIndex - seg.end) <= nearThreshold) {
        draggingRef.current = {
          dayIndex,
          rowId: row.id,
          type: 'resize',
          side: 'right',
          segmentStart: seg.start,
          segmentEnd: seg.end,
          anchor: seg.start,
          endSlot: slotIndex,
          originalSlots,
        }
        return
      }
      draggingRef.current = {
        dayIndex,
        rowId: row.id,
        type: 'move',
        segmentStart: seg.start,
        segmentEnd: seg.end,
        offset: slotIndex - seg.start,
        originalSlots,
      }
      return
    } else {
      draggingRef.current = {
        dayIndex,
        rowId: row.id,
        type: 'range',
        startSlot: slotIndex,
        endSlot: slotIndex,
        filling: true,
        originalSlots,
      }
      applyDrag()
    }
  }

  function onMouseDownHandle(
    dayIndex: number,
    row: any,
    slotIndex: number,
    handle: 'left' | 'right'
  ) {
    const originalSlots = [...row.slots]
    const segs = getSegments(originalSlots)
    let targetSeg: { start: number; end: number } | null = null
    for (const seg of segs) {
      if (
        handle === 'left' &&
        slotIndex >= seg.start &&
        slotIndex <= seg.start + 1
      ) {
        targetSeg = seg
        break
      }
      if (
        handle === 'right' &&
        slotIndex >= seg.end - 1 &&
        slotIndex <= seg.end
      ) {
        targetSeg = seg
        break
      }
    }
    if (!targetSeg) return
    const anchor = handle === 'left' ? targetSeg.end : targetSeg.start
    draggingRef.current = {
      dayIndex,
      rowId: row.id,
      type: 'resize',
      side: handle,
      segmentStart: targetSeg.start,
      segmentEnd: targetSeg.end,
      anchor,
      endSlot: slotIndex,
      originalSlots,
    }
    isDraggingRef.current = true
  }

  function onMouseMove(e: MouseEvent) {
    if (!draggingRef.current) return
    const { dayIndex, rowId } = draggingRef.current
    const track = document.getElementById(trackId(dayIndex, rowId))
    if (!track) return
    const rect = track.getBoundingClientRect()
    const relativeX = clamp(e.clientX - rect.left, 0, rect.width)
    const slotWidth = rect.width / totalSlots
    const hoverSlot = clamp(
      Math.floor(relativeX / slotWidth),
      0,
      totalSlots - 1
    )
    draggingRef.current.endSlot = hoverSlot
    applyDrag()
  }

  function onMouseUp() {
    draggingRef.current = null
    if (isDraggingRef.current) {
      isDraggingRef.current = false
      autoSave()
    }
  }

  function applyDrag() {
    const drag = draggingRef.current
    if (!drag) return
    const { dayIndex, rowId, type } = drag
    updateRow(dayIndex, rowId, (row: any) => {
      const base = [...(drag.originalSlots || row.slots)]
      const slots = [...base]
      const len =
        row.slotEntryTypes?.length === slots.length
          ? row.slotEntryTypes.length
          : slots.length
      const slotEntryTypes: ('' | EntryType)[] =
        row.slotEntryTypes?.length === slots.length
          ? [...row.slotEntryTypes]
          : Array.from({ length: len }, (_, i) =>
              slots[i] ? (row.slotEntryTypes?.[i] || 'standard') : ''
            )
      if (slotEntryTypes.length !== slots.length) {
        while (slotEntryTypes.length < slots.length) slotEntryTypes.push('')
        slotEntryTypes.length = slots.length
      }

      if (type === 'range') {
        const start = Math.min(drag.startSlot, drag.endSlot)
        const end = Math.max(drag.startSlot, drag.endSlot)
        for (let i = start; i <= end; i++) {
          slots[i] = true
          slotEntryTypes[i] = slotEntryTypes[i] || 'standard'
        }
      } else if (type === 'resize') {
        const s = Math.min(drag.segmentStart, drag.segmentEnd)
        const e = Math.max(drag.segmentStart, drag.segmentEnd)
        let newStart = s
        let newEnd = e
        if (drag.side === 'left') {
          newStart = Math.min(drag.endSlot, e)
          newEnd = e
        } else if (drag.side === 'right') {
          newStart = s
          newEnd = Math.max(drag.endSlot, s)
        }
        const preservedType = slotEntryTypes[s] || 'standard'
        for (let i = s; i <= e; i++) {
          slots[i] = false
          slotEntryTypes[i] = ''
        }
        for (let i = newStart; i <= newEnd; i++) {
          slots[i] = true
          slotEntryTypes[i] = preservedType
        }
      } else if (type === 'move') {
        const segmentLength = drag.segmentEnd - drag.segmentStart + 1
        const newStart = drag.endSlot - drag.offset
        const newEnd = newStart + segmentLength - 1
        const clampedStart = Math.max(
          0,
          Math.min(newStart, totalSlots - segmentLength)
        )
        const clampedEnd = clampedStart + segmentLength - 1
        const preservedTypes: ('' | EntryType)[] = []
        for (let i = drag.segmentStart; i <= drag.segmentEnd; i++) {
          if (i >= 0 && i < slots.length) {
            preservedTypes.push(slotEntryTypes[i] || 'standard')
            slots[i] = false
            slotEntryTypes[i] = ''
          }
        }
        for (let i = clampedStart; i <= clampedEnd; i++) {
          if (i >= 0 && i < slots.length) {
            slots[i] = true
            slotEntryTypes[i] =
              preservedTypes[i - clampedStart] || 'standard'
          }
        }
      }

      const filled = slots.filter(Boolean).length
      const overtimeCount = slotEntryTypes.filter(
        (t): t is EntryType =>
          t === 'overtime' || t === 'extra-overtime'
      ).length
      return {
        ...row,
        slots,
        slotEntryTypes,
        totalHours: filled / 4,
        overtimeHours: overtimeEnabled ? overtimeCount / 4 : 0,
      }
    })
  }

  function deleteSegment(
    dayIndex: number,
    rowId: string,
    startSlot: number,
    endSlot: number
  ) {
    updateRow(dayIndex, rowId, (row: any) => {
      const slots = [...row.slots]
      const slotEntryTypes = [
        ...(row.slotEntryTypes || Array(slots.length).fill('')),
      ]
      for (let i = startSlot; i <= endSlot; i++) {
        slots[i] = false
        slotEntryTypes[i] = ''
      }
      const filled = slots.filter(Boolean).length
      const overtimeCount = slotEntryTypes.filter(
        (t: string) => t === 'overtime' || t === 'extra-overtime'
      ).length
      return {
        ...row,
        slots,
        slotEntryTypes,
        totalHours: filled / 4,
        overtimeHours: overtimeEnabled ? overtimeCount / 4 : 0,
      }
    })
    setSelectedSegment(null)
    setEntryTypePopup(null)
    autoSave()
  }

  function setSegmentEntryType(
    dayIndex: number,
    rowId: string,
    start: number,
    end: number,
    entryType: EntryType
  ) {
    updateRow(dayIndex, rowId, (row: any) => {
      const slotEntryTypes = [
        ...(row.slotEntryTypes || Array(row.slots.length).fill('')),
      ]
      if (slotEntryTypes.length !== row.slots.length) {
        while (slotEntryTypes.length < row.slots.length)
          slotEntryTypes.push('')
        slotEntryTypes.length = row.slots.length
      }
      for (let i = start; i <= end; i++) {
        if (row.slots[i]) slotEntryTypes[i] = entryType
      }
      const overtimeCount = slotEntryTypes.filter(
        (t: string) => t === 'overtime' || t === 'extra-overtime'
      ).length
      return {
        ...row,
        slotEntryTypes,
        overtimeHours: overtimeEnabled ? overtimeCount / 4 : 0,
      }
    })
    setEntryTypePopup(null)
    autoSave()
  }

  function detectOverlaps() {
    const overlaps: any[] = []
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const dayRows = rowsByDay[dayIndex] || []
      for (let slotIndex = 0; slotIndex < totalSlots; slotIndex++) {
        const jobsInSlot: string[] = []
        dayRows.forEach((row: any) => {
          if (row.slots[slotIndex]) {
            const jobNumber = row.jobNumber?.trim() || ''
            if (jobNumber) jobsInSlot.push(jobNumber)
          }
        })
        if (jobsInSlot.length > 1) {
          const hour = Math.floor(slotIndex / 4) % 24
          const minute = (slotIndex % 4) * 15
          overlaps.push({
            day: DAYS[dayIndex],
            dayIndex,
            time: formatTime(hour, minute),
            jobs: jobsInSlot,
          })
        }
      }
    }
    return overlaps
  }

  function showSubmitConfirmation() {
    const overlaps = detectOverlaps()
    if (overlaps.length > 0) {
      setOverlapDetails(overlaps)
      setShowOverlapWarning(true)
    } else {
      setShowConfirmDialog(true)
    }
  }

  async function confirmSubmit() {
    setShowConfirmDialog(false)
    try {
      const payload = serialize()
      const response = await post('/api/save', payload)
      const weekKey = getLocalDateString(weekStart)
      setSubmittedWeek(weekKey)
      setSubmittedTimesheets((prev) => ({
        ...prev,
        [weekKey]: { ...payload, ...response.timesheet },
      }))
      justSubmittedRef.current = true
      toast.success('Timesheet submitted successfully!')
    } catch (error: any) {
      toast.error(
        error.message || 'Failed to submit timesheet. Please try again.'
      )
      console.error('Submission error:', error)
    }
  }

  function cancelSubmit() {
    setShowConfirmDialog(false)
  }

  function dismissOverlapWarning() {
    setShowOverlapWarning(false)
    setOverlapDetails([])
  }

  function proceedDespiteOverlaps() {
    setShowOverlapWarning(false)
    setOverlapDetails([])
    setShowConfirmDialog(true)
  }

  function navigateToWeek(weekDate: string) {
    setWeekStart(new Date(weekDate))
  }

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  })

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedSegment) {
          e.preventDefault()
          deleteSegment(
            selectedSegment.dayIndex,
            selectedSegment.rowId,
            selectedSegment.start,
            selectedSegment.end
          )
        }
      }
      if (e.key === 'Escape') {
        setSelectedSegment(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedSegment])

  return {
    selectedSegment,
    setSelectedSegment,
    entryTypePopup,
    setEntryTypePopup,
    entryTypeConfirm,
    setEntryTypeConfirm,
    showConfirmDialog,
    setShowConfirmDialog,
    showOverlapWarning,
    setShowOverlapWarning,
    overlapDetails,
    setOverlapDetails,
    isDraggingRef,
    autoSave,
    trackId,
    onMouseDownCell,
    onMouseDownHandle,
    onMouseUp,
    deleteSegment,
    setSegmentEntryType,
    showSubmitConfirmation,
    confirmSubmit,
    cancelSubmit,
    dismissOverlapWarning,
    proceedDespiteOverlaps,
    navigateToWeek,
  }
}
