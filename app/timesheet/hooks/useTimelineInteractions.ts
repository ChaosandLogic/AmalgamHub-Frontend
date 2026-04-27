'use client'

import { useEffect, useRef, useState } from 'react'
import { DAYS } from '../lib/constants'
import type { EntryType } from '../lib/constants'
import {
  clamp,
  formatTime,
  getSegments,
  getSegmentAt,
} from '../lib/timesheetUtils'
import { apiPost, apiPut } from '../../lib/api/client'

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
  const saveFailCountRef = useRef(0)
  const sessionExpiredRef = useRef(false)

  function trackId(dayIndex: number, rowId: string) {
    return `track-${dayIndex}-${rowId}`
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

    apiPut('/api/timesheets/draft', payload as Record<string, unknown>).then(() => {
      saveFailCountRef.current = 0
    }).catch((err: Error) => {
      saveFailCountRef.current++
      const msg = (err.message || '').toLowerCase()
      if ((msg.includes('expired') || msg.includes('authentication')) && !sessionExpiredRef.current) {
        sessionExpiredRef.current = true
        toast.error('Your session has expired. Your work is saved locally — please log in again.')
      } else if (saveFailCountRef.current === 1) {
        toast.error('Autosave failed — changes are saved locally only.')
      }
    })
  }

  function onMouseDownCell(
    dayIndex: number,
    row: any,
    slotIndex: number,
    e: any,
    options?: { fromSegmentBody?: boolean }
  ) {
    e.preventDefault()
    isDraggingRef.current = true
    const originalSlots = [...row.slots]
    const seg = getSegmentAt(originalSlots, slotIndex)
    const nearThreshold = 1

    const originalSlotEntryTypes = row.slotEntryTypes ? [...row.slotEntryTypes] : []

    if (seg) {
      // RowTrack already put resize on pixel edges and move in the body; the slot-based
      // "near start/end" rule wrongly turns move into resize for short segments (e.g. 4 cells:
      // floor(mid) is 1 slot from the start with nearThreshold=1).
      if (options?.fromSegmentBody) {
        const grabSlot = clamp(slotIndex, seg.start, seg.end)
        draggingRef.current = {
          dayIndex,
          rowId: row.id,
          type: 'move',
          segmentStart: seg.start,
          segmentEnd: seg.end,
          offset: grabSlot - seg.start,
          originalSlots,
          originalSlotEntryTypes,
        }
        return
      }
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
          originalSlotEntryTypes,
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
          originalSlotEntryTypes,
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
        originalSlotEntryTypes,
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
        originalSlotEntryTypes,
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
    const originalSlotEntryTypes = row.slotEntryTypes ? [...row.slotEntryTypes] : []
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
      originalSlotEntryTypes,
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
      // Always read from the frozen snapshot taken at drag-start (drag.originalSlotEntryTypes).
      // row.slotEntryTypes reflects intermediate drag state and has '' at the original positions
      // after the first applyDrag call, which would wipe overtime on every subsequent mouse move.
      const sourceTypes: ('' | EntryType)[] = drag.originalSlotEntryTypes ?? row.slotEntryTypes ?? []
      const slotEntryTypes: ('' | EntryType)[] = Array.from(
        { length: slots.length },
        (_, i) => {
          if (!base[i]) return ''
          const t = sourceTypes[i]
          return (t === 'overtime' || t === 'extra-overtime' || t === 'standard') ? t : 'standard'
        }
      )

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
        const segStart = Math.min(drag.segmentStart, drag.segmentEnd)
        const segEnd = Math.max(drag.segmentStart, drag.segmentEnd)
        const segmentLength = segEnd - segStart + 1
        const newStart = drag.endSlot - drag.offset
        const clampedStart = Math.max(
          0,
          Math.min(newStart, totalSlots - segmentLength)
        )
        const clampedEnd = clampedStart + segmentLength - 1
        // Collect entry types in segment order; explicitly preserve overtime/extra-overtime so move doesn't change them
        const preservedTypes: ('' | EntryType)[] = []
        for (let i = segStart; i <= segEnd; i++) {
          if (i >= 0 && i < slots.length && i < slotEntryTypes.length) {
            const t = slotEntryTypes[i]
            preservedTypes.push(
              (t === 'overtime' || t === 'extra-overtime' ? t : 'standard') as '' | EntryType
            )
            slots[i] = false
            slotEntryTypes[i] = ''
          }
        }
        for (let i = clampedStart; i <= clampedEnd; i++) {
          const idx = i - clampedStart
          if (i >= 0 && i < slots.length) {
            slots[i] = true
            slotEntryTypes[i] = (preservedTypes[idx] ?? 'standard') as '' | EntryType
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
      const response = await apiPost<any>('/api/timesheets', payload)
      const weekKey = getLocalDateString(weekStart)
      setSubmittedWeek(weekKey)
      setSubmittedTimesheets((prev) => ({
        ...prev,
        [weekKey]: { ...payload, ...response.timesheet },
      }))
      justSubmittedRef.current = true

      const verification = response?.verification
      if (verification && typeof verification.status === 'string') {
        const message = verification.message || 'Timesheet submitted.'
        switch (verification.status) {
          case 'verified':
            toast.success(message)
            break
          case 'mismatch':
          case 'sync_failed':
            toast.warning(message)
            break
          case 'sync_disabled':
          default:
            toast.success(message)
            break
        }
      } else {
        toast.success('Timesheet submitted successfully!')
      }
    } catch (error: unknown) {
      toast.error(
        (error instanceof Error ? error.message : String(error)) || 'Failed to submit timesheet. Please try again.'
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
