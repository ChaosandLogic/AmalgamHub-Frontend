import { useMemo } from 'react'
import { getDateForDay, isToday } from '../../lib/utils/dateUtils'
import { DAY_COLUMN_WIDTH, ROW_HEIGHT } from '../../lib/constants/gantt'
import GanttBarRenderer from './GanttBarRenderer'

interface GanttTaskRowProps {
  task: any
  monthStart: Date
  totalDays: number
  onMouseDownCell: (dayIndex: number, e: any) => void
  onMouseDownTask: (task: any, e: any) => void
  onEditTask?: (task: any) => void
  dragPreview?: Record<string, { startDayIndex: number, endDayIndex: number }>
  canEdit?: boolean
}

export default function GanttTaskRow({
  task,
  monthStart,
  totalDays,
  onMouseDownCell,
  onMouseDownTask,
  onEditTask,
  dragPreview,
  canEdit = true
}: GanttTaskRowProps) {
  const days = useMemo(() => Array.from({ length: totalDays }, (_, i) => i), [totalDays])
  const taskPreview = dragPreview?.[task.id]
  
  return (
    <div
      id={`task-row-${task.id}`}
      style={{
        position: 'relative',
        height: ROW_HEIGHT,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: `repeat(${totalDays}, ${DAY_COLUMN_WIDTH}px)`,
        minWidth: `${totalDays * DAY_COLUMN_WIDTH}px`,
        boxSizing: 'border-box'
      }}
    >
      {days.map(dayIndex => {
        const date = getDateForDay(monthStart, dayIndex)
        const dayOfWeek = date.getDay()
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
        const isTodayDate = isToday(date)
        
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
                ? 'var(--accent-primary-light)'
                : isWeekend 
                  ? 'var(--priority-normal-bg)' 
                  : 'transparent',
              position: 'relative',
              zIndex: 1
            }}
            title={`${date.toLocaleDateString('en-GB')}${isTodayDate ? ' (Today)' : ''}`}
          />
        )
      })}
      <GanttBarRenderer
        task={task}
        monthStart={monthStart}
        totalDays={totalDays}
        onMouseDownTask={onMouseDownTask}
        onEditTask={onEditTask}
        dragPreview={taskPreview}
      />
    </div>
  )
}


