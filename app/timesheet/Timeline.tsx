'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '../components/Toast'
import LoadingSpinner from '../components/LoadingSpinner'
import { startOfWeek, getLocalDateString, normalizeToMidnight } from '../lib/utils/dateUtils'
import { slotsToBase64, base64ToSlots } from './slotBitmap'

type TimelineProps = { userName?: string }

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)) }

function slotLabel(startHour: number, quarterIndex: number) {
  const totalMinutes = (startHour * 60) + (quarterIndex * 15)
  const hour24 = Math.floor(totalMinutes / 60) % 24
  const minute = totalMinutes % 60
  const period = hour24 >= 12 ? 'PM' : 'AM'
  const displayHour = hour24 % 12 || 12
  const minuteStr = String(minute).padStart(2, '0')
  return `${displayHour}:${minuteStr}${period}`
}

function formatTime(hour: number, minute: number) {
  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  const minuteStr = String(minute).padStart(2, '0')
  return `${displayHour}:${minuteStr}${period}`
}

export default function Timeline({ userName }: TimelineProps) {
  const toast = useToast()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [timelineStartHour, setTimelineStartHour] = useState(7)
  const [timelineDuration, setTimelineDuration] = useState(14)
  const totalSlots = useMemo(() => timelineDuration * 4 - 3, [timelineDuration])

  const [rowsByDay, setRowsByDay] = useState<Array<Array<{id: string; jobNumber: string; slots: boolean[]; totalHours: number; overtimeHours: number}>>>(() => Array.from({ length: 7 }, () => []))
  const [dayNotes, setDayNotes] = useState<string[]>(() => Array(7).fill(''))
  const [activeDay, setActiveDay] = useState(() => todayIndexForWeek(startOfWeek(new Date())))
  const [overtimeEnabled, setOvertimeEnabled] = useState(false)
  const [weekendOvertimeEnabled, setWeekendOvertimeEnabled] = useState(false)
  const [overtimeHours, setOvertimeHours] = useState<number[]>(Array(7).fill(0))
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [selectedSegment, setSelectedSegment] = useState<{dayIndex: number, rowId: string, start: number, end: number} | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showOverlapWarning, setShowOverlapWarning] = useState(false)
  const [overlapDetails, setOverlapDetails] = useState<any[]>([])
  const [submittedWeek, setSubmittedWeek] = useState<string | null>(null)
  const [submittedTimesheets, setSubmittedTimesheets] = useState<{[week: string]: any}>({})
  const [submittedTimesheetsLoaded, setSubmittedTimesheetsLoaded] = useState(false)
  const headerTimelineRef = useRef<HTMLDivElement>(null)
  const firstRowTrackRef = useRef<HTMLDivElement>(null)
  
  // Timer state
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerStartTime, setTimerStartTime] = useState<number | null>(null)
  const [timerJobNumber, setTimerJobNumber] = useState('')
  const [timerElapsed, setTimerElapsed] = useState(0)
  const [projects, setProjects] = useState<any[]>([])
  const [userResourceId, setUserResourceId] = useState<string | null>(null)
  const [todaysBookings, setTodaysBookings] = useState<any[]>([])
  
  const justSubmittedRef = useRef(false)
  const draggingRef = useRef<any>(null)
  const nextRowId = useRef(0)
  const isDraggingRef = useRef(false)
  const saveTimerRef = useRef<any>(null)
  const timerIntervalRef = useRef<any>(null)

  // Check submitted status and load appropriate data when week changes
  useEffect(() => {
    // Wait for submitted timesheets to be loaded before making decisions
    if (!submittedTimesheetsLoaded) {
      return
    }
    
    const currentWeek = getLocalDateString(weekStart)
    
    // Skip reloading if we just submitted THIS specific week
    if (justSubmittedRef.current && submittedWeek === currentWeek) {
      justSubmittedRef.current = false
      return
    }
    
    // Always update submittedWeek flag based on submittedTimesheets
    if (submittedTimesheets[currentWeek]) {
      // This week is submitted - set the flag and load the submitted data
      if (submittedWeek !== currentWeek) {
        setSubmittedWeek(currentWeek)
      }
      const timesheet = submittedTimesheets[currentWeek]
      if (timesheet) {
        const newRowsByDay: Array<Array<{id: string; jobNumber: string; slots: boolean[]; totalHours: number; overtimeHours: number}>> = Array.from({ length: 7 }, () => [])
        
        // Check if we have days data in the timesheet object or in the data field
        const daysData = timesheet.days || timesheet.data?.days
        
        daysData?.forEach((dayData: any[], dayIndex: number) => {
          dayData.forEach((job: any) => {
            const slots: boolean[] = new Array(totalSlots).fill(false)
            job.timeSlots?.forEach((slot: any) => {
              if (slot.filled && slot.timeIndex < totalSlots) {
                slots[slot.timeIndex] = true
              }
            })
            
            const row = {
              id: `row-${nextRowId.current++}`,
              jobNumber: job.jobNumber || '',
              slots,
              totalHours: job.totalHours || 0,
              // Only load overtime hours if overtime is enabled
              overtimeHours: overtimeEnabled ? (job.overtimeHours || 0) : 0
            }
            newRowsByDay[dayIndex].push(row)
          })
        })
        
        // Ensure each day has at least 4 rows
        newRowsByDay.forEach((dayRows, dayIndex) => {
          while (dayRows.length < 4) {
            dayRows.push(createEmptyRow(totalSlots, nextRowId.current++))
          }
        })
        
        setRowsByDay(newRowsByDay)

        // Restore per-day notes if present (check top-level and nested data)
        const notesSource =
          (timesheet as any).dayNotes ??
          (timesheet as any).data?.dayNotes
        if (Array.isArray(notesSource)) {
          const normalized = Array.from({ length: 7 }, (_v, i) => (notesSource[i] != null ? String(notesSource[i]) : ''))
          setDayNotes(normalized)
        } else {
          setDayNotes(Array(7).fill(''))
        }

        // Overtime is now stored per job, so no need to restore per-day overtime
      }
    } else {
      // This week is not submitted - load autosaved data or start fresh
      setSubmittedWeek(null)
      loadAutosavedForWeek()
    }
  }, [weekStart, submittedTimesheets, submittedTimesheetsLoaded, totalSlots])

  // Load submitted timesheets on mount (only once)
  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch('/api/timesheets', { credentials: 'include' })
        if (res.ok) {
          const response = await res.json()
          const data = response.data || response
          const timesheetsByWeek: {[week: string]: any} = {}
          data.timesheets?.forEach((ts: any) => {
            const raw = ts.week_start_date ?? ts.weekStartDate ?? ''
            const weekKey = typeof raw === 'string' && raw.length >= 10
              ? raw.slice(0, 10)
              : getLocalDateString(new Date(raw || 0))
            timesheetsByWeek[weekKey] = ts
          })
          setSubmittedTimesheets(timesheetsByWeek)
        }
      } catch (error) {
        console.error('Failed to load submitted timesheets:', error)
      } finally {
        setSubmittedTimesheetsLoaded(true)
      }
    }
    loadData()
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const r = await fetch('/api/user', { credentials: 'include' })
        if (r.ok) {
          const response = await r.json()
          const user = response.data?.user || response.user
          if (user?.id) setCurrentUserId(user.id)
          if (user?.resourceId) setUserResourceId(user.resourceId)
          if (user?.timelineStartHour != null) setTimelineStartHour(user.timelineStartHour)
          if (user?.timelineDuration != null) setTimelineDuration(user.timelineDuration)
        }

        // Load global settings for job prefixes and overtime
        const s = await fetch('/api/global-settings', { credentials: 'include' })
        if (s.ok) {
          const settingsResponse = await s.json()
          const settings = settingsResponse.data?.settings || settingsResponse.settings
          if (settings?.overtime_enabled !== undefined) {
            setOvertimeEnabled(!!settings.overtime_enabled)
          }
          if (settings?.weekend_overtime_enabled !== undefined) {
            setWeekendOvertimeEnabled(!!settings.weekend_overtime_enabled)
          }
        } else {
          // Set default values if API fails
          console.error('Failed to load global settings, using defaults')
          setOvertimeEnabled(false)
          setWeekendOvertimeEnabled(false)
        }

        // Load projects
        const p = await fetch('/api/projects', { credentials: 'include' })
        if (p.ok) {
          const projectsResponse = await p.json()
          const projectsData = projectsResponse.data || projectsResponse
          console.log('Projects API response:', projectsData)
          if (projectsData?.projects && Array.isArray(projectsData.projects)) {
            console.log(`Loaded ${projectsData.projects.length} projects`)
            setProjects(projectsData.projects)
          } else if (Array.isArray(projectsData)) {
            // Fallback: if API returns array directly
            console.log(`Loaded ${projectsData.length} projects (direct array)`)
            setProjects(projectsData)
          } else {
            console.warn('Unexpected projects data format:', projectsData)
          }
        } else {
          console.error('Failed to load projects:', p.status, p.statusText)
        }
      } catch (error) {
        // Set default values if there's an error
        console.error('Error loading settings:', error)
        setOvertimeEnabled(false)
        setWeekendOvertimeEnabled(false)
      } finally {
        setSettingsLoaded(true)
      }
    })()
  }, [])

  // Ensure rows always have at least 4 per day (after we've tried to load saved/autosaved data)
  useEffect(() => {
    if (totalSlots === 0) return
    // Don't fill with empty rows until list/autosave has been tried, so navigate-back loads saved data first
    if (!submittedTimesheetsLoaded) return

    // Don't clear timeline if we just submitted THIS specific week
    if (justSubmittedRef.current && submittedWeek === getLocalDateString(weekStart)) {
      return
    }

    // Ensure each day has at least 4 rows
    setRowsByDay(prev => {
      let changed = false
      const newRowsByDay = prev.map(dayRows => {
        if (dayRows.length < 4) {
          changed = true
          const needed = 4 - dayRows.length
          const newRows = Array.from({ length: needed }, () => createEmptyRow(totalSlots, nextRowId.current++))
          return [...dayRows, ...newRows]
        }
        return dayRows
      })
      return changed ? newRowsByDay : prev
    })
    setActiveDay(todayIndexForWeek(weekStart))
  }, [totalSlots, weekStart, submittedTimesheetsLoaded])

  // Load today's bookings for the user's resource
  useEffect(() => {
    if (!userResourceId) return
    
    const loadTodaysBookings = async () => {
      try {
        const today = new Date()
        const todayStr = getLocalDateString(today)
        
        const response = await fetch(
          `/api/bookings?resourceId=${userResourceId}&startDate=${todayStr}&endDate=${todayStr}`,
          { credentials: 'include' }
        )
        
        if (response.ok) {
          const responseData = await response.json()
          const data = responseData.data || responseData
          // Filter to only bookings that are actually today (not time off)
          const bookings = (data.bookings || []).filter((booking: any) => {
            // Exclude time off bookings (holiday, sick, etc.)
            const title = booking.title?.toLowerCase() || ''
            return !title.includes('holiday') && 
                   !title.includes('sick') && 
                   !title.includes('public holiday') &&
                   !title.includes('non work') &&
                   !title.includes('non-work')
          })
          setTodaysBookings(bookings)
        }
      } catch (error) {
        console.error('Error loading today\'s bookings:', error)
      }
    }
    
    loadTodaysBookings()
    // Refresh every minute to keep it current
    const interval = setInterval(loadTodaysBookings, 60000)
    return () => clearInterval(interval)
  }, [userResourceId])

  // Load autosaved timesheet on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/autosaved', { credentials: 'include' })
        if (r.ok) {
          const response = await r.json()
          const timesheet = response.data?.timesheet || response.timesheet
          if (timesheet && !cancelled) hydrateFromSavedInComponent(timesheet)
          return
        }
      } catch {}
      // Try user-specific localStorage fallback
      if (currentUserId && !cancelled) {
        try {
          const raw = localStorage.getItem(`timesheet_autosave_${currentUserId}`)
          if (raw) hydrateFromSavedInComponent(JSON.parse(raw))
        } catch {}
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId])

  function hydrateFromSavedInComponent(saved: any) {
    try {
      // Don't change the week start - it should already be set correctly
      // The week start is managed by the useEffect, not by this hydration function
      const rows: any[][] = Array.from({ length: 7 }, () => [])
      for (let day = 0; day < 7; day++) {
        const dayRows = Array.isArray(saved?.days?.[day]) ? saved.days[day] : []
        for (const jobData of dayRows) {
          const id = nextRowId.current++
          const slots = hydrateSlotsFromSavedRow(jobData, totalSlots)
          const totalHours = slots.filter(Boolean).length / 4
          // Only load overtime hours if overtime is enabled
          const overtimeHours = overtimeEnabled ? (jobData?.overtimeHours || 0) : 0
          rows[day].push({ id, jobNumber: jobData?.jobNumber || '', slots, totalHours, overtimeHours })
        }
        // Ensure each day has at least 4 rows
        while (rows[day].length < 4) {
          rows[day].push(createEmptyRow(totalSlots, nextRowId.current++))
        }
      }
      setRowsByDay(rows)

      // Restore per-day notes if present in saved payload
      const notesSource = (saved as any).dayNotes ?? (saved as any).data?.dayNotes
      if (Array.isArray(notesSource)) {
        const normalized = Array.from({ length: 7 }, (_v, i) => (notesSource[i] != null ? String(notesSource[i]) : ''))
        setDayNotes(normalized)
      } else {
        setDayNotes(Array(7).fill(''))
      }
      
      // Overtime is now stored per job in each row, loaded above
    } catch {}
  }

  function createEmptyRow(total: number, id: number) {
    return { id: `row-${id}`, jobNumber: '', slots: Array.from({ length: total }, () => false), totalHours: 0, overtimeHours: 0 }
  }

  function updateRow(dayIndex: number, rowId: string, updater: (row: any) => any) {
    setRowsByDay(prev => prev.map((rows, d) => {
      if (d !== dayIndex) return rows
      return rows.map((r: any) => (r.id === rowId ? updater({ ...r }) : r))
    }))
  }

  function addRow(dayIndex: number) {
    setRowsByDay(prev => prev.map((rows, d) => (d === dayIndex ? [...rows, createEmptyRow(totalSlots, nextRowId.current++)] : rows)))
  }

  function removeRow(dayIndex: number, rowId: number) {
    setRowsByDay(prev => prev.map((rows, d) => (d === dayIndex ? rows.filter((r: any) => r.id !== rowId) : rows)))
  }

  function onMouseDownCell(dayIndex: number, row: any, slotIndex: number, e: any) {
    e.preventDefault()
    isDraggingRef.current = true
    const originalSlots = [...row.slots]
    const seg = getSegmentAt(originalSlots, slotIndex)
    const nearThreshold = 1

    if (seg) {
      // Check if clicking near segment edges (resize)
      if (Math.abs(slotIndex - seg.start) <= nearThreshold) {
        draggingRef.current = { dayIndex, rowId: row.id, type: 'resize', side: 'left', segmentStart: seg.start, segmentEnd: seg.end, anchor: seg.end, endSlot: slotIndex, originalSlots }
        return
      }
      if (Math.abs(slotIndex - seg.end) <= nearThreshold) {
        draggingRef.current = { dayIndex, rowId: row.id, type: 'resize', side: 'right', segmentStart: seg.start, segmentEnd: seg.end, anchor: seg.start, endSlot: slotIndex, originalSlots }
        return
      }

      // Clicked in middle of segment - start move operation
      draggingRef.current = { dayIndex, rowId: row.id, type: 'move', segmentStart: seg.start, segmentEnd: seg.end, offset: slotIndex - seg.start, originalSlots }
      return
    } else {
      // Clicked in empty area - start new segment creation
      draggingRef.current = { dayIndex, rowId: row.id, type: 'range', startSlot: slotIndex, endSlot: slotIndex, filling: true, originalSlots }
      applyDrag()
      return
    }
  }

  function onMouseDownHandle(dayIndex: number, row: any, slotIndex: number, handle: 'left' | 'right') {
    const originalSlots = [...row.slots]
    const segs = getSegments(originalSlots)

    // Find the segment that this handle belongs to
    // Since resize handles are positioned at segment boundaries, we need to find the segment
    let targetSeg = null
    for (const seg of segs) {
      if (handle === 'left' && slotIndex >= seg.start && slotIndex <= seg.start + 1) {
        targetSeg = seg
        break
      }
      if (handle === 'right' && slotIndex >= seg.end - 1 && slotIndex <= seg.end) {
        targetSeg = seg
        break
      }
    }

    if (!targetSeg) {
      console.log('No segment found for resize handle at', slotIndex, handle, 'segments:', segs)
      return
    }

    const anchor = handle === 'left' ? targetSeg.end : targetSeg.start
    draggingRef.current = { dayIndex, rowId: row.id, type: 'resize', side: handle, segmentStart: targetSeg.start, segmentEnd: targetSeg.end, anchor, endSlot: slotIndex, originalSlots }
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
    const hoverSlot = clamp(Math.floor(relativeX / slotWidth), 0, totalSlots - 1)
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

      if (type === 'range') {
        const start = Math.min(drag.startSlot, drag.endSlot)
        const end = Math.max(drag.startSlot, drag.endSlot)
        for (let i = start; i <= end; i++) {
          slots[i] = true
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

        // Clear the original segment
        for (let i = s; i <= e; i++) {
          slots[i] = false
        }

        // Set the new segment
        for (let i = newStart; i <= newEnd; i++) {
          slots[i] = true
        }
      } else if (type === 'move') {
        const segmentLength = drag.segmentEnd - drag.segmentStart + 1
        const newStart = drag.endSlot - drag.offset
        const newEnd = newStart + segmentLength - 1

        // Check boundaries
        const clampedStart = Math.max(0, Math.min(newStart, totalSlots - segmentLength))
        const clampedEnd = clampedStart + segmentLength - 1

        // Clear the original segment
        for (let i = drag.segmentStart; i <= drag.segmentEnd; i++) {
          if (i >= 0 && i < slots.length) {
            slots[i] = false
          }
        }

        // Set the new segment position
        for (let i = clampedStart; i <= clampedEnd; i++) {
          if (i >= 0 && i < slots.length) {
            slots[i] = true
          }
        }
      }

      const filled = slots.filter(Boolean).length
      row.slots = slots
      row.totalHours = filled / 4
      return row
    })
  }

  // Sync header timeline width with first row track width
  const syncHeaderWidth = () => {
    if (headerTimelineRef.current && firstRowTrackRef.current) {
      const trackWidth = firstRowTrackRef.current.offsetWidth
      headerTimelineRef.current.style.width = `${trackWidth}px`
    }
  }

  useEffect(() => {
    syncHeaderWidth()
  }, [rowsByDay, activeDay, totalSlots, overtimeEnabled])

  // Sync width on window resize and track size changes
  useEffect(() => {
    if (!firstRowTrackRef.current) return

    const handleResize = () => {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        syncHeaderWidth()
      })
    }

    // Use ResizeObserver for more precise tracking of the track element
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        syncHeaderWidth()
      })
    })

    resizeObserver.observe(firstRowTrackRef.current)
    window.addEventListener('resize', handleResize)
    
    // Initial sync after a short delay to catch any layout changes
    const timeoutId = setTimeout(syncHeaderWidth, 100)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', handleResize)
      clearTimeout(timeoutId)
    }
  }, [rowsByDay, activeDay, totalSlots, overtimeEnabled])

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  })

  // Keyboard event handler for deleting selected segments
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedSegment) {
          e.preventDefault()
          deleteSegment(selectedSegment.dayIndex, selectedSegment.rowId, selectedSegment.start, selectedSegment.end)
        }
      }
      if (e.key === 'Escape') {
        setSelectedSegment(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedSegment])

  async function post(path: string, body: any) {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' })
    if (!r.ok) throw new Error('Request failed')
    return r.json().catch(() => ({}))
  }

  function detectOverlaps() {
    const overlaps: any[] = []
    
    // Check each day
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const dayRows = rowsByDay[dayIndex] || []
      
      // For each time slot, check if multiple jobs occupy it
      for (let slotIndex = 0; slotIndex < totalSlots; slotIndex++) {
        const jobsInSlot: string[] = []
        
        dayRows.forEach((row: any) => {
          if (row.slots[slotIndex]) {
            const jobNumber = row.jobNumber?.trim() || ''
            if (jobNumber) {
              jobsInSlot.push(jobNumber)
            }
          }
        })
        
        // If more than one job occupies this slot, it's an overlap
        if (jobsInSlot.length > 1) {
          const hour = Math.floor(slotIndex / 4) + timelineStartHour
          const minute = (slotIndex % 4) * 15
          overlaps.push({
            day: DAYS[dayIndex],
            dayIndex,
            time: formatTime(hour, minute),
            jobs: jobsInSlot
          })
        }
      }
    }
    
    return overlaps
  }

  function showSubmitConfirmation() {
    // Check for overlaps first
    const overlaps = detectOverlaps()
    
    if (overlaps.length > 0) {
      // Show overlap warning
      setOverlapDetails(overlaps)
      setShowOverlapWarning(true)
    } else {
      // No overlaps, proceed to confirmation
      setShowConfirmDialog(true)
    }
  }

  async function confirmSubmit() {
    setShowConfirmDialog(false)
    try {
      const payload = serialize()
      const response = await post('/api/save', payload)
      // Mark this week as submitted
      const weekKey = getLocalDateString(weekStart)
      setSubmittedWeek(weekKey)
      // Store full payload (including dayNotes, days, summary) so notes and data are available without refetch
      setSubmittedTimesheets(prev => ({
        ...prev,
        [weekKey]: { ...payload, ...response.timesheet }
      }))
      // Set flag to prevent timeline from being cleared
      justSubmittedRef.current = true
      
      // Show success toast
      toast.success('Timesheet submitted successfully!')
    } catch (error: any) {
      // Show error toast
      toast.error(error.message || 'Failed to submit timesheet. Please try again.')
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

  // Navigate to a previous week's timesheet
  function navigateToWeek(weekDate: string) {
    const targetWeek = new Date(weekDate)
    setWeekStart(targetWeek)
    // The useEffect will handle loading the appropriate data
  }

  // Load autosaved data for the current week
  async function loadAutosavedForWeek() {
    // Don't clear timeline if we just submitted THIS specific week
    if (justSubmittedRef.current && submittedWeek === getLocalDateString(weekStart)) {
      return
    }
    
    try {
      const r = await fetch('/api/autosaved', { credentials: 'include' })
      if (r.ok) {
        const response = await r.json()
        const timesheet = response.data?.timesheet || response.timesheet
        if (timesheet) {
          // Check if the autosaved data is for the current week
          const autosavedWeek = getLocalDateString(new Date(timesheet.weekStartDate))
          const currentWeek = getLocalDateString(weekStart)
          
          if (autosavedWeek === currentWeek) {
            hydrateFromSavedInComponent(timesheet)
            return
          }
        }
      }
    } catch (error) {
      console.error('Failed to load autosaved data:', error)
    }
    
    // If no autosaved data for this week, start with empty rows and blank notes
    setRowsByDay(Array.from({ length: 7 }, () => Array.from({ length: 4 }, () => createEmptyRow(totalSlots, nextRowId.current++))))
    setDayNotes(Array(7).fill(''))
  }

  function serialize() {
    const summary: any = { jobs: {}, totalHours: 0, standardHours: 0, overtimeHours: 0 }
    const days = rowsByDay.map((rows, dayIndex) => {
      return rows.map((r: any) => {
        const jobNumber = r.jobNumber || ''
        const totalHours = r.slots.filter(Boolean).length * 0.25
        // Only use overtime hours if overtime is enabled, otherwise treat all as standard
        const overtimeHours = overtimeEnabled ? (r.overtimeHours || 0) : 0
        
        if (jobNumber) {
          // Initialize job entry if it doesn't exist
          if (!summary.jobs[jobNumber]) {
            summary.jobs[jobNumber] = { totalHours: 0, overtimeHours: 0, standardHours: 0 }
          }
          
          // Aggregate hours per job
          summary.jobs[jobNumber].totalHours += totalHours
          summary.jobs[jobNumber].overtimeHours += overtimeHours
          summary.jobs[jobNumber].standardHours += Math.max(0, totalHours - overtimeHours)
          
          summary.totalHours += totalHours
        }
        
        return {
          jobNumber,
          s: slotsToBase64(r.slots, totalSlots),
          totalHours,
          overtimeHours: overtimeEnabled ? overtimeHours : undefined,
        }
      })
    })
    
    // Calculate totals if overtime is enabled
    if (overtimeEnabled) {
      summary.overtimeHours = Object.values(summary.jobs).reduce((sum: number, job: any) => sum + (job.overtimeHours || 0), 0)
      // Ensure overtime doesn't exceed total
      summary.overtimeHours = Math.min(summary.overtimeHours, summary.totalHours)
      summary.standardHours = Math.max(0, summary.totalHours - summary.overtimeHours)
    } else {
      // When overtime is disabled, all hours are standard - explicitly set to 0
      summary.overtimeHours = 0
      summary.standardHours = summary.totalHours
      // Also clear overtime from all job entries
      Object.keys(summary.jobs).forEach(jobNumber => {
        if (summary.jobs[jobNumber]) {
          summary.jobs[jobNumber].overtimeHours = 0
          summary.jobs[jobNumber].standardHours = summary.jobs[jobNumber].totalHours
        }
      })
    }
    
    // Final validation: ensure standard + overtime = total (within rounding tolerance)
    const calculatedTotal = summary.standardHours + summary.overtimeHours
    if (Math.abs(calculatedTotal - summary.totalHours) > 0.01) {
      // Recalculate to ensure consistency
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

  function trackId(dayIndex: number, rowId: number) { return `track-${dayIndex}-${rowId}` }

  const summary = useMemo(() => computeWeeklySummary(rowsByDay, overtimeEnabled), [rowsByDay, overtimeEnabled])
  const recentJobs = useMemo<{ jobNumber: string; title: string }[]>(
    () => lastUsedJobsFromSummary(summary, projects || []),
    [summary, projects]
  )
  const overlaps = useMemo(() => computeOverlaps(rowsByDay[activeDay] || [], totalSlots), [rowsByDay, activeDay, totalSlots])

  function autoSave() {
    if (isDraggingRef.current) return
    const payload = serialize()
    try {
      if (currentUserId) {
        localStorage.setItem(`timesheet_autosave_${currentUserId}`, JSON.stringify(payload))
      } else {
        localStorage.setItem('timesheet_autosave', JSON.stringify(payload))
      }
    } catch {}
    post('/api/autosave', payload).catch(() => {})
  }

  function deleteSegment(dayIndex: number, rowId: string, startSlot: number, endSlot: number) {
    updateRow(dayIndex, rowId, (row: any) => {
      const slots = [...row.slots]
      for (let i = startSlot; i <= endSlot; i++) {
        slots[i] = false
      }
      const filled = slots.filter(Boolean).length
      return {
        ...row,
        slots,
        totalHours: filled / 4
      }
    })
    setSelectedSegment(null)
    autoSave()
  }

  // Timer functions
  function startTimer() {
    const now = Date.now()
    setTimerRunning(true)
    setTimerStartTime(now)
    setTimerElapsed(0)
    
    // Save timer state to localStorage
    if (currentUserId) {
      localStorage.setItem(`timer_${currentUserId}`, JSON.stringify({
        running: true,
        startTime: now,
        jobNumber: timerJobNumber,
        dayIndex: activeDay
      }))
    }
  }

  function stopTimer() {
    if (!timerStartTime) return
    
    const elapsed = Date.now() - timerStartTime
    const hours = elapsed / (1000 * 60 * 60)
    const roundedHours = Math.round(hours * 4) / 4 // Round to nearest 0.25
    
    if (roundedHours > 0) {
      // Find or create a row for this job
      const jobNumber = timerJobNumber.trim()
      const dayRows = rowsByDay[activeDay] || []
      let targetRow = dayRows.find(r => r.jobNumber === jobNumber)
      
      if (!targetRow) {
        // Create new row
        const newRow = createEmptyRow(totalSlots, nextRowId.current++)
        newRow.jobNumber = timerJobNumber
        setRowsByDay(prev => prev.map((rows, d) => (d === activeDay ? [...rows, newRow] : rows)))
        targetRow = newRow
      }
      
      // Add time segment at the end of existing segments or start of day
      setTimeout(() => {
        updateRow(activeDay, targetRow!.id, (row: any) => {
          const slots = [...row.slots]
          const slotsNeeded = Math.ceil(roundedHours * 4)
          
          // Find the last filled slot
          let lastFilledIndex = -1
          for (let i = slots.length - 1; i >= 0; i--) {
            if (slots[i]) {
              lastFilledIndex = i
              break
            }
          }
          
          // Start after the last filled slot, or at the beginning
          let startIndex = lastFilledIndex + 1
          if (startIndex + slotsNeeded > slots.length) {
            startIndex = 0 // Start from beginning if not enough space at end
          }
          
          // Fill the slots
          for (let i = 0; i < slotsNeeded && startIndex + i < slots.length; i++) {
            slots[startIndex + i] = true
          }
          
          const filled = slots.filter(Boolean).length
          return { ...row, slots, totalHours: filled / 4 }
        })
        autoSave()
      }, 100)
    }
    
    // Reset timer
    setTimerRunning(false)
    setTimerStartTime(null)
    setTimerElapsed(0)
    
    // Clear localStorage
    if (currentUserId) {
      localStorage.removeItem(`timer_${currentUserId}`)
    }
  }

  // Update elapsed time every second when timer is running
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

  // Load timer state from localStorage on mount
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
            if (data.dayIndex !== undefined) {
              setActiveDay(data.dayIndex)
            }
          }
        } catch {}
      }
    }
  }, [currentUserId])

  function formatTimerDuration(ms: number) {
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  function scheduleAutoSave() {
    if (isDraggingRef.current) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => autoSave(), 800)
  }

  useEffect(() => {
    scheduleAutoSave()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsByDay, weekStart])

  // Clear all overtime hours when overtime is disabled
  useEffect(() => {
    if (!overtimeEnabled) {
      setRowsByDay(prev => prev.map(dayRows => 
        dayRows.map(row => ({ ...row, overtimeHours: 0 }))
      ))
    }
  }, [overtimeEnabled])

  // Auto-calculate weekend overtime per job - only when settings change, not on every row update
  // Use a ref to track if we should apply weekend overtime to avoid infinite loops
  const previousWeekendOvertimeEnabled = useRef(weekendOvertimeEnabled)
  
  useEffect(() => {
    // Only apply weekend overtime logic when the setting is explicitly toggled, not on every row change
    const settingChanged = previousWeekendOvertimeEnabled.current !== weekendOvertimeEnabled
    previousWeekendOvertimeEnabled.current = weekendOvertimeEnabled
    
    if (!settingChanged) return // Don't auto-apply on every row change
    
    if (weekendOvertimeEnabled && overtimeEnabled) {
      // Saturday = day 5, Sunday = day 6
      for (const dayIndex of [5, 6]) {
        const dayRows = rowsByDay[dayIndex] || []
        dayRows.forEach((row) => {
          if (row.totalHours > 0) {
            const totalHours = (row.slots?.filter(Boolean).length || 0) * 0.25
            // Auto-set overtime to total hours for weekend days
            updateRow(dayIndex, row.id, (r: any) => ({ ...r, overtimeHours: totalHours }))
          }
        })
      }
    } else if (!weekendOvertimeEnabled) {
      // Clear weekend overtime when the setting is disabled
      for (const dayIndex of [5, 6]) {
        const dayRows = rowsByDay[dayIndex] || []
        dayRows.forEach((row) => {
          if (row.overtimeHours > 0) {
            updateRow(dayIndex, row.id, (r: any) => ({ ...r, overtimeHours: 0 }))
          }
        })
      }
    }
  }, [weekendOvertimeEnabled, overtimeEnabled])

  if (!settingsLoaded) {
    return (
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ textAlign: 'center' }}>Loading timesheet...</div>
      </div>
    )
  }

  return (
    <div 
      style={{ padding: 0, display: 'flex', flexDirection: 'column', width: '100%', overflowX: 'hidden' }}
      onClick={(e) => {
        // Deselect segment when clicking outside
        if (e.target === e.currentTarget) {
          setSelectedSegment(null)
        }
      }}
    >
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        <DayTabs weekStart={weekStart} activeDay={activeDay} onSelect={setActiveDay} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>
              Week commencing:
            </label>
            <input
              type="date"
              value={formatDateInput(weekStart)}
              onChange={e => setWeekStart(new Date((e.target as HTMLInputElement).value))}
              style={{ 
                fontSize: '13px', 
                padding: '6px 8px', 
                border: '1px solid var(--border)', 
                borderRadius: '6px',
                background: 'var(--surface)'
              }}
            />
            {submittedWeek === getLocalDateString(weekStart) && (
              <div 
                onClick={() => {
                  // Show available weeks to navigate to
                  const availableWeeks = Object.keys(submittedTimesheets).sort().reverse()
                  if (availableWeeks.length > 1) {
                    const weekOptions = availableWeeks.map(week => 
                      `${new Date(week).toLocaleDateString()} (${submittedTimesheets[week].summary?.totalHours?.toFixed(1) || '0'}h)`
                    ).join('\n')
                    toast.info(`Available submitted weeks:\n${weekOptions}\n\nNavigating to the most recent week.`)
                    if (availableWeeks.length > 0) {
                      navigateToWeek(availableWeeks[0])
                    }
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px',
                  background: 'var(--success)',
                  color: 'white',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                title="Click to view other submitted weeks"
              >
                ✓ Submitted
              </div>
            )}
          </div>
          <button 
            onClick={showSubmitConfirmation}
            style={{
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Submit
          </button>
        </div>
      </div>
      <div style={{ marginTop: 0, padding: 16, display: 'grid', gap: 16, gridTemplateRows: 'auto auto auto', overflow: 'visible', width: '100%', minWidth: 0 }}>
        <DashboardCards summary={summary} todaysBookings={todaysBookings} projects={projects} recentJobs={recentJobs} />
        
        {/* Live Timer (hidden for now) */}
        {false && (
        <div style={{
          border: timerRunning ? '2px solid var(--success)' : '1px solid var(--border)',
          borderRadius: 12,
          padding: 16,
          background: timerRunning ? 'var(--success-light)' : 'var(--surface)',
          display: 'grid',
          gap: 12,
          boxShadow: timerRunning ? '0 4px 6px rgba(16, 185, 129, 0.1)' : '0 1px 2px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: timerRunning ? '#065f46' : '#374151' }}>
                ⏱️ Live Time Tracker
              </span>
              {timerRunning && (
                <div style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: 'var(--success)',
                  fontFamily: 'monospace',
                  letterSpacing: '0.05em'
                }}>
                  {formatTimerDuration(timerElapsed)}
                </div>
              )}
            </div>
            {!timerRunning ? (
              <button
                onClick={startTimer}
                disabled={!timerJobNumber}
                style={{
                  background: timerJobNumber ? 'var(--success)' : 'var(--text-tertiary)',
                  color: 'white',
                  border: 'none',
                  padding: '8px 20px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: timerJobNumber ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.2s'
                }}
              >
                ▶ Start Timer
              </button>
            ) : (
              <button
                onClick={stopTimer}
                style={{
                  background: 'var(--error)',
                  color: 'white',
                  border: 'none',
                  padding: '8px 20px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  animation: 'pulse 2s infinite'
                }}
              >
                ⏹ Stop Timer
              </button>
            )}
          </div>
          
          {!timerRunning && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <SearchableProjectDropdown
                value={timerJobNumber}
                onChange={setTimerJobNumber}
                projects={projects}
                placeholder="Search projects..."
              />
              <small style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                for {DAYS[activeDay]}
              </small>
            </div>
          )}
          
          {timerRunning && (
            <div style={{ fontSize: 13, color: 'var(--success-dark)' }}>
              Tracking: <strong>{timerJobNumber}</strong> • {DAYS[activeDay]}
            </div>
          )}
        </div>
        )}

        <section style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', width: '100%', minWidth: 0, overflowX: 'hidden', overflowY: 'visible' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: 0 }}>{DAYS[activeDay]}</h3>
              {selectedSegment && (
                <small style={{ color: 'var(--muted)', fontSize: 12 }}>
                  Selected segment • Press Delete/Backspace to remove
                </small>
              )}
            </div>
            <button onClick={() => addRow(activeDay)} style={{ background: 'var(--primary)', borderColor: 'var(--primary)' }}>Add job</button>
          </div>
          <div style={{ display: 'grid', gap: 8, marginTop: 8, overflowX: 'auto' }}>
            <TimelineHeader
              timelineStartHour={timelineStartHour}
              timelineDuration={timelineDuration}
              totalSlots={totalSlots}
              overtimeEnabled={overtimeEnabled}
              headerTimelineRef={headerTimelineRef}
            />
            {rowsByDay[activeDay]?.map((row: any, rowIdx: number) => (
              <Row
                key={row.id}
                row={row}
                dayIndex={activeDay}
                totalSlots={totalSlots}
                timelineStartHour={timelineStartHour}
                overlaps={overlaps}
                onChangeJob={(num: string) => updateRow(activeDay, row.id, (r: any) => ({ ...r, jobNumber: num }))}
                onChangeOvertime={(hours: number) => {
                  if (!overtimeEnabled) return // Don't allow changes if overtime is disabled
                  updateRow(activeDay, row.id, (r: any) => ({ ...r, overtimeHours: Math.max(0, Math.min(hours, r.totalHours)) }))
                }}
                onRemove={() => removeRow(activeDay, row.id)}
                onMouseDownCell={(slot: number, e: any) => onMouseDownCell(activeDay, row, slot, e)}
                onMouseDownHandle={(slot: number, handle: 'left' | 'right') => onMouseDownHandle(activeDay, row, slot, handle)}
                trackDomId={trackId(activeDay, row.id)}
                projects={projects}
                recentJobs={recentJobs}
                overtimeEnabled={overtimeEnabled}
                selectedSegment={selectedSegment}
                setSelectedSegment={setSelectedSegment}
                deleteSegment={deleteSegment}
                trackRef={rowIdx === 0 ? firstRowTrackRef : undefined}
              />
            ))}
          </div>
          
          {/* Overtime is now tracked per job - see the O/T input box at the end of each row */}
        </section>

        {/* Per-day Notes – now shown directly under the timeline/job entry card */}
        <div style={{
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 16,
          background: 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          marginTop: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 14 }}>Notes for {DAYS[activeDay]}</h3>
              <small style={{ color: 'var(--muted)', fontSize: 12 }}>
                Add any comments or context for this day (e.g. exceptions, approvals, special cases).
              </small>
            </div>
          </div>
          <textarea
            value={dayNotes[activeDay] || ''}
            onChange={e => {
              const next = [...dayNotes]
              next[activeDay] = e.target.value
              setDayNotes(next)
              scheduleAutoSave()
            }}
            style={{
              width: '100%',
              minHeight: 80,
              resize: 'vertical',
              padding: 8,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-primary)',
              fontSize: 13,
              fontFamily: 'inherit',
              color: 'var(--text-primary)'
            }}
            placeholder="Add notes for this day…"
          />
        </div>

        <WeeklySummary summary={summary} />
      </div>
      
      {/* Overlap Warning Dialog */}
      {showOverlapWarning && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50
        }}>
          <div style={{
            background: 'var(--card)',
            border: '2px solid var(--error)',
            borderRadius: 12,
            padding: 24,
            maxWidth: '500px',
            width: '90vw',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 10px 25px rgba(239, 68, 68, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <span style={{ fontSize: '32px' }}>⚠️</span>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: 'var(--error)' }}>
                Time Overlap Detected
              </h3>
            </div>
            <p style={{ margin: 0, marginBottom: 16, color: 'var(--muted)', lineHeight: 1.5 }}>
              Multiple jobs are assigned to the same time slots. Please review the overlaps below:
            </p>
            
            <div style={{ 
              background: 'var(--error-light)', 
              border: '1px solid var(--error-border)', 
              borderRadius: 8, 
              padding: 12,
              marginBottom: 20,
              maxHeight: '300px',
              overflowY: 'auto'
            }}>
              {overlapDetails.map((overlap, idx) => (
                <div key={idx} style={{ 
                  marginBottom: idx < overlapDetails.length - 1 ? 12 : 0,
                  paddingBottom: idx < overlapDetails.length - 1 ? 12 : 0,
                  borderBottom: idx < overlapDetails.length - 1 ? '1px solid var(--error-border)' : 'none'
                }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--error-dark)', marginBottom: 4 }}>
                    {overlap.day} at {overlap.time}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--error-dark)' }}>
                    Overlapping jobs: <strong>{overlap.jobs.join(', ')}</strong>
                  </div>
                </div>
              ))}
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
              You can either go back and fix the overlaps, or proceed with submission anyway. 
              Overlapping time entries may cause issues with reporting and billing.
            </p>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={dismissOverlapWarning}
                style={{
                  background: 'var(--primary)',
                  color: 'white',
                  border: '1px solid var(--primary)',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Go Back & Fix
              </button>
              <button
                onClick={proceedDespiteOverlaps}
                style={{
                  background: 'var(--error)',
                  color: 'white',
                  border: '1px solid var(--error)',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Proceed Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submission Confirmation Dialog */}
      {showConfirmDialog && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50
        }}>
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 24,
            maxWidth: '400px',
            width: '90vw',
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: 0, marginBottom: 16, fontSize: '18px', fontWeight: '600' }}>
              Submit Timesheet
            </h3>
            <p style={{ margin: 0, marginBottom: 20, color: 'var(--muted)', lineHeight: 1.5 }}>
              Are you sure you want to submit this timesheet for the week commencing{' '}
              <strong>{weekStart.toLocaleDateString()}</strong>?
            </p>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '14px', marginBottom: 8, fontWeight: '500' }}>Summary:</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                • Total Hours: <strong>{(summary?.totalHours || 0).toFixed(2)}</strong>
              </div>
              {summary?.overtimeEnabled && (
                <>
                  <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                    • Standard Hours: <strong>{(summary?.standardHours || 0).toFixed(2)}</strong>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--warning)' }}>
                    • Overtime Hours: <strong>{(summary?.overtimeHours || 0).toFixed(2)}</strong>
                  </div>
                </>
              )}
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                • Jobs: <strong>{summary?.byJob?.size || 0}</strong>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={cancelSubmit}
                style={{
                  background: 'transparent',
                  color: 'var(--muted)',
                  border: '1px solid var(--border)',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmSubmit}
                style={{
                  background: 'var(--primary)',
                  color: 'white',
                  border: '1px solid var(--primary)',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Submit Timesheet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ row, dayIndex, totalSlots, timelineStartHour, overlaps, onChangeJob, onChangeOvertime, onRemove, onMouseDownCell, onMouseDownHandle, trackDomId, overtimeEnabled, selectedSegment, setSelectedSegment, deleteSegment, trackRef, projects, recentJobs }: any) {
  const hours = useMemo(() => Array.from({ length: totalSlots }, (_, i) => i), [totalSlots])
  return (
    <div style={{ display: 'grid', gridTemplateColumns: overtimeEnabled ? 'minmax(100px, 180px) 1fr auto auto auto' : 'minmax(100px, 180px) 1fr auto auto', alignItems: 'stretch', gap: 4, width: '100%', minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 4, minHeight: 36 }}>
        <SearchableProjectDropdown
          value={row.jobNumber}
          onChange={onChangeJob}
          projects={projects}
          placeholder="Search projects..."
          style={{ fontSize: '12px', minHeight: 36, height: 36 }}
          recentJobs={recentJobs}
        />
      </div>
      <div ref={trackRef} id={trackDomId} style={{ position: 'relative', height: 36, background: 'var(--track)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', display: 'grid', gridTemplateColumns: `repeat(${totalSlots}, 1fr)`, minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', isolation: 'isolate' }}>
        {hours.map(i => (
          <div
            key={i}
            onMouseDown={e => onMouseDownCell(i, e)}
            style={{ cursor: 'crosshair', borderLeft: i % 4 === 0 ? '1px solid var(--border)' : '1px dashed var(--bg-tertiary)', background: row.slots[i] ? (overlaps[i] ? 'var(--danger-200)' : 'var(--primary-100)') : 'transparent' }}
            title={slotLabel(timelineStartHour, i)}
          />
        ))}
        {renderSegments(row, dayIndex, totalSlots, onMouseDownHandle, overlaps, onMouseDownCell, selectedSegment, setSelectedSegment, deleteSegment)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
        <div title={row.totalHours.toFixed(2)} style={{ fontVariantNumeric: 'tabular-nums', fontSize: '12px', minWidth: '35px', textAlign: 'right' }}>{row.totalHours.toFixed(2)}</div>
        {overtimeEnabled && (
          <input
            type="number"
            min="0"
            max={row.totalHours}
            step="0.25"
            value={row.overtimeHours || 0}
            onChange={(e) => {
              const value = parseFloat(e.target.value) || 0
              // Ensure value doesn't exceed total hours and is not negative
              const clampedValue = Math.max(0, Math.min(value, row.totalHours))
              onChangeOvertime(clampedValue)
            }}
            placeholder="O/T"
            title="Overtime hours"
            style={{
              fontSize: '11px',
              padding: '0 6px',
              width: '45px',
              height: 36,
              boxSizing: 'border-box',
              textAlign: 'right',
              border: '1px solid var(--border)',
              borderRadius: 4,
              background: row.overtimeHours > 0 ? 'var(--warning-light)' : 'var(--surface)'
            }}
          />
        )}
        <button 
          onClick={onRemove} 
          aria-label="Remove row" 
          title="Remove"
          style={{ 
            fontSize: '12px', 
            padding: '4px 6px', 
            minWidth: '20px', 
            height: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >✕</button>
      </div>
    </div>
  )
}

function renderSegments(row: any, dayIndex: number, totalSlots: number, onMouseDownHandle: any, overlaps: boolean[], onMouseDownCell: any, selectedSegment: any, setSelectedSegment: any, deleteSegment: any) {
  const segs = getSegments(row.slots)
  if (segs.length === 0) return null
  return (
    <>
      {segs.map((seg: any, idx: number) => {
        const leftPercent = (seg.start / totalSlots) * 100
        const widthPercent = ((seg.end - seg.start + 1) / totalSlots) * 100
        let hasOverlap = false
        for (let i = seg.start; i <= seg.end; i++) if (row.slots[i] && overlaps?.[i]) { hasOverlap = true; break }

        const isSelected = selectedSegment && 
          selectedSegment.dayIndex === dayIndex && 
          selectedSegment.rowId === row.id && 
          selectedSegment.start === seg.start && 
          selectedSegment.end === seg.end

        return (
          <div
            key={idx}
            style={{
              position: 'absolute',
              left: `${leftPercent}%`,
              width: `${widthPercent}%`,
              top: 0,
              bottom: 0,
              background: hasOverlap ? 'var(--danger-200)' : 'var(--primary-200)',
              border: `2px solid ${hasOverlap ? 'var(--danger-700)' : (isSelected ? 'var(--warning)' : 'var(--primary)')}`,
              borderRadius: 6,
              pointerEvents: 'auto',
              boxShadow: isSelected ? '0 0 0 2px var(--warning)' : '0 1px 2px rgba(0,0,0,0.06)',
              zIndex: isSelected ? 3 : 2,
              cursor: 'move',
              overflow: 'hidden'
            }}
            onClick={(e) => {
              // Select segment on click
              e.stopPropagation()
              setSelectedSegment({ dayIndex, rowId: row.id, start: seg.start, end: seg.end })
            }}
            onMouseDown={(e) => {
              // Check if clicking on resize handles
              const rect = e.currentTarget.getBoundingClientRect()
              const relativeX = e.clientX - rect.left
              const handleWidth = 12
              const totalWidth = rect.width

              if (relativeX <= handleWidth) {
                // Left handle
                e.preventDefault()
                e.stopPropagation()
                onMouseDownHandle(seg.start, 'left')
              } else if (relativeX >= totalWidth - handleWidth) {
                // Right handle
                e.preventDefault()
                e.stopPropagation()
                onMouseDownHandle(seg.end, 'right')
              } else {
                // Middle - move the segment
                e.preventDefault()
                e.stopPropagation()
                const middleSlot = Math.floor(seg.start + (seg.end - seg.start) / 2)
                onMouseDownCell(middleSlot, e)
              }
            }}
          />
        )
      })}
    </>
  )
}

function TimelineHeader({ timelineStartHour, timelineDuration, totalSlots, overtimeEnabled, headerTimelineRef }: any) {
  const hours = Array.from({ length: timelineDuration }, (_: any, i: number) => (timelineStartHour + i) % 24)
  // Use the exact same grid structure as Row component
  return (
    <div style={{ display: 'grid', gridTemplateColumns: overtimeEnabled ? 'minmax(100px, 180px) 1fr auto auto auto' : 'minmax(100px, 180px) 1fr auto auto', alignItems: 'center', gap: 4, width: '100%', minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 4, minWidth: 0 }}>
        {/* Empty space to match the job input column in rows - same structure */}
        <div style={{ minWidth: '40px' }}></div>
        <div style={{ flex: 1, minWidth: 0 }}></div>
      </div>
      <div ref={headerTimelineRef} style={{ height: 20, display: 'grid', gridTemplateColumns: `repeat(${totalSlots}, 1fr)`, minWidth: 0, maxWidth: '100%', position: 'relative', boxSizing: 'border-box', border: '1px solid transparent', borderRadius: 8 }}>
        {Array.from({ length: totalSlots }, (_, slotIndex) => {
          // Check if this slot is the start of an hour (slot 0, 4, 8, 12, etc.)
          if (slotIndex % 4 === 0) {
            const hourIdx = slotIndex / 4
            if (hourIdx < hours.length) {
              const h = hours[hourIdx]
              const disp = h % 12 || 12
              const mer = h >= 12 ? 'PM' : 'AM'
              return (
                <div 
                  key={slotIndex}
                  style={{ 
                    fontSize: 12, 
                    color: 'var(--text-secondary)',
                    fontWeight: 500,
                    paddingLeft: '2px',
                    alignSelf: 'start',
                    position: 'relative'
                  }}
                >
                  {disp}{mer}
                </div>
              )
            }
          }
          return <div key={slotIndex} />
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
        {/* Empty space to match the hours column in rows */}
      </div>
      <div>
        {/* Empty space to match the remove button column in rows */}
      </div>
      {overtimeEnabled && (
        <div>
          {/* Empty space to match the overtime column in rows */}
        </div>
      )}
    </div>
  )
}

function getSegments(slots: boolean[]) {
  const segs: any[] = []
  let i = 0
  while (i < slots.length) {
    if (slots[i]) {
      let j = i
      while (j + 1 < slots.length && slots[j + 1]) j++
      segs.push({ start: i, end: j })
      i = j + 1
    } else i++
  }
  return segs
}

function getSegmentAt(slots: boolean[], idx: number) {
  const segs = getSegments(slots)
  return segs.find((s: any) => idx >= s.start && idx <= s.end)
}

function getSegmentNearEdge(slots: boolean[], idx: number) {
  const segs = getSegments(slots)
  const near = 1
  return segs.find((s: any) => Math.abs(idx - s.start) <= near || Math.abs(idx - s.end) <= near)
}

function formatDateInput(d: Date) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) }

// Helper function to get today's index within the week (0-6, where 0 is Monday)
function todayIndexForWeek(weekStart: Date) {
  const monday = startOfWeek(weekStart)
  const today = normalizeToMidnight(new Date())
  const mondayNormalized = normalizeToMidnight(monday)
  const diffDays = Math.floor((today.getTime() - mondayNormalized.getTime()) / 86400000)
  if (diffDays < 0 || diffDays > 6) return 0
  return diffDays
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function formatDayLabel(weekStart: Date, index: number) {
  const dt = addDays(startOfWeek(weekStart), index)
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function DayTabs({ weekStart, activeDay, onSelect }: any) {
  const abbr = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {DAYS.map((name, i) => {
        const isActive = i === activeDay
        const dt = addDays(startOfWeek(weekStart), i)
        const dayNum = dt.getDate()
        return (
          <button 
            key={name} 
            onClick={() => onSelect(i)} 
            style={{ 
              padding: '6px 10px', 
              borderRadius: '8px', 
              border: isActive ? '1px solid var(--primary)' : '1px solid var(--border)', 
              background: isActive ? 'var(--primary)' : 'var(--surface)', 
              color: isActive ? 'white' : 'var(--text)', 
              fontSize: '12px', 
              fontWeight: isActive ? '600' : '500',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              minWidth: '100px'
            }}
          >
            <div style={{ fontSize: '11px', opacity: 0.8 }}>{abbr[i]}</div>
            <div style={{ fontSize: '13px', fontWeight: '600' }}>{dayNum}</div>
          </button>
        )
      })}
    </div>
  )
}

function computeWeeklySummary(rowsByDay: any[][], overtimeEnabled?: boolean) {
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
          overtimeTotal: 0
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
    overtimeEnabled 
  }
}

function computeOverlaps(rows: any[], totalSlots: number) {
  const counts = Array(totalSlots).fill(0)
  for (const r of rows) {
    for (let i = 0; i < totalSlots; i++) if (r.slots[i]) counts[i]++
  }
  return counts.map((c: number) => c > 1)
}

/** Last 5 job numbers used this week (by order of appearance in the grid), with optional title from projects */
function lastUsedJobsFromSummary(summary: any, projects: any[]): Array<{ jobNumber: string; title: string }> {
  if (!summary?.byJob?.size) return []
  const keys = Array.from(summary.byJob.keys()) as string[]
  const lastFive = keys.slice(-5)
  return lastFive.map((jobNumber: string) => {
    const project = projects?.find((p: any) => (p.code && String(p.code) === String(jobNumber)) || (p.name && String(p.name) === String(jobNumber)))
    const title = project?.name ?? jobNumber
    return { jobNumber, title }
  })
}

function DashboardCards({ summary, todaysBookings, projects, recentJobs }: any) {
  const cardStyle: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, padding: 16, background: 'var(--surface)', display: 'grid', gap: 4 }
  const valueStyle: React.CSSProperties = { fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }
  const labelStyle: React.CSSProperties = { fontSize: 13, color: 'var(--text-secondary)' }
  
  // Process all today's bookings
  const todaysJobs = todaysBookings && todaysBookings.length > 0 ? todaysBookings.map((booking: any) => {
    const project = projects.find((p: any) => p.id === booking.project_id)
    return {
      title: booking.title || 'No title',
      projectCode: project?.code || booking.project_id || '',
      projectName: project?.name || '',
      startTime: booking.start_time || null,
      endTime: booking.end_time || null,
      hours: booking.hours || null,
      bookerName: booking.booker_name || '',
      booking: booking
    }
  }) : []
  
  // Calculate grid columns based on what we're showing
  const hasOvertime = summary?.overtimeEnabled
  const hasTodaysJobs = todaysJobs.length > 0
  const hasMultipleJobs = todaysJobs.length > 1

  // Determine how many summary cards we are showing so they can evenly fill the row width
  const summaryCardCount =
    (todaysJobs.length === 1 ? 1 : 0) + // Today's Job (single)
    1 + // Total Hours (This Week)
    (summary?.overtimeEnabled ? 2 : 0) // Standard + Overtime hours when enabled
  const summaryGridCols = `repeat(${Math.max(summaryCardCount, 1)}, minmax(0, 1fr))`
  
  return (
    <>
      {/* Today's Jobs - Full width row when multiple jobs, otherwise in grid */}
      {hasMultipleJobs && (
        <div style={{ width: '100%', marginBottom: 12 }}>
          <div style={{ 
            fontSize: 13, 
            color: 'var(--text-secondary)', 
            marginBottom: 12,
            fontWeight: 500
          }}>
            Today's Jobs ({todaysJobs.length})
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
            gap: 12 
          }}>
            {todaysJobs.map((jobInfo: any, index: number) => {
              return (
                <div
                  key={index}
                  style={{
                    border: '1px solid var(--accent-primary)',
                    borderRadius: 12,
                    padding: 14,
                    background: 'var(--accent-primary-light)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    position: 'relative',
                    height: '100%'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                    e.currentTarget.style.borderColor = 'var(--accent-primary-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  }}
                >
                  <div style={{ 
                    position: 'absolute', 
                    top: 8, 
                    right: 12,
                    fontSize: 11, 
                    fontWeight: 700,
                    background: 'var(--accent-primary)',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: 12,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {index + 1}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-primary-dark)', marginBottom: 8, lineHeight: 1.2, paddingRight: '40px' }}>
                    {jobInfo.projectCode ? `${jobInfo.projectCode} - ${jobInfo.projectName}` : jobInfo.title}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {jobInfo.startTime && jobInfo.endTime && (
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>🕐</span>
                        <span>{formatTimeFromString(jobInfo.startTime)} - {formatTimeFromString(jobInfo.endTime)}</span>
                      </div>
                    )}
                    {jobInfo.hours && (
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>⏱</span>
                        <span>{jobInfo.hours} hrs per day</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      
      {/* Main dashboard cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: summaryGridCols, gap: 12 }}>
        {/* Single job card - only show if there's exactly one job */}
        {todaysJobs.length === 1 && (
          <div style={{ ...cardStyle, border: '1px solid var(--accent-primary)', background: 'var(--accent-primary-light)' }}>
            <div style={{ ...labelStyle, color: 'var(--accent-primary-dark)' }}>Today's Job</div>
            <div style={{ ...valueStyle, fontSize: 20, color: 'var(--accent-primary-dark)' }}>
              {todaysJobs[0].projectCode ? `${todaysJobs[0].projectCode} - ${todaysJobs[0].projectName}` : todaysJobs[0].title}
            </div>
            {todaysJobs[0].startTime && todaysJobs[0].endTime && (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                {formatTimeFromString(todaysJobs[0].startTime)} - {formatTimeFromString(todaysJobs[0].endTime)}
              </div>
            )}
            {todaysJobs[0].hours && (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {todaysJobs[0].hours} hrs per day
              </div>
            )}
            {todaysJobs[0].bookerName && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Booked by <strong>{todaysJobs[0].bookerName}</strong>
              </div>
            )}
          </div>
        )}
      <div style={cardStyle}>
        <div style={labelStyle}>Total Hours (This Week)</div>
        <div style={valueStyle}>{summary.totalHours.toFixed(2)}</div>
      </div>
      {summary?.overtimeEnabled && (
        <>
          <div style={cardStyle}>
            <div style={labelStyle}>Standard Hours</div>
            <div style={{ ...valueStyle, fontSize: 24 }}>{(summary.standardHours || 0).toFixed(2)}</div>
          </div>
          <div style={{ ...cardStyle, border: '1px solid var(--warning)', background: 'var(--warning-light)' }}>
            <div style={{ ...labelStyle, color: 'var(--warning-dark)' }}>Overtime Hours</div>
            <div style={{ ...valueStyle, fontSize: 24, color: 'var(--warning-dark)' }}>{(summary.overtimeHours || 0).toFixed(2)}</div>
          </div>
        </>
      )}
      <div style={{ ...cardStyle, gridColumn: '1 / -1', minWidth: 0 }}>
        <div style={labelStyle}>Most Recent Job Numbers</div>
        {recentJobs.length === 0 ? (
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>No jobs used yet this week</div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recentJobs.map((job: { jobNumber: string; title: string }, i: number) => {
              const jobNumber = job.jobNumber
              const title = job.title
              return (
                <li key={`${jobNumber}-${i}`} style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                  <strong>{jobNumber}</strong>
                  {title !== jobNumber && <span style={{ color: 'var(--text-secondary)' }}> — {title}</span>}
                </li>
              )
            })}
          </ul>
        )}
      </div>
      </div>
    </>
  )
}

function formatTimeFromString(timeStr: string): string {
  if (!timeStr) return ''
  // timeStr is in format "HH:MM" (24-hour)
  const [hour, minute] = timeStr.split(':').map(Number)
  return formatTime(hour, minute)
}

function WeeklySummary({ summary }: any) {
  const days = DAYS
  const overtimeByDay = summary.overtimeByDay || Array(7).fill(0)
  const standardByDay = summary.standardByDay || summary.dayTotals
  
  return (
    <section style={{ border: '1px solid var(--border,#ddd)', borderRadius: 8, padding: 12, overflowX: 'auto' }}>
      <h3 style={{ marginTop: 0 }}>Weekly Summary</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th align="left" style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>Job Number</th>
            {days.map(d => (
              <th key={d} style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>{d}</th>
            ))}
            <th style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {(Array.from(summary.byJob.entries()) as [string, any][]).map(([job, entry]) => (
            <tr key={job}>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>{job}</td>
              {entry.days.map((h: number, idx: number) => (
                <td key={idx} style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>{h.toFixed(2)}</td>
              ))}
              <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', textAlign: 'right', fontWeight: 600 }}>{entry.total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {summary.overtimeEnabled && (
            <>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <td style={{ padding: '6px 8px', borderTop: '1px solid var(--border)', fontWeight: 600, color: 'var(--text-primary)' }}>Standard Hours</td>
                {standardByDay.map((h: number, idx: number) => (
                  <td key={idx} style={{ padding: '6px 8px', borderTop: '1px solid var(--border)', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>{h.toFixed(2)}</td>
                ))}
                <td style={{ padding: '6px 8px', borderTop: '1px solid var(--border)', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>{(summary.standardHours || 0).toFixed(2)}</td>
              </tr>
              <tr style={{ background: 'var(--warning-light)' }}>
                <td style={{ padding: '6px 8px', fontWeight: 600, color: 'var(--warning-dark)' }}>Overtime Hours</td>
                {overtimeByDay.map((h: number, idx: number) => (
                  <td key={idx} style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--warning-dark)' }}>{h.toFixed(2)}</td>
                ))}
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--warning-dark)' }}>{(summary.overtimeHours || 0).toFixed(2)}</td>
              </tr>
            </>
          )}
          <tr style={{ background: 'var(--bg-tertiary)' }}>
            <td style={{ padding: '6px 8px', borderTop: '2px solid var(--border-strong)', fontWeight: 700 }}>Total Hours</td>
            {summary.dayTotals.map((h: number, idx: number) => (
              <td key={idx} style={{ padding: '6px 8px', borderTop: '2px solid var(--border-strong)', textAlign: 'right', fontWeight: 700 }}>{h.toFixed(2)}</td>
            ))}
            <td style={{ padding: '6px 8px', borderTop: '2px solid var(--border-strong)', textAlign: 'right', fontWeight: 700, fontSize: '15px' }}>{summary.totalHours.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  )
}

function hydrateSlotsFromSavedRow(savedRow: any, totalSlots: number) {
  if (savedRow?.s != null && typeof savedRow.s === 'string' && savedRow.s.length > 0) {
    return base64ToSlots(savedRow.s, totalSlots)
  }
  const slots = Array(totalSlots).fill(false)
  const arr = Array.isArray(savedRow?.timeSlots) ? savedRow.timeSlots : []
  for (const s of arr) {
    if (typeof s === 'object') {
      const idx = (s as any).timeIndex|0; if (idx >= 0 && idx < totalSlots) slots[idx] = !!(s as any).filled
    }
  }
  return slots
}

// Searchable project popup – opens a modal to search by job number, name or client
function SearchableProjectDropdown({
  value,
  onChange,
  projects,
  placeholder,
  style,
  recentJobs
}: {
  value: string
  onChange: (value: string) => void
  projects: any[]
  placeholder?: string
  style?: React.CSSProperties
  recentJobs?: { jobNumber: string; title: string }[]
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Filter projects by job number, name or client
  const projectsWithCodes = useMemo(() =>
    projects.filter(p => (p.code || '').toString().trim() !== ''),
    [projects]
  )
  const filteredProjects = useMemo(() => {
    if (!searchTerm.trim()) return projectsWithCodes
    const term = searchTerm.toLowerCase()
    return projectsWithCodes.filter(p => {
      const code = (p.code || p.id || '').toString().toLowerCase()
      const name = (p.name || '').toString().toLowerCase()
      const client = ((p.client_name || p.clientName || '')).toString().toLowerCase()
      return code.includes(term) || name.includes(term) || client.includes(term)
    })
  }, [projectsWithCodes, searchTerm])

  // Close on Escape; focus search when modal opens
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        setSearchTerm('')
      }
    }
    document.addEventListener('keydown', onKeyDown)
    const t = setTimeout(() => searchInputRef.current?.focus(), 50)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      clearTimeout(t)
    }
  }, [isOpen])

  const displayValue = useMemo(() => {
    if (!value) return ''
    const project = projects.find(p => (p.code || p.id || '').toString() === value)
    if (project) {
      const code = (project.code || project.id || '').toString()
      const name = (project.name || '').toString().trim()
      return name ? `${code} – ${name}` : code
    }
    return value
  }, [value, projects])

  const openPopup = () => {
    setIsOpen(true)
    setSearchTerm('')
  }

  const handleSelect = (project: any) => {
    const code = (project.code || project.id || '').toString()
    onChange(code)
    setIsOpen(false)
    setSearchTerm('')
  }

  const closePopup = () => {
    setIsOpen(false)
    setSearchTerm('')
  }

  const fontSize = style?.fontSize || '13px'
  const isCompact = fontSize === '12px'
  const hasExplicitHeight = style && ('height' in style || 'minHeight' in style)

  return (
    <>
      <div style={{ position: 'relative', flex: 1, display: 'flex', ...style }}>
        <input
          ref={inputRef}
          type="text"
          readOnly
          value={displayValue}
          onFocus={openPopup}
          onClick={openPopup}
          placeholder={placeholder || 'Search projects...'}
          style={{
            width: '100%',
            height: hasExplicitHeight ? '100%' : undefined,
            boxSizing: 'border-box',
            padding: isCompact ? '4px 6px' : '8px 12px',
            border: '1px solid var(--border)',
            borderRadius: isCompact ? '4px' : '6px',
            fontSize: fontSize,
            background: 'var(--surface)',
            color: 'var(--text-primary)',
            cursor: 'pointer'
          }}
        />
      </div>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Select job"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--modal-backdrop)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 24
          }}
          onClick={e => e.target === e.currentTarget && closePopup()}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              width: '100%',
              maxWidth: 480,
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px', borderBottom: '1px solid var(--border)', gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
                Select job
              </h2>
              <button
                type="button"
                onClick={closePopup}
                aria-label="Close"
                style={{
                  padding: 6,
                  border: 'none',
                  background: 'transparent',
                  borderRadius: 6,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 18,
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: 12, paddingBottom: 8 }}>
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search by job number, name or client..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 14,
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {recentJobs && recentJobs.length > 0 && (
              <div style={{ padding: '0 12px 8px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Recent job numbers
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {recentJobs.map(({ jobNumber, title }) => {
                    const labelTitle = title && title !== jobNumber ? title : ''
                    const isSelected = jobNumber === value
                    return (
                      <button
                        key={jobNumber}
                        type="button"
                        onClick={() => {
                          const project =
                            projectsWithCodes.find(p => (p.code || p.id || '').toString() === jobNumber) || null
                          if (project) {
                            handleSelect(project)
                          } else {
                            onChange(jobNumber)
                            closePopup()
                          }
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 10px',
                          borderRadius: 999,
                          border: '1px solid ' + (isSelected ? 'var(--accent-primary)' : 'var(--border)'),
                          background: isSelected ? 'var(--accent-primary-light)' : 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          fontSize: 12,
                          cursor: 'pointer'
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{jobNumber}</span>
                        {labelTitle && (
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
                            {labelTitle}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', minHeight: 200, maxHeight: 400 }}>
              {filteredProjects.length === 0 ? (
                <div style={{ padding: 24, color: 'var(--text-secondary)', fontSize: 14, textAlign: 'center' }}>
                  {searchTerm.trim() ? 'No projects match your search.' : 'No projects with job numbers.'}
                </div>
              ) : (
                filteredProjects.map(project => {
                  const code = (project.code || project.id || '').toString()
                  const name = project.name || ''
                  const client = project.client_name || project.clientName || ''
                  const isSelected = code === value
                  return (
                    <div
                      key={project.id || code}
                      onClick={() => handleSelect(project)}
                      style={{
                        padding: '12px 16px',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border)',
                        background: isSelected ? 'var(--accent-primary-light)' : 'transparent',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => {
                        if (!isSelected) e.currentTarget.style.background = 'var(--bg-secondary)'
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span>{code}</span>
                        {name && (
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: 13 }}>
                            {name}
                          </span>
                        )}
                      </div>
                      {client && (
                        <div style={{ color: 'var(--text-tertiary)', fontSize: 12, marginTop: 4 }}>
                          {client}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}



