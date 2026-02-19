import { parseLocalDateString, normalizeToMidnight, getDayIndex } from '../../lib/utils/dateUtils'

export function calculateBookingLanes(
  bookings: any[],
  monthStart: Date,
  totalDays: number,
  dragPreview: Record<string, { startDayIndex: number, endDayIndex: number }> = {}
) {
  // Add position info to each booking
  const bookingsWithPositions = bookings.map(booking => {
    const preview = dragPreview[booking.id]
    let startDayIndex: number
    let endDayIndex: number
    
    if (preview) {
      startDayIndex = preview.startDayIndex
      endDayIndex = preview.endDayIndex
    } else {
      const bookingStartDate = parseLocalDateString(booking.start_date)
      startDayIndex = getDayIndex(bookingStartDate, monthStart)
      
      const bookingEndDate = parseLocalDateString(booking.end_date || booking.start_date)
      endDayIndex = getDayIndex(bookingEndDate, monthStart)
    }
    
    return {
      ...booking,
      startDayIndex,
      endDayIndex
    }
  })
  
  // Sort by start day, then by duration (longer first)
  bookingsWithPositions.sort((a, b) => {
    if (a.startDayIndex !== b.startDayIndex) {
      return a.startDayIndex - b.startDayIndex
    }
    return (b.endDayIndex - b.startDayIndex) - (a.endDayIndex - a.startDayIndex)
  })
  
  // Assign lanes using greedy algorithm
  const lanes: Array<{ endDay: number }> = []
  const bookingLanes = new Map<string, number>()
  
  bookingsWithPositions.forEach(booking => {
    // Find the first available lane
    let assignedLane = -1
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i].endDay < booking.startDayIndex) {
        assignedLane = i
        lanes[i].endDay = booking.endDayIndex
        break
      }
    }
    
    // If no lane available, create a new one
    if (assignedLane === -1) {
      assignedLane = lanes.length
      lanes.push({ endDay: booking.endDayIndex })
    }
    
    bookingLanes.set(booking.id, assignedLane)
  })
  
  return {
    bookingLanes,
    totalLanes: lanes.length
  }
}



