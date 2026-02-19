import { memo } from 'react'
import { getDateForDay, parseLocalDateString, getDayIndex } from '../../lib/utils/dateUtils'
import { EDGE_THRESHOLD } from '../../lib/constants/gantt'

interface GanttBarRendererProps {
  task: any
  monthStart: Date
  totalDays: number
  onMouseDownTask: (task: any, e: any) => void
  onEditTask?: (task: any) => void
  dragPreview?: { startDayIndex: number, endDayIndex: number }
}

function GanttBarRenderer({
  task,
  monthStart,
  totalDays,
  onMouseDownTask,
  onEditTask,
  dragPreview
}: GanttBarRendererProps) {
  // Use preview position if task is being dragged, otherwise use actual dates
  let startDayIndex: number
  let endDayIndex: number
  
  if (dragPreview) {
    startDayIndex = dragPreview.startDayIndex
    endDayIndex = dragPreview.endDayIndex
  } else {
    const taskStartDate = parseLocalDateString(task.start_date)
    startDayIndex = getDayIndex(taskStartDate, monthStart)
    
    const taskEndDate = parseLocalDateString(task.end_date)
    endDayIndex = getDayIndex(taskEndDate, monthStart)
  }
  
  const spanDays = Math.max(1, endDayIndex - startDayIndex + 1)
  const leftPercent = (startDayIndex / totalDays) * 100
  const widthPercent = (spanDays / totalDays) * 100
  
  // Get task color or use default accent color
  const taskColor = task.color || 'var(--accent-primary)'
  const percentComplete = task.percent_complete || 0
  
  return (
    <div
      style={{
        position: 'absolute',
        left: `${leftPercent}%`,
        width: `${widthPercent}%`,
        top: '4px',
        height: '52px',
        background: taskColor,
        border: `2px solid ${taskColor}`,
        borderRadius: 6,
        padding: '4px 8px',
        fontSize: '12px',
        color: 'white',
        cursor: 'move',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '2px',
        zIndex: 2,
        pointerEvents: 'auto',
        opacity: dragPreview ? 0.7 : 1,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
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
        e.currentTarget.style.cursor = 'move'
      }}
      onDoubleClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onEditTask?.(task)
      }}
      onMouseDown={e => onMouseDownTask(task, e)}
      title={`${task.title} - ${getDateForDay(monthStart, startDayIndex).toLocaleDateString()}${
        spanDays > 1
          ? ` to ${getDateForDay(monthStart, endDayIndex).toLocaleDateString()}`
          : ''
      }${percentComplete > 0 ? ` (${percentComplete}% complete)` : ''}`}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
        {task.title}
      </span>
      {percentComplete > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: `${percentComplete}%`,
            background: 'rgba(255, 255, 255, 0.3)',
            borderRadius: '0 0 4px 4px'
          }}
        />
      )}
    </div>
  )
}

export default memo(GanttBarRenderer)

