'use client'

import { useEffect, useRef, useState } from 'react'
import type { RowData } from '../types'
import type { EntryType } from '../constants'

export interface UseTimerParams {
  rowsByDay: Array<Array<RowData>>
  updateRow: (
    dayIndex: number,
    rowId: string,
    updater: (row: any) => any
  ) => void
  createEmptyRow: (total: number, id: number) => RowData
  setRowsByDay: React.Dispatch<
    React.SetStateAction<Array<Array<RowData>>>
  >
  activeDay: number
  currentUserId: string | null
  totalSlots: number
  overtimeEnabled: boolean
  nextRowId: React.MutableRefObject<number>
  autoSave: () => void
  setActiveDay?: (day: number) => void
}

export function useTimer({
  rowsByDay,
  updateRow,
  createEmptyRow,
  setRowsByDay,
  activeDay,
  currentUserId,
  totalSlots,
  overtimeEnabled,
  nextRowId,
  autoSave,
  setActiveDay,
}: UseTimerParams) {
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerStartTime, setTimerStartTime] = useState<number | null>(null)
  const [timerJobNumber, setTimerJobNumber] = useState('')
  const [timerElapsed, setTimerElapsed] = useState(0)
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startTimer() {
    const now = Date.now()
    setTimerRunning(true)
    setTimerStartTime(now)
    setTimerElapsed(0)
    if (currentUserId) {
      localStorage.setItem(
        `timer_${currentUserId}`,
        JSON.stringify({
          running: true,
          startTime: now,
          jobNumber: timerJobNumber,
          dayIndex: activeDay,
        })
      )
    }
  }

  function stopTimer() {
    if (!timerStartTime) return

    const elapsed = Date.now() - timerStartTime
    const hours = elapsed / (1000 * 60 * 60)
    const roundedHours = Math.round(hours * 4) / 4

    if (roundedHours > 0) {
      const jobNumber = timerJobNumber.trim()
      const dayRows = rowsByDay[activeDay] || []
      let targetRow = dayRows.find((r) => r.jobNumber === jobNumber)

      if (!targetRow) {
        const newRow = createEmptyRow(totalSlots, nextRowId.current++)
        newRow.jobNumber = timerJobNumber
        setRowsByDay((prev) =>
          prev.map((rows, d) =>
            d === activeDay ? [...rows, newRow] : rows
          )
        )
        targetRow = newRow
      }

      setTimeout(() => {
        updateRow(activeDay, targetRow!.id, (row: any) => {
          const slots = [...row.slots]
          const slotEntryTypes = [
            ...(row.slotEntryTypes || Array(row.slots.length).fill('')),
          ]
          if (slotEntryTypes.length !== slots.length) {
            while (slotEntryTypes.length < slots.length) slotEntryTypes.push('')
            slotEntryTypes.length = slots.length
          }
          const slotsNeeded = Math.ceil(roundedHours * 4)
          let lastFilledIndex = -1
          for (let i = slots.length - 1; i >= 0; i--) {
            if (slots[i]) {
              lastFilledIndex = i
              break
            }
          }
          let startIndex = lastFilledIndex + 1
          if (startIndex + slotsNeeded > slots.length) startIndex = 0
          for (
            let i = 0;
            i < slotsNeeded && startIndex + i < slots.length;
            i++
          ) {
            slots[startIndex + i] = true
            slotEntryTypes[startIndex + i] = 'standard'
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
        autoSave()
      }, 100)
    }

    setTimerRunning(false)
    setTimerStartTime(null)
    setTimerElapsed(0)
    if (currentUserId) {
      localStorage.removeItem(`timer_${currentUserId}`)
    }
  }

  useEffect(() => {
    if (timerRunning && timerStartTime) {
      timerIntervalRef.current = setInterval(() => {
        setTimerElapsed(Date.now() - timerStartTime)
      }, 1000)
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
    }
  }, [timerRunning, timerStartTime])

  useEffect(() => {
    if (currentUserId) {
      const saved = localStorage.getItem(`timer_${currentUserId}`)
      if (saved) {
        try {
          const data = JSON.parse(saved)
          if (data.running && data.startTime) {
            setTimerRunning(true)
            setTimerStartTime(data.startTime)
            setTimerJobNumber(data.jobNumber || '')
            setTimerElapsed(Date.now() - data.startTime)
            if (data.dayIndex !== undefined && setActiveDay) {
              setActiveDay(data.dayIndex)
            }
          }
        } catch {}
      }
    }
  }, [currentUserId, setActiveDay])

  function formatTimerDuration(ms: number) {
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  return {
    timerRunning,
    setTimerRunning,
    timerStartTime,
    timerJobNumber,
    setTimerJobNumber,
    timerElapsed,
    startTimer,
    stopTimer,
    formatTimerDuration,
  }
}
