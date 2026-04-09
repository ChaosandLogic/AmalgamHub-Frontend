import { useMemo, memo } from 'react'
import { getDateForDay, parseLocalDateString, normalizeToMidnight, getDayIndex } from '../../lib/utils/dateUtils'
import { getPriorityColor } from '../../lib/utils/priorityUtils'
import { EDGE_THRESHOLD, ROW_HEIGHT } from '../../lib/constants/schedule'
import { calculateBookingLanes } from '../utils/calculateBookingLanes'

function pastelise(color: string): string {
  return `color-mix(in srgb, ${color} 75%, white)`
}

interface BookingRendererProps {
  bookingsByDay: Record<number, any[]>
  monthStart: Date
  totalDays: number
  onDeleteBooking: any
  onMouseDownBooking: (booking: any, e: any) => void
  dragPreview: Record<string, { startDayIndex: number, endDayIndex: number, resourceId?: string, booking?: any }>
  onEditBooking?: (booking: any) => void
  laneInfo?: { bookingLanes: Map<string, number>, totalLanes: number }
  resourceId?: string
  projectsById?: Record<string, any>
  colorMode?: 'priority' | 'pm'
  pmColorMap?: Record<string, string>
}

function BookingRenderer({
  bookingsByDay,
  monthStart,
  totalDays,
  onDeleteBooking,
  onMouseDownBooking,
  dragPreview,
  onEditBooking,
  laneInfo,
  resourceId,
  projectsById,
  colorMode = 'priority',
  pmColorMap
}: BookingRendererProps) {
  // Collect all unique bookings (deduplicate by ID since multi-day bookings appear in multiple days)
  const allBookings = useMemo(() => {
    const bookingMap = new Map<string, any>()
    Object.keys(bookingsByDay).forEach(dayIndexStr => {
      const dayBookings = bookingsByDay[parseInt(dayIndexStr)] || []
      dayBookings.forEach(booking => {
        if (!bookingMap.has(booking.id)) {
          bookingMap.set(booking.id, booking)
        }
      })
    })
    return Array.from(bookingMap.values())
  }, [bookingsByDay])
  
  // Extract cross-row move/duplicate previews
  // Show previews that belong to this resource row (target row)
  const crossRowPreviews = useMemo(() => {
    const previews: Array<{ id: string; booking: any; preview: { startDayIndex: number, endDayIndex: number, resourceId?: string, booking?: any } }> = []
    
    Object.keys(dragPreview).forEach(previewId => {
      const preview = dragPreview[previewId]
      const previewResourceId = preview.resourceId || resourceId
      
      // Only show previews that belong to this resource row (target row)
      if (previewResourceId !== resourceId) {
        return // Skip previews for other rows
      }
      
      // Check if this is a cross-row preview (booking data stored in preview, or duplicate)
      if (preview.booking) {
        // Booking data is stored in preview (cross-row move or duplicate)
        previews.push({
          id: previewId,
          booking: preview.booking,
          preview
        })
      } else if (previewId.startsWith('duplicate-')) {
        // Duplicate preview - try to find booking
        const originalBookingId = previewId.replace('duplicate-', '')
        const booking = allBookings.find(b => b.id === originalBookingId)
        if (booking) {
          previews.push({
            id: previewId,
            booking,
            preview
          })
        }
      }
    })
    
    return previews
  }, [dragPreview, resourceId, allBookings])
  
  // Calculate lane info if not provided
  const calculatedLaneInfo = useMemo(() => {
    return laneInfo || calculateBookingLanes(allBookings, monthStart, totalDays, dragPreview)
  }, [laneInfo, allBookings, monthStart, totalDays, dragPreview])
  
  const { bookingLanes, totalLanes } = calculatedLaneInfo
  
  // Helper function to check if two bookings overlap
  const bookingsOverlap = (start1: number, end1: number, start2: number, end2: number): boolean => {
    return start1 <= end2 && end1 >= start2
  }
  
  // Calculate positions for all bookings (for overlap checking)
  const bookingPositions = useMemo(() => {
    const positions = new Map<string, { startDayIndex: number, endDayIndex: number }>()
    allBookings.forEach(booking => {
      const preview = dragPreview[booking.id]
      const previewResourceId = preview?.resourceId || resourceId
      
      let startDayIndex: number
      let endDayIndex: number
      
      if (preview && previewResourceId === resourceId) {
        startDayIndex = preview.startDayIndex
        endDayIndex = preview.endDayIndex
      } else {
        const bookingStartDate = parseLocalDateString(booking.start_date)
        startDayIndex = getDayIndex(bookingStartDate, monthStart)
        
        const bookingEndDate = parseLocalDateString(booking.end_date || booking.start_date)
        endDayIndex = getDayIndex(bookingEndDate, monthStart)
      }
      
      positions.set(booking.id, { startDayIndex, endDayIndex })
    })
    return positions
  }, [allBookings, dragPreview, resourceId, monthStart])
  
  return (
    <>
      {allBookings.map(booking => {
        // Use preview position if this booking is being dragged within the same row
        // If being moved to a different row, don't show preview here (it will show in target row)
        const preview = dragPreview[booking.id]
        const previewResourceId = preview?.resourceId || resourceId
        
        // If preview exists but is for a different resource, don't show preview here
        // (the preview will show in the target row, original stays visible here)
        let startDayIndex: number
        let endDayIndex: number
        
        if (preview && previewResourceId === resourceId) {
          // Preview is for this row
          startDayIndex = preview.startDayIndex
          endDayIndex = preview.endDayIndex
        } else {
          const bookingStartDate = parseLocalDateString(booking.start_date)
          startDayIndex = getDayIndex(bookingStartDate, monthStart)
          
          const bookingEndDate = parseLocalDateString(booking.end_date || booking.start_date)
          endDayIndex = getDayIndex(bookingEndDate, monthStart)
        }
        
        const spanDays = Math.max(1, endDayIndex - startDayIndex + 1)
        const leftPercent = (startDayIndex / totalDays) * 100
        const widthPercent = (spanDays / totalDays) * 100
        
        // Get color - use booking.color only for time off bookings, otherwise use priority-based color
        const priority = booking.priority || 'normal'
        const isTimeOff = (booking.title ?? '').toLowerCase().includes('holiday') ||
                         (booking.title ?? '').toLowerCase().includes('sick') ||
                         (booking.title ?? '').toLowerCase().includes('public holiday') ||
                         (booking.title ?? '').toLowerCase().includes('non work') ||
                         (booking.title ?? '').toLowerCase().includes('non-work') ||
                         (booking.description ?? '').toLowerCase().includes('time off')
        
        let background: string
        let border: string
        if (isTimeOff) {
          const timeOffColor = booking.color && booking.color !== 'var(--text-secondary)' 
            ? booking.color 
            : 'var(--timeoff-bg)'
          background = timeOffColor
          border = timeOffColor
        } else if (colorMode === 'pm' && booking.project_manager_id && pmColorMap?.[booking.project_manager_id]) {
          const pmColor = pmColorMap[booking.project_manager_id]
          background = pastelise(pmColor)
          border = pmColor
        } else {
          const priorityColors = getPriorityColor(priority)
          background = priorityColors.background
          border = priorityColors.border
        }
        const project =
          projectsById &&
          (projectsById[booking.project_id] ||
            projectsById[booking.projectId || ''])
        const projectLabel =
          project &&
          (project.code
            ? `${project.code} • ${project.name}`
            : project.name)

        // Check if this booking overlaps with any other booking
        let hasOverlap = false
        for (const otherBooking of allBookings) {
          if (otherBooking.id === booking.id) continue
          
          const otherPos = bookingPositions.get(otherBooking.id)
          if (!otherPos) continue
          
          if (bookingsOverlap(startDayIndex, endDayIndex, otherPos.startDayIndex, otherPos.endDayIndex)) {
            hasOverlap = true
            break
          }
        }
        
        // Calculate lane positioning
        // Each booking is 30px when it overlaps with another booking, or full row (60px) when alone
        const lane = bookingLanes.get(booking.id) || 0
        const bookingHeightPx = hasOverlap ? 30 : 60 // 50% of ROW_HEIGHT if overlapping, full ROW_HEIGHT if not
        const topPx = lane * bookingHeightPx
        
        // Create hatched pattern for tentative bookings
        const isTentative = booking.tentative === 1 || booking.tentative === true
        const hatchedPattern = isTentative 
          ? `repeating-linear-gradient(
              45deg,
              ${background},
              ${background} 4px,
              rgba(255, 255, 255, 0.3) 4px,
              rgba(255, 255, 255, 0.3) 8px
            )`
          : background
        
        
        return (
          <div
            key={booking.id}
            style={{
              position: 'absolute',
              left: `${leftPercent}%`,
              width: `${widthPercent}%`,
              top: `${topPx + 4}px`,
              height: `${bookingHeightPx - 8}px`,
              background: hatchedPattern,
              border: `2px solid ${border}`,
              borderRadius: 6,
              padding: '2px 6px',
              fontSize: '11px',
              color: isTimeOff ? 'white' : '#333',
              cursor: 'move',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: '1px',
              zIndex: 2,
              pointerEvents: 'auto'
            }}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const mouseX = e.clientX - rect.left
              const width = rect.width
              
              // Check if mouse is near left or right edge
              if (mouseX <= EDGE_THRESHOLD) {
                e.currentTarget.style.cursor = 'ew-resize'
              } else if (mouseX >= width - EDGE_THRESHOLD) {
                e.currentTarget.style.cursor = 'ew-resize'
              } else {
                e.currentTarget.style.cursor = 'move'
              }
            }}
            onMouseLeave={(e) => {
              // Reset cursor when mouse leaves
              e.currentTarget.style.cursor = 'move'
            }}
            onDoubleClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onEditBooking?.(booking)
            }}
            onMouseDown={e => onMouseDownBooking(booking, e)}
            title={`${booking.title}${
              projectLabel ? ` • ${projectLabel}` : ''
            } - ${getDateForDay(
              monthStart,
              startDayIndex
            ).toLocaleDateString('en-GB')}${
              spanDays > 1
                ? ` to ${getDateForDay(
                    monthStart,
                    endDayIndex
                  ).toLocaleDateString('en-GB')}`
                : ''
            }`}
          >
            {hasOverlap ? (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                {project?.name ?? booking.title}
              </span>
            ) : (
              <>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                  {booking.title}
                </span>
                {projectLabel && (
                  <span
                    style={{
                      fontSize: '10px',
                      opacity: 0.9,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {projectLabel}
                  </span>
                )}
                {booking.hours && (
                  <span style={{ fontSize: '10px', opacity: 0.9 }}>
                    {booking.hours} hrs per day
                  </span>
                )}
              </>
            )}
          </div>
        )
      })}
      
      {/* Render cross-row move/duplicate previews */}
      {crossRowPreviews.map(({ id, booking, preview }) => {
        const startDayIndex = preview.startDayIndex
        const endDayIndex = preview.endDayIndex
        const spanDays = Math.max(1, endDayIndex - startDayIndex + 1)
        const leftPercent = (startDayIndex / totalDays) * 100
        const widthPercent = (spanDays / totalDays) * 100
        
        const priority = booking.priority || 'normal'
        const isTimeOff = (booking.title ?? '').toLowerCase().includes('holiday') ||
                         (booking.title ?? '').toLowerCase().includes('sick') ||
                         (booking.title ?? '').toLowerCase().includes('public holiday') ||
                         (booking.title ?? '').toLowerCase().includes('non work') ||
                         (booking.title ?? '').toLowerCase().includes('non-work') ||
                         (booking.description ?? '').toLowerCase().includes('time off')
        
        let background: string
        let border: string
        if (isTimeOff) {
          const timeOffColor = booking.color && booking.color !== 'var(--text-secondary)' 
            ? booking.color 
            : 'var(--timeoff-bg)'
          background = timeOffColor
          border = timeOffColor
        } else if (colorMode === 'pm' && booking.project_manager_id && pmColorMap?.[booking.project_manager_id]) {
          const pmColor = pmColorMap[booking.project_manager_id]
          background = pastelise(pmColor)
          border = pmColor
        } else {
          const priorityColors = getPriorityColor(priority)
          background = priorityColors.background
          border = priorityColors.border
        }
        
        const isTentative = booking.tentative === 1 || booking.tentative === true
        const hatchedPattern = isTentative 
          ? `repeating-linear-gradient(
              45deg,
              ${background},
              ${background} 4px,
              rgba(255, 255, 255, 0.3) 4px,
              rgba(255, 255, 255, 0.3) 8px
            )`
          : background
        
        // Calculate lane for duplicate preview (treat as new booking for lane calculation)
        const tempLaneInfo = calculateBookingLanes(
          [...allBookings, { ...booking, id, start_date: getDateForDay(monthStart, startDayIndex).toISOString(), end_date: getDateForDay(monthStart, endDayIndex).toISOString() }],
          monthStart,
          totalDays,
          { [id]: preview }
        )
        const lane = tempLaneInfo.bookingLanes.get(id) || 0
        
        // Check if this preview overlaps with any existing booking
        let hasOverlap = false
        for (const otherBooking of allBookings) {
          const otherPos = bookingPositions.get(otherBooking.id)
          if (!otherPos) continue
          
          if (bookingsOverlap(startDayIndex, endDayIndex, otherPos.startDayIndex, otherPos.endDayIndex)) {
            hasOverlap = true
            break
          }
        }
        
        const bookingHeightPx = hasOverlap ? 30 : 60
        const topPx = lane * bookingHeightPx
        const previewProject = projectsById && (projectsById[booking.project_id] || projectsById[booking.projectId || ''])
        
        return (
          <div
            key={id}
            style={{
              position: 'absolute',
              left: `${leftPercent}%`,
              width: `${widthPercent}%`,
              top: `${topPx + 4}px`,
              height: `${bookingHeightPx - 8}px`,
              background: hatchedPattern,
              border: `2px solid ${border}`,
              borderRadius: 6,
              padding: '2px 6px',
              fontSize: '11px',
              color: isTimeOff ? 'white' : '#333',
              cursor: 'move',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: '1px',
              opacity: 0.7
            }}
            title={`${booking.title} (duplicate preview)`}
          >
            {hasOverlap ? (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                {previewProject?.name ?? booking.title}
              </span>
            ) : (
              <>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                  {booking.title}
                </span>
                {booking.hours && (
                  <span style={{ fontSize: '10px', opacity: 0.9 }}>
                    {booking.hours} hrs per day
                  </span>
                )}
              </>
            )}
          </div>
        )
      })}
    </>
  )
}

// Export memoized component to prevent unnecessary re-renders
export default memo(BookingRenderer)

