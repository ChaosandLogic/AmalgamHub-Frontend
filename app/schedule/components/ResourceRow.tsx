import { useMemo } from 'react'
import { getDateForDay, isToday, DAYS } from '../../lib/utils/dateUtils'
import { DAY_COLUMN_WIDTH, ROW_HEIGHT } from '../../lib/constants/schedule'
import { calculateBookingLanes } from '../utils/calculateBookingLanes'
import BookingRenderer from './BookingRenderer'

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

interface ResourceRowProps {
  resource: any
  monthStart: Date
  totalDays: number
  bookingsByDay: Record<number, any[]>
  onMouseDownCell: (dayIndex: number, e: any) => void
  onDeleteBooking: any
  dragPreview: Record<string, { startDayIndex: number, endDayIndex: number, resourceId?: string, booking?: any }>
  onMouseDownBooking: (booking: any, e: any) => void
  onEditBooking?: (booking: any) => void
  projectsById?: Record<string, any>
  canEdit?: boolean
}

export default function ResourceRow({
  resource,
  monthStart,
  totalDays,
  bookingsByDay,
  onMouseDownCell,
  onDeleteBooking,
  onMouseDownBooking,
  dragPreview,
  onEditBooking,
  projectsById,
  canEdit = true
}: ResourceRowProps) {
  const days = useMemo(() => Array.from({ length: totalDays }, (_, i) => i), [totalDays])
  
  // Collect all unique bookings for this resource
  const allBookings = useMemo(() => {
    const bookingMap = new Map<string, any>()
    Object.keys(bookingsByDay).forEach(dayIndexStr => {
      const dayBookings = bookingsByDay[parseInt(dayIndexStr)] || []
      dayBookings.forEach((booking: any) => {
        if (!bookingMap.has(booking.id)) {
          bookingMap.set(booking.id, booking)
        }
      })
    })
    return Array.from(bookingMap.values())
  }, [bookingsByDay])
  
  // Calculate lane assignments
  const laneInfo = useMemo(
    () => calculateBookingLanes(allBookings, monthStart, totalDays, dragPreview),
    [allBookings, monthStart, totalDays, dragPreview]
  )
  
  // Determine row height based on number of lanes
  // 0 or 1 lane: normal height (60px)
  // 2+ lanes: each booking gets 50% height (30px), row expands to accommodate all
  const HALF_HEIGHT = ROW_HEIGHT / 2 // 30px
  const rowHeight = laneInfo.totalLanes <= 1 ? ROW_HEIGHT : HALF_HEIGHT * laneInfo.totalLanes
  
  return (
    <div
      id={`track-${resource.id}`}
      style={{
        position: 'relative',
        height: rowHeight,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: `repeat(${totalDays}, ${DAY_COLUMN_WIDTH}px)`,
        minWidth: `${totalDays * DAY_COLUMN_WIDTH}px`
      }}
    >
      {days.map(dayIndex => {
        const date = getDateForDay(monthStart, dayIndex)
        const dayOfWeek = date.getDay()
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
        const isTodayDate = isToday(date)
        const avail = resource.availabilityTemplate
        const hoursThisDay = avail && typeof avail === 'object' ? (avail[DAY_KEYS[dayOfWeek]] ?? 0) : null
        const isUnavailable = hoursThisDay !== null && Number(hoursThisDay) === 0
        
        return (
          <div
            key={dayIndex}
            onMouseDown={e => {
              e.stopPropagation()
              onMouseDownCell(dayIndex, e)
            }}
            style={{
              cursor: canEdit ? 'crosshair' : 'default',
              borderLeft: isTodayDate ? '2px solid var(--accent-primary)' : '1px solid var(--border)',
              background: isTodayDate 
                ? 'var(--accent-primary-light)' // Light blue highlight for today
                : isUnavailable
                  ? 'var(--priority-normal-bg)' // Grey out days resource is not available
                  : isWeekend 
                    ? 'var(--priority-normal-bg)' 
                    : 'transparent',
              position: 'relative',
              zIndex: 1
            }}
            title={`${DAYS[dayOfWeek]}, ${date.toLocaleDateString()}${isTodayDate ? ' (Today)' : ''}${isUnavailable ? ' — Not available' : ''}`}
          />
        )
      })}
      <BookingRenderer
        bookingsByDay={bookingsByDay}
        monthStart={monthStart}
        totalDays={totalDays}
        onDeleteBooking={onDeleteBooking}
        onMouseDownBooking={onMouseDownBooking}
        dragPreview={dragPreview}
        onEditBooking={onEditBooking}
        laneInfo={laneInfo}
        resourceId={resource.id}
        projectsById={projectsById}
      />
    </div>
  )
}

