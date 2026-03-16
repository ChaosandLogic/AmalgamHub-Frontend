'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '../../components/Toast'
import { clamp, getDateForDay, getLocalDateString, parseLocalDateString, normalizeToMidnight, getDayIndex } from '../../lib/utils/dateUtils'
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api/client'
import { getResourceIcon, getResourceDefaultColor } from '../../lib/utils/resourceUtils'
import { 
  DAY_COLUMN_WIDTH, 
  ROW_HEIGHT, 
  MONTHS_TO_DISPLAY
} from '../../lib/constants/schedule'
import type { ResourceScheduleProps } from '../../lib/types/schedule'
import { calculateBookingLanes } from '../utils/calculateBookingLanes'
import TimelineHeader from './TimelineHeader'
import ResourceRow from './ResourceRow'
import BookingDialog from './BookingDialog'

export default function ResourceSchedule({ monthStart, resources, projects, currentUser: currentUserProp }: ResourceScheduleProps) {
  const toast = useToast()
  const leftColumnRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const [userLocal, setUserLocal] = useState<{ role: string } | null>(null)
  const user = currentUserProp !== undefined ? currentUserProp : userLocal
  
  // Calculate total days for 6 months ahead
  const totalDays = useMemo(() => {
    const endDate = new Date(monthStart)
    endDate.setMonth(endDate.getMonth() + MONTHS_TO_DISPLAY)
    const diffTime = endDate.getTime() - monthStart.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }, [monthStart])
  
  // Bookings by resource and day: { resourceId: { dayIndex: Booking[] } }
  const [bookingsByResource, setBookingsByResource] = useState<Record<string, Record<number, any[]>>>({})
  const [showBookingDialog, setShowBookingDialog] = useState(false)
  const [newBookingData, setNewBookingData] = useState<any>(null)
  const [editingBooking, setEditingBooking] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  // Preview positions for bookings being dragged: { bookingId: { startDayIndex, endDayIndex, resourceId?, booking? } }
  const [dragPreview, setDragPreview] = useState<Record<string, { startDayIndex: number, endDayIndex: number, resourceId?: string, booking?: any }>>({})
  const [sortBy, setSortBy] = useState<'type' | 'name'>('type')
  const [filterBy, setFilterBy] = useState<string>('all')
  const [departmentFilter, setDepartmentFilter] = useState<string>('all')
  const [jobRoleFilter, setJobRoleFilter] = useState<string>('all')

  const projectsById = useMemo(() => {
    const map: Record<string, any> = {}
    projects?.forEach((p: any) => {
      if (p?.id) map[p.id] = p
    })
    return map
  }, [projects])

  // Get unique departments from person resources
  const availableDepartments = useMemo(() => {
    const departments = new Set<string>()
    resources
      .filter(r => (r.type || 'person').toLowerCase() === 'person' && r.department)
      .forEach(r => {
        if (r.department) {
          departments.add(r.department)
        }
      })
    return Array.from(departments).sort()
  }, [resources])

  // Get unique job roles from person resources
  const availableJobRoles = useMemo(() => {
    const roles = new Set<string>()
    resources
      .filter(r => (r.type || 'person').toLowerCase() === 'person' && r.job_role)
      .forEach(r => {
        if (r.job_role) {
          roles.add(r.job_role)
        }
      })
    return Array.from(roles).sort()
  }, [resources])

  // Filter and sort resources
  const filteredAndSortedResources = useMemo(() => {
    let filtered = resources
    
    // Filter by type
    if (filterBy !== 'all') {
      filtered = filtered.filter(r => (r.type || 'person').toLowerCase() === filterBy.toLowerCase())
      
      // If filtering by person, also filter by department and job role
      if (filterBy.toLowerCase() === 'person') {
        if (departmentFilter !== 'all') {
          filtered = filtered.filter(r => r.department === departmentFilter)
        }
        if (jobRoleFilter !== 'all') {
          filtered = filtered.filter(r => r.job_role === jobRoleFilter)
        }
      }
    }
    
    // Sort resources
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'type') {
        const typeA = (a.type || 'person').toLowerCase()
        const typeB = (b.type || 'person').toLowerCase()
        
        // Put people first, then everything else
        const isPersonA = typeA === 'person'
        const isPersonB = typeB === 'person'
        
        if (isPersonA && !isPersonB) return -1
        if (!isPersonA && isPersonB) return 1
        
        // If both are people or both are not people, sort by type then name
        if (typeA !== typeB) {
          return typeA.localeCompare(typeB)
        }
        // If types are the same, sort by name
        return (a.name || '').localeCompare(b.name || '')
      } else {
        // Sort by name
        return (a.name || '').localeCompare(b.name || '')
      }
    })
    
    return sorted
  }, [resources, filterBy, sortBy, departmentFilter, jobRoleFilter])
  
  const draggingRef = useRef<any>(null)
  const isDraggingRef = useRef(false)
  const nextBookingId = useRef(0)

  // Load bookings for the current month
  useEffect(() => {
    loadBookings()
  }, [monthStart, totalDays, resources])

  // Auto-sync public holidays when schedule loads
  useEffect(() => {
    syncPublicHolidays()
  }, [monthStart, totalDays])

  // Load current user (if not passed as prop) and users for project manager dropdown
  useEffect(() => {
    if (currentUserProp === undefined) loadCurrentUser()
    loadUsers()
  }, [currentUserProp])

  // Scroll timeline to today's date on initial load - position today as the first visible day
  useEffect(() => {
    // Use setTimeout to ensure DOM is fully rendered
    const timer = setTimeout(() => {
      if (timelineRef.current) {
        const today = normalizeToMidnight(new Date())
        const monthStartNormalized = normalizeToMidnight(new Date(monthStart))
        const todayDayIndex = Math.floor((today.getTime() - monthStartNormalized.getTime()) / (1000 * 60 * 60 * 24))
        
        // Only scroll if today is within the visible range
        if (todayDayIndex >= 0 && todayDayIndex < totalDays) {
          // Position today's column at the left edge of the timeline (first visible day)
          const scrollPosition = todayDayIndex * DAY_COLUMN_WIDTH
          // Ensure we don't scroll past the start
          timelineRef.current.scrollLeft = Math.max(0, scrollPosition)
        }
      }
    }, 100) // Small delay to ensure DOM is ready
    
    return () => clearTimeout(timer)
  }, [monthStart, totalDays]) // Run when monthStart or totalDays changes

  async function loadCurrentUser() {
    try {
      const data = await apiGet<{ user: any }>('/api/user')
      setUserLocal(data.user)
    } catch (error) {
      console.error('Error loading current user:', error)
    }
  }

  async function loadUsers() {
    try {
      const data = await apiGet<{ users: any[] }>('/api/users')
      setUsers(data.users || [])
    } catch (error) {
      console.error('Error loading users:', error)
    }
  }

  async function loadBookings() {
    try {
      const endDate = new Date(monthStart)
      endDate.setMonth(endDate.getMonth() + MONTHS_TO_DISPLAY)
      
      const data = await apiGet<{ bookings: any[] }>(
        `/api/bookings?startDate=${getLocalDateString(monthStart)}&endDate=${getLocalDateString(endDate)}`,
        { defaultErrorMessage: 'Failed to load bookings' }
      )
      const bookings = data.bookings || []
      
      // Group bookings by resource and day (use all resources, not filtered)
      const grouped: Record<string, Record<number, any[]>> = {}
      
      resources.forEach(resource => {
        grouped[resource.id] = {}
        for (let day = 0; day < totalDays; day++) {
          grouped[resource.id][day] = []
        }
      })
      
      bookings.forEach((booking: any) => {
        const bookingDate = parseLocalDateString(booking.start_date)
        const dayIndex = getDayIndex(bookingDate, monthStart)
        
        // Include bookings that start within the visible range
        // Also include bookings that span into the visible range (check end_date)
        const bookingEndDate = parseLocalDateString(booking.end_date || booking.start_date)
        const endDayIndex = getDayIndex(bookingEndDate, monthStart)
        
        // Add booking if it overlaps with the visible range
        if (grouped[booking.resource_id] && 
            ((dayIndex >= 0 && dayIndex < totalDays) || (endDayIndex >= 0 && endDayIndex < totalDays) || (dayIndex < 0 && endDayIndex >= totalDays))) {
          // Add to the day where it starts (or day 0 if it starts before, or last day if it starts after)
          const addDayIndex = Math.max(0, Math.min(dayIndex, totalDays - 1))
          grouped[booking.resource_id][addDayIndex].push(booking)
        }
      })
      
      setBookingsByResource(grouped)
    } catch (error) {
      console.error('Error loading bookings:', error)
      toast.error('Failed to load bookings')
    }
  }

  async function syncPublicHolidays() {
    try {
      const endDate = new Date(monthStart)
      endDate.setMonth(endDate.getMonth() + MONTHS_TO_DISPLAY)
      const result = await apiPost<{ success: boolean; created: number }>('/api/bookings/sync-holidays', {
        startDate: getLocalDateString(monthStart),
        endDate: getLocalDateString(endDate)
      })
      if (result.success && result.created > 0) {
        await loadBookings()
      }
    } catch {
      // Silently fail - holidays sync is optional
    }
  }

  function onMouseDownCell(resourceId: string, dayIndex: number, e: any) {
    e.preventDefault()
    e.stopPropagation() // Prevent event bubbling to booking elements
    
    // Only allow creating bookings if user is admin or booker
    if (user?.role !== 'admin' && user?.role !== 'booker') {
      return
    }
    
    // Always allow creating new bookings - they can stack
    // Don't check for existing bookings here as we want to allow multiple bookings per day
    isDraggingRef.current = true
    draggingRef.current = {
      type: 'create',
      resourceId,
      dayIndex,
      startDay: dayIndex,
      endDay: dayIndex
    }
  }

  function onMouseDownBooking(resourceId: string, booking: any, e: any) {
    e.preventDefault()
    
    // Only allow dragging/editing bookings if user is admin or booker
    if (user?.role !== 'admin' && user?.role !== 'booker') {
      return
    }
    
    isDraggingRef.current = true
    
    const bookingStartDate = normalizeToMidnight(parseLocalDateString(booking.start_date))
    const bookingEndDate = normalizeToMidnight(parseLocalDateString(booking.end_date || booking.start_date))
      const monthStartNormalized = normalizeToMidnight(new Date(monthStart))
    const startDayIndex = Math.floor(
      (bookingStartDate.getTime() - monthStartNormalized.getTime()) / (1000 * 60 * 60 * 24)
    )
    const endDayIndex = Math.floor(
      (bookingEndDate.getTime() - monthStartNormalized.getTime()) / (1000 * 60 * 60 * 24)
    )

    const track = document.getElementById(`track-${resourceId}`)
    if (!track) {
      draggingRef.current = {
        type: 'move',
        resourceId,
        dayIndex: startDayIndex,
        bookingId: booking.id,
        startDay: startDayIndex,
        endDay: startDayIndex
      }
      return
    }

    const rect = track.getBoundingClientRect()
    const relativeX = e.clientX - rect.left
    const dayWidth = rect.width / totalDays
    const bookingLeft = startDayIndex * dayWidth
    const bookingRight = (endDayIndex + 1) * dayWidth
    const handleWidth = Math.min(12, dayWidth / 2)

    const nearLeft = relativeX >= bookingLeft && relativeX <= bookingLeft + handleWidth
    const nearRight = relativeX <= bookingRight && relativeX >= bookingRight - handleWidth

    if (nearLeft) {
      // Resize start edge
      draggingRef.current = {
        type: 'resize',
        edge: 'start',
        resourceId,
        bookingId: booking.id,
        startDay: startDayIndex,
        endDay: endDayIndex
      }
    } else if (nearRight) {
      // Resize end edge
      draggingRef.current = {
        type: 'resize',
        edge: 'end',
        resourceId,
        bookingId: booking.id,
        startDay: startDayIndex,
        endDay: endDayIndex
      }
    } else {
      // Check if Shift is held for duplication
      const isDuplicating = e.shiftKey
      
      // Move entire booking (or duplicate if Shift is held) - store original position and current click position
      draggingRef.current = {
        type: isDuplicating ? 'duplicate' : 'move',
        resourceId,
        dayIndex: startDayIndex,
        bookingId: booking.id,
        startDay: startDayIndex, // Original start position
        endDay: startDayIndex, // Will be updated during drag
        originalStartDay: startDayIndex, // Store original for offset calculation
        originalEndDay: endDayIndex
      }
    }
  }

  function onMouseMove(e: MouseEvent) {
    if (!draggingRef.current) return
    
    // Find which resource row the mouse is over
    let targetResourceId: string | null = null
    let hoverDay = 0
    
    // Check all resource tracks to see which one contains the mouse
    filteredAndSortedResources.forEach((resource: any) => {
      const track = document.getElementById(`track-${resource.id}`)
      if (track) {
        const rect = track.getBoundingClientRect()
        if (e.clientY >= rect.top && e.clientY <= rect.bottom &&
            e.clientX >= rect.left && e.clientX <= rect.right) {
          targetResourceId = resource.id
          const relativeX = clamp(e.clientX - rect.left, 0, rect.width)
          const dayWidth = rect.width / totalDays
          hoverDay = clamp(Math.floor(relativeX / dayWidth), 0, totalDays - 1)
        }
      }
    })
    
    // If we found a target resource, update the drag state
    if (targetResourceId) {
      draggingRef.current.endResourceId = targetResourceId
      draggingRef.current.endDay = hoverDay
      applyDrag()
    }
  }

  async function onMouseUp() {
    if (!draggingRef.current) {
      return
    }

    const dragType = draggingRef.current.type
    const dragResourceId = draggingRef.current.resourceId
    const dragBookingId = draggingRef.current.bookingId

    if (dragType === 'create') {
      // Show dialog to create booking
      const { resourceId, startDay, endDay } = draggingRef.current
      const start = Math.min(startDay, endDay)
      const end = Math.max(startDay, endDay)
      
      setNewBookingData({
        resourceId,
        startDay: start,
        endDay: end
      })
      setShowBookingDialog(true)
      draggingRef.current = null
      isDraggingRef.current = false
      setDragPreview({}) // Clear preview for create operations
    } else if (dragType === 'move') {
      // Save moved booking - keep preview until save completes
      await saveBookingMove()
      // Clear preview after save completes
      setDragPreview((prev) => {
        const next = { ...prev }
        if (dragBookingId) {
          delete next[dragBookingId]
        }
        return next
      })
    } else if (dragType === 'duplicate') {
      // Create duplicate booking at new position
      await saveBookingDuplicate()
      // Clear preview after save completes
      setDragPreview((prev) => {
        const next = { ...prev }
        if (dragBookingId) {
          delete next[dragBookingId]
        }
        return next
      })
    } else if (dragType === 'resize') {
      // Save resized booking - keep preview until save completes
      await saveBookingResize()
      // Clear preview after save completes
      setDragPreview((prev) => {
        const next = { ...prev }
        if (dragBookingId) {
          delete next[dragBookingId]
        }
        return next
      })
    }
    
    draggingRef.current = null
    isDraggingRef.current = false
  }

  function applyDrag() {
    const drag = draggingRef.current
    if (!drag) return
    
    // For create operations, we don't need preview (dialog will show)
    if (drag.type === 'create') return
    
    // Find the booking to get its original span
    let booking: any = null
    let originalStartIndex = 0
    let originalEndIndex = 0
    
    for (let day = 0; day < totalDays; day++) {
      const dayBookings = bookingsByResource[drag.resourceId]?.[day] || []
      const found = dayBookings.find((b: any) => b.id === drag.bookingId)
      if (found) {
        booking = found
        const bookingStartDate = parseLocalDateString(booking.start_date)
        const bookingEndDate = parseLocalDateString(booking.end_date || booking.start_date)
        originalStartIndex = getDayIndex(bookingStartDate, monthStart)
        originalEndIndex = getDayIndex(bookingEndDate, monthStart)
        break
      }
    }
    
    if (!booking) return
    
    let previewStart = originalStartIndex
    let previewEnd = originalEndIndex
    
    if (drag.type === 'move' || drag.type === 'duplicate') {
      // Calculate the offset from where we started dragging
      const originalDragStart = drag.originalStartDay ?? drag.startDay
      const daysDiff = drag.endDay - originalDragStart
      previewStart = clamp(originalStartIndex + daysDiff, 0, totalDays - 1)
      const spanDays = originalEndIndex - originalStartIndex
      previewEnd = clamp(previewStart + spanDays, previewStart, totalDays - 1)
    } else if (drag.type === 'resize') {
      const newEdgeDay = clamp(drag.endDay, 0, totalDays - 1)
      if (drag.edge === 'start') {
        previewStart = Math.min(newEdgeDay, originalEndIndex)
        previewEnd = originalEndIndex
      } else if (drag.edge === 'end') {
        previewStart = originalStartIndex
        previewEnd = Math.max(newEdgeDay, originalStartIndex)
      }
    }
    
    // Update preview state to trigger re-render
    // For duplicates, use a temporary ID so the original stays visible
    const previewId = drag.type === 'duplicate' ? `duplicate-${drag.bookingId}` : drag.bookingId
    const targetResourceId = drag.endResourceId || drag.resourceId
    
    // Store booking data for cross-row previews
    setDragPreview({
      [previewId]: {
        startDayIndex: previewStart,
        endDayIndex: previewEnd,
        resourceId: targetResourceId, // Include target resource in preview
        booking: booking // Store booking data for rendering in target row
      }
    })
  }

  async function saveBookingMove() {
    // Store drag info before clearing draggingRef
    const drag = draggingRef.current
    if (!drag || drag.type !== 'move') return
    
    const bookingId = drag.bookingId
    const resourceId = drag.resourceId
    
    try {
      // Find the booking to verify it exists and get its current dates
      // Search across all days since bookings can span multiple days
      let booking: any = null
      for (let day = 0; day < totalDays; day++) {
        const dayBookings = bookingsByResource[resourceId]?.[day] || []
        const found = dayBookings.find((b: any) => b.id === bookingId)
        if (found) {
          booking = found
          break
        }
      }
      
      if (!booking) {
        try { booking = await apiGet(`/api/bookings/${bookingId}`) } catch (e) {
          console.error('Error fetching booking:', e)
        }
      }
      if (!booking) { toast.error('Booking not found'); return }
      
      const originalStartDay = drag.originalStartDay ?? drag.startDay
      const newDayIndex = clamp(drag.endDay, 0, totalDays - 1)
      const daysDiff = newDayIndex - originalStartDay
      const targetResourceId = drag.endResourceId || drag.resourceId
      const resourceChanged = targetResourceId !== booking.resource_id
      
      if (daysDiff === 0 && !resourceChanged) return
      
      const bookingStartDate = normalizeToMidnight(parseLocalDateString(booking.start_date))
      const bookingEndDate = normalizeToMidnight(parseLocalDateString(booking.end_date || booking.start_date))
      const newStartDate = new Date(bookingStartDate)
      newStartDate.setDate(newStartDate.getDate() + daysDiff)
      const newEndDate = new Date(bookingEndDate)
      newEndDate.setDate(newEndDate.getDate() + daysDiff)
      
      const updateData: any = {
        startDate: getLocalDateString(normalizeToMidnight(newStartDate)),
        endDate: getLocalDateString(normalizeToMidnight(newEndDate))
      }
      if (resourceChanged) updateData.resourceId = targetResourceId
      
      try {
        await apiPut(`/api/bookings/${booking.id}`, updateData, { defaultErrorMessage: 'Failed to update booking' })
        await loadBookings()
        toast.success('Booking updated')
      } catch (error: unknown) {
        toast.error((error instanceof Error ? error.message : String(error)) || 'Failed to update booking')
      }
    } catch (error) {
      console.error('Error saving booking:', error)
      toast.error('Failed to update booking')
    }
  }

  async function saveBookingDuplicate() {
    // Store drag info before clearing draggingRef
    const drag = draggingRef.current
    if (!drag || drag.type !== 'duplicate') return
    
    const bookingId = drag.bookingId
    const resourceId = drag.resourceId
    
    try {
      // Find the booking to duplicate
      let booking: any = null
      for (let day = 0; day < totalDays; day++) {
        const dayBookings = bookingsByResource[resourceId]?.[day] || []
        const found = dayBookings.find((b: any) => b.id === bookingId)
        if (found) {
          booking = found
          break
        }
      }
      
      if (!booking) {
        try { booking = await apiGet(`/api/bookings/${bookingId}`) } catch (e) {
          console.error('Error fetching booking:', e)
        }
      }
      if (!booking) { toast.error('Booking not found'); return }
      
      const originalStartDay = drag.originalStartDay ?? drag.startDay
      const newDayIndex = clamp(drag.endDay, 0, totalDays - 1)
      const daysDiff = newDayIndex - originalStartDay
      
      const bookingStartDate = normalizeToMidnight(parseLocalDateString(booking.start_date))
      const bookingEndDate = normalizeToMidnight(parseLocalDateString(booking.end_date || booking.start_date))
      const newStartDate = new Date(bookingStartDate)
      newStartDate.setDate(newStartDate.getDate() + daysDiff)
      const newEndDate = new Date(bookingEndDate)
      newEndDate.setDate(newEndDate.getDate() + daysDiff)
      
      const targetResourceId = drag.endResourceId || drag.resourceId
      
      try {
        await apiPost('/api/bookings', {
          resourceId: targetResourceId,
          projectId: booking.project_id || null,
          title: booking.title || 'New Booking',
          startDate: getLocalDateString(newStartDate),
          endDate: getLocalDateString(newEndDate),
          startTime: booking.start_time || null,
          endTime: booking.end_time || null,
          hours: booking.hours || null,
          color: booking.color || null,
          priority: booking.priority || 'normal',
          projectManagerId: booking.project_manager_id || null,
          tentative: booking.tentative || false
        }, { defaultErrorMessage: 'Failed to duplicate booking' })
        await loadBookings()
        toast.success('Booking duplicated')
      } catch (error: unknown) {
        toast.error((error instanceof Error ? error.message : String(error)) || 'Failed to duplicate booking')
      }
    } catch (error) {
      console.error('Error duplicating booking:', error)
      toast.error('Failed to duplicate booking')
    }
  }

  async function saveBookingResize() {
    // Store drag info before clearing draggingRef
    const drag = draggingRef.current
    if (!drag || drag.type !== 'resize') return

    const bookingId = drag.bookingId
    const resourceId = drag.resourceId

    try {
      // Find the booking across all days
      let booking: any = null
      for (let day = 0; day < totalDays; day++) {
        const dayBookings = bookingsByResource[resourceId]?.[day] || []
        const found = dayBookings.find((b: any) => b.id === bookingId)
        if (found) {
          booking = found
          break
        }
      }

      if (!booking) {
        try { booking = await apiGet(`/api/bookings/${bookingId}`) } catch (e) {
          console.error('Error fetching booking:', e)
        }
      }
      if (!booking) { toast.error('Booking not found'); return }

      const newEdgeDay = clamp(drag.endDay, 0, totalDays - 1)

      const bookingStartDate = normalizeToMidnight(parseLocalDateString(booking.start_date))
      const bookingEndDate = normalizeToMidnight(parseLocalDateString(booking.end_date || booking.start_date))

      const monthStartNormalized = normalizeToMidnight(new Date(monthStart))
      const originalStartIndex = Math.floor((bookingStartDate.getTime() - monthStartNormalized.getTime()) / (1000 * 60 * 60 * 24))
      const originalEndIndex = Math.floor((bookingEndDate.getTime() - monthStartNormalized.getTime()) / (1000 * 60 * 60 * 24))

      let newStartIndex = originalStartIndex
      let newEndIndex = originalEndIndex

      if (drag.edge === 'start') {
        newStartIndex = Math.min(newEdgeDay, originalEndIndex)
      } else if (drag.edge === 'end') {
        newEndIndex = Math.max(newEdgeDay, originalStartIndex)
      }

      const newStartDate = getDateForDay(monthStart, newStartIndex)
      const newEndDate = getDateForDay(monthStart, newEndIndex)

      try {
        await apiPut(`/api/bookings/${booking.id}`, {
          startDate: getLocalDateString(newStartDate),
          endDate: getLocalDateString(newEndDate)
        }, { defaultErrorMessage: 'Failed to update booking' })
        await loadBookings()
        toast.success('Booking updated')
      } catch (error: unknown) {
        toast.error((error instanceof Error ? error.message : String(error)) || 'Failed to update booking')
      }
    } catch (error) {
      console.error('Error resizing booking:', error)
      toast.error('Failed to update booking')
    }
  }

  async function createBooking(data: any) {
    try {
      // Handle both startDay/endDay (from drag) and startDate/endDate (from dialog, especially repeats)
      let startDateStr: string
      let endDateStr: string
      
      if (data.startDate && data.endDate) {
        // Dates are already provided as strings (e.g., from repeat or dialog)
        startDateStr = data.startDate
        endDateStr = data.endDate
      } else if (data.startDay !== undefined && data.endDay !== undefined) {
        // Calculate dates from day indices (from drag)
        const startDate = getDateForDay(monthStart, data.startDay)
        const endDate = getDateForDay(monthStart, data.endDay)
        startDateStr = getLocalDateString(startDate)
        endDateStr = getLocalDateString(endDate)
      } else {
        throw new Error('Missing start/end dates or day indices')
      }
      
      const bookingData = {
        resourceId: data.resourceId,
        projectId: data.projectId || null,
        title: data.title || 'New Booking',
        startDate: startDateStr,
        endDate: endDateStr,
        startTime: data.startTime || '09:00',
        endTime: data.endTime || '17:00',
        hours: data.hours || null,
        color: data.color || null,
        priority: data.priority ? data.priority : 'normal',
        projectManagerId: data.projectManagerId || null,
        tentative: data.tentative || false,
        repeatGroupId: data.repeatGroupId || null
      }
      
      await apiPost('/api/bookings', bookingData, { defaultErrorMessage: 'Failed to create booking' })
      await loadBookings()
      toast.success('Booking created')
      setShowBookingDialog(false)
      setNewBookingData(null)
    } catch (error) {
      console.error('Error creating booking:', error)
      toast.error(error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Failed to create booking')
    }
  }

  async function updateBooking(data: any) {
    try {
      await apiPut(`/api/bookings/${editingBooking.id}`, {
        title: data.title,
        projectId: data.projectId || null,
        startDate: data.startDate,
        endDate: data.endDate,
        startTime: data.startTime || null,
        endTime: data.endTime || null,
        hours: data.hours || null,
        color: data.color || null,
        priority: data.priority ? data.priority : 'normal',
        projectManagerId: data.projectManagerId || null,
        tentative: data.tentative || false
      }, { defaultErrorMessage: 'Failed to update booking' })
      await loadBookings()
      toast.success('Booking updated')
      setShowBookingDialog(false)
      setEditingBooking(null)
    } catch (error) {
      console.error('Error updating booking:', error)
      toast.error('Failed to update booking')
    }
  }

  async function deleteBooking(bookingId: string) {
    try {
      await apiDelete(`/api/bookings/${bookingId}`, { defaultErrorMessage: 'Failed to delete booking' })
      await loadBookings()
      toast.success('Booking deleted')
      setShowBookingDialog(false)
      setEditingBooking(null)
    } catch (error) {
      console.error('Error deleting booking:', error)
      toast.error('Failed to delete booking')
    }
  }

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  })

  // Sync vertical scrolling between left column and timeline
  const syncScrollLeft = (e: React.UIEvent<HTMLDivElement>) => {
    if (timelineRef.current) {
      timelineRef.current.scrollTop = (e.target as HTMLDivElement).scrollTop
    }
  }

  const syncScrollRight = (e: React.UIEvent<HTMLDivElement>) => {
    if (leftColumnRef.current) {
      leftColumnRef.current.scrollTop = (e.target as HTMLDivElement).scrollTop
    }
  }

  // Calculate row heights for each resource (for the left column)
  const resourceRowHeights = useMemo(() => {
    const heights: Record<string, number> = {}
    filteredAndSortedResources.forEach((resource: any) => {
      const bookingsForResource = bookingsByResource[resource.id] || {}
      
      // Collect all unique bookings
      const bookingMap = new Map<string, any>()
      Object.keys(bookingsForResource).forEach(dayIndexStr => {
        const dayBookings = bookingsForResource[parseInt(dayIndexStr)] || []
        dayBookings.forEach((booking: any) => {
          if (!bookingMap.has(booking.id)) {
            bookingMap.set(booking.id, booking)
          }
        })
      })
      const allBookings = Array.from(bookingMap.values())
      
      // Calculate lanes
      const laneInfo = calculateBookingLanes(allBookings, monthStart, totalDays, dragPreview)
      
      // Calculate height
      // 0 or 1 lane: normal height (60px)
      // 2+ lanes: each booking gets 50% height (30px), row expands to accommodate all
      const HALF_HEIGHT = ROW_HEIGHT / 2
      const rowHeight = laneInfo.totalLanes <= 1 ? ROW_HEIGHT : HALF_HEIGHT * laneInfo.totalLanes
      heights[resource.id] = rowHeight
    })
    return heights
  }, [filteredAndSortedResources, bookingsByResource, monthStart, totalDays, dragPreview])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', padding: 16 }}>
      <div style={{ 
        border: '1px solid var(--border)', 
        borderRadius: 12, 
        overflow: 'hidden', 
        display: 'flex', 
        flexDirection: 'column', 
        flex: 1,
        background: 'var(--surface)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
      }}>
        <div style={{ display: 'flex', position: 'relative', overflow: 'hidden', flex: 1 }}>
          {/* Sticky left column for resource names */}
          <div style={{ 
            position: 'relative',
            zIndex: 10, 
            background: 'var(--surface)',
            borderRight: '2px solid var(--border)',
            minWidth: 200,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Header spacer with filter and sort controls */}
            <div style={{ 
              height: filterBy === 'person' && (availableDepartments.length > 0 || availableJobRoles.length > 0) ? 140 : 105, 
              borderBottom: '2px solid var(--border)',
              flexShrink: 0,
              background: 'var(--surface)',
              padding: '15px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Resources
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <label style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', minWidth: 40 }}>
                    Filter:
                  </label>
                  <select
                    value={filterBy}
                    onChange={e => {
                      setFilterBy(e.target.value)
                      if (e.target.value !== 'person') {
                        setDepartmentFilter('all')
                        setJobRoleFilter('all')
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '4px 8px',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      fontSize: 11,
                      background: 'var(--surface)',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="all">All Types</option>
                    <option value="person">Person</option>
                    <option value="team">Team</option>
                    <option value="vehicle">Vehicle</option>
                    <option value="equipment">Equipment</option>
                    <option value="room">Room</option>
                  </select>
                </div>
                {filterBy === 'person' && (availableDepartments.length > 0 || availableJobRoles.length > 0) && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {availableDepartments.length > 0 && (
                      <>
                        <label style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', minWidth: 40 }}>
                          Dept:
                        </label>
                        <select
                          value={departmentFilter}
                          onChange={e => setDepartmentFilter(e.target.value)}
                          style={{
                            flex: 1,
                            minWidth: 100,
                            padding: '4px 8px',
                            border: '1px solid var(--border)',
                            borderRadius: 4,
                            fontSize: 11,
                            background: 'var(--surface)',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="all">All Departments</option>
                          {availableDepartments.map(dept => (
                            <option key={dept} value={dept}>
                              {dept}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                    {availableJobRoles.length > 0 && (
                      <>
                        <label style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', minWidth: 40 }}>
                          Job role:
                        </label>
                        <select
                          value={jobRoleFilter}
                          onChange={e => setJobRoleFilter(e.target.value)}
                          style={{
                            flex: 1,
                            minWidth: 100,
                            padding: '4px 8px',
                            border: '1px solid var(--border)',
                            borderRadius: 4,
                            fontSize: 11,
                            background: 'var(--surface)',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="all">All Job Roles</option>
                          {availableJobRoles.map(role => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                  <label style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', minWidth: 40 }}>
                    Sort:
                  </label>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as 'type' | 'name')}
                    style={{
                      flex: 1,
                      padding: '4px 8px',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      fontSize: 11,
                      background: 'var(--surface)',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="name">By Name</option>
                    <option value="type">By Type</option>
                  </select>
                </div>
              </div>
            </div>
            
            {/* Scrollable resource names */}
            <div 
              ref={leftColumnRef}
              onScroll={syncScrollLeft}
              style={{ 
                overflowY: 'auto', 
                overflowX: 'hidden',
                flex: 1,
                padding: '0 12px'
              }}
            >
              {filteredAndSortedResources.map((resource: any) => (
                <div 
                  key={resource.id}
                  style={{ 
                    height: resourceRowHeights[resource.id] || ROW_HEIGHT, 
                    display: 'flex', 
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border)'
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: resource.color || getResourceDefaultColor(resource.type || 'person', true),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      flexShrink: 0
                    }}
                  >
                    {getResourceIcon(resource.type || 'person')}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                      {resource.name}
                    </span>
                    {resource.job_role && (
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {resource.job_role}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Scrollable timeline */}
          <div 
            ref={timelineRef}
            onScroll={syncScrollRight}
            style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, position: 'relative' }}
          >
            <div style={{ minWidth: `${totalDays * DAY_COLUMN_WIDTH}px` }}>
          <TimelineHeader 
            monthStart={monthStart} 
            totalDays={totalDays}
            hasDepartmentFilter={filterBy === 'person' && (availableDepartments.length > 0 || availableJobRoles.length > 0)}
          />
          
              {filteredAndSortedResources.map((resource: any) => (
            <ResourceRow
              key={resource.id}
              resource={resource}
              monthStart={monthStart}
              totalDays={totalDays}
              bookingsByDay={bookingsByResource[resource.id] || {}}
              onMouseDownCell={(dayIndex: number, e: any) => onMouseDownCell(resource.id, dayIndex, e)}
              onDeleteBooking={deleteBooking}
                  dragPreview={dragPreview}
                  onMouseDownBooking={(booking: any, e: any) => onMouseDownBooking(resource.id, booking, e)}
                  onEditBooking={(booking: any) => {
                    // Only allow editing bookings if user is admin or booker
                    if (user?.role !== 'admin' && user?.role !== 'booker') {
                      return
                    }
                    setEditingBooking(booking)
                    setShowBookingDialog(true)
                  }}
                  projectsById={projectsById}
                  canEdit={user?.role === 'admin' || user?.role === 'booker'}
            />
          ))}
            </div>
          </div>
        </div>
      </div>

      {showBookingDialog && (newBookingData || editingBooking) && (
        <BookingDialog
          data={newBookingData}
          booking={editingBooking}
          projects={projects}
          users={users}
          monthStart={monthStart}
          onSave={editingBooking ? updateBooking : createBooking}
          onDelete={editingBooking ? () => deleteBooking(editingBooking.id) : undefined}
          onCancel={() => {
            setShowBookingDialog(false)
            setNewBookingData(null)
            setEditingBooking(null)
          }}
        />
      )}
    </div>
  )
}

