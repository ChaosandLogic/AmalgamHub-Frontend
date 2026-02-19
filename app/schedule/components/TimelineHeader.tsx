import { DAY_COLUMN_WIDTH } from '../../lib/constants/schedule'
import { getDateForDay, isMonthStart, getMonthName, getWeekNumber, isToday, DAYS } from '../../lib/utils/dateUtils'

interface TimelineHeaderProps {
  monthStart: Date
  totalDays: number
  hasDepartmentFilter: boolean
}

export default function TimelineHeader({ monthStart, totalDays, hasDepartmentFilter }: TimelineHeaderProps) {
  // Dynamic heights to match resource header bar
  // Standard: 105px total, With department: 140px total
  const baseHeight = hasDepartmentFilter ? 140 : 105
  // Proportionally distribute: month 36%, week 28%, day 36% of base
  const MONTH_HEADER_HEIGHT = hasDepartmentFilter ?48 : 36
  const WEEK_HEADER_HEIGHT = hasDepartmentFilter ? 40 : 30
  const DAY_HEADER_HEIGHT = hasDepartmentFilter ? 50 : 37
  
  // Calculate month and week spans
  const monthSpans: Array<{ start: number; end: number; monthName: string }> = []
  const weekSpans: Array<{ start: number; end: number; weekNum: number }> = []
  
  let currentMonthStart = -1
  let currentMonthName = ''
  let currentWeekStart = -1
  let currentWeekNum = -1
  
  for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
    const date = getDateForDay(monthStart, dayIndex)
    const dayOfWeek = date.getDay()
    
    // Check for month start
    if (isMonthStart(date)) {
      if (currentMonthStart >= 0) {
        monthSpans.push({ start: currentMonthStart, end: dayIndex - 1, monthName: currentMonthName })
      }
      currentMonthStart = dayIndex
      currentMonthName = getMonthName(date)
    }
    
    // Check for week start (Monday = 1, or first day)
    if (dayOfWeek === 1 || (dayIndex === 0 && currentWeekStart < 0)) {
      if (currentWeekStart >= 0) {
        weekSpans.push({ start: currentWeekStart, end: dayIndex - 1, weekNum: currentWeekNum })
      }
      currentWeekStart = dayIndex
      currentWeekNum = getWeekNumber(date)
    }
  }
  
  // Close final spans
  if (currentMonthStart >= 0) {
    monthSpans.push({ start: currentMonthStart, end: totalDays - 1, monthName: currentMonthName })
  }
  if (currentWeekStart >= 0) {
    weekSpans.push({ start: currentWeekStart, end: totalDays - 1, weekNum: currentWeekNum })
  }
  
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: `${totalDays * DAY_COLUMN_WIDTH}px`,
        background: 'var(--surface)',
        borderBottom: '2px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 5
      }}
    >
      {/* Month header row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${totalDays}, ${DAY_COLUMN_WIDTH}px)`,
          height: MONTH_HEADER_HEIGHT,
          position: 'relative'
        }}
      >
        {monthSpans.map((span, idx) => (
          <div
            key={`month-${idx}`}
            style={{
              position: 'absolute',
              left: `${(span.start / totalDays) * 100}%`,
              width: `${((span.end - span.start + 1) / totalDays) * 100}%`,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-primary)',
              borderLeft: span.start === 0 ? 'none' : '1px solid var(--border)',
              borderRight: '1px solid var(--border)',
              background: 'var(--bg-secondary)'
            }}
          >
            {span.monthName}
          </div>
        ))}
      </div>
      
      {/* Week number row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${totalDays}, ${DAY_COLUMN_WIDTH}px)`,
          height: WEEK_HEADER_HEIGHT,
          position: 'relative'
        }}
      >
        {weekSpans.map((span, idx) => (
          <div
            key={`week-${idx}`}
            style={{
              position: 'absolute',
              left: `${(span.start / totalDays) * 100}%`,
              width: `${((span.end - span.start + 1) / totalDays) * 100}%`,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              borderLeft: span.start === 0 ? 'none' : '1px solid var(--border)',
              borderRight: '1px solid var(--border)',
              background: 'var(--surface)'
            }}
          >
            W{span.weekNum}
          </div>
        ))}
      </div>
      
      {/* Day header row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${totalDays}, ${DAY_COLUMN_WIDTH}px)`,
          height: DAY_HEADER_HEIGHT,
        }}
      >
        {Array.from({ length: totalDays }, (_, dayIndex) => {
          const date = getDateForDay(monthStart, dayIndex)
          const dayOfWeek = date.getDay()
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
          const isTodayDate = isToday(date)
          
          return (
            <div
              key={dayIndex}
              style={{
                fontSize: 11,
                color: isTodayDate ? 'var(--accent-primary)' : isWeekend ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                fontWeight: isTodayDate ? 600 : 500,
                paddingLeft: '2px',
                borderLeft: isTodayDate ? '2px solid var(--accent-primary)' : '1px solid var(--border)',
                background: isTodayDate ? 'var(--accent-primary-light)' : 'transparent',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}
              title={`${date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}${isTodayDate ? ' (Today)' : ''}`}
            >
              <div>{DAYS[dayOfWeek].substring(0, 3)}</div>
              <div style={{ fontSize: 10, marginTop: 2 }}>{date.getDate()}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


