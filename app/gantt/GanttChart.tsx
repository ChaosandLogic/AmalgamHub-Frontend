'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '../components/Toast'
import { clamp, getDateForDay, getLocalDateString, parseLocalDateString, normalizeToMidnight, getDayIndex } from '../lib/utils/dateUtils'
import { 
  DAY_COLUMN_WIDTH, 
  ROW_HEIGHT, 
  MONTHS_TO_DISPLAY,
  EDGE_THRESHOLD
} from '../lib/constants/gantt'
import GanttTimelineHeader from './components/GanttTimelineHeader'
import GanttTaskRow from './components/GanttTaskRow'
import TaskDialog from './components/TaskDialog'

interface GanttChartProps {
  monthStart: Date
  projectId?: string
  onTaskCreated?: () => void
}

export default function GanttChart({ monthStart, projectId, onTaskCreated }: GanttChartProps) {
  const toast = useToast()
  const timelineRef = useRef<HTMLDivElement>(null)
  const [user, setUser] = useState<{ role: string } | null>(null)
  
  // Calculate total days for 6 months ahead
  const totalDays = useMemo(() => {
    const endDate = new Date(monthStart)
    endDate.setMonth(endDate.getMonth() + MONTHS_TO_DISPLAY)
    const diffTime = endDate.getTime() - monthStart.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }, [monthStart])
  
  const [tasks, setTasks] = useState<any[]>([])
  const [showTaskDialog, setShowTaskDialog] = useState(false)
  const [newTaskData, setNewTaskData] = useState<any>(null)
  const [editingTask, setEditingTask] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null)
  const [editingTitleValue, setEditingTitleValue] = useState<string>('')

  // Get current color in cycle (without advancing)
  const getCurrentColor = (): string => {
    const TASK_COLORS = [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
      '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6',
      '#f97316', '#06b6d4', '#84cc16', '#eab308'
    ]
    
    if (!projectId) return TASK_COLORS[0]
    
    try {
      // Get last color index for this project
      const lastIndexStr = localStorage.getItem(`gantt_lastColorIndex_${projectId}`)
      const lastIndex = lastIndexStr ? parseInt(lastIndexStr, 10) : -1
      
      // Get next color index (but don't store it yet)
      const nextIndex = (lastIndex + 1) % TASK_COLORS.length
      
      return TASK_COLORS[nextIndex]
    } catch (e) {
      console.error('Error getting current color:', e)
      return TASK_COLORS[0]
    }
  }

  // Advance color cycle (call when task is successfully created)
  const advanceColorCycle = () => {
    if (!projectId) return
    
    try {
      const TASK_COLORS = [
        '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
        '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6',
        '#f97316', '#06b6d4', '#84cc16', '#eab308'
      ]
      
      const lastIndexStr = localStorage.getItem(`gantt_lastColorIndex_${projectId}`)
      const lastIndex = lastIndexStr ? parseInt(lastIndexStr, 10) : -1
      const nextIndex = (lastIndex + 1) % TASK_COLORS.length
      
      localStorage.setItem(`gantt_lastColorIndex_${projectId}`, nextIndex.toString())
    } catch (e) {
      console.error('Error advancing color cycle:', e)
    }
  }
  
  // Preview positions for tasks being dragged: { taskId: { startDayIndex, endDayIndex } }
  const [dragPreview, setDragPreview] = useState<Record<string, { startDayIndex: number, endDayIndex: number }>>({})
  
  // Drag state
  const draggingRef = useRef<{
    type: 'create' | 'move' | 'resize' | 'duplicate'
    taskId?: string
    startDay: number
    endDay: number
    originalStartDay?: number
    originalEndDay?: number
    edge?: 'start' | 'end'
  } | null>(null)
  const isDraggingRef = useRef(false)

  // Load user
  useEffect(() => {
    fetch('/api/user', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data?.user) {
          setUser(data.data.user)
        }
      })
      .catch(err => console.error('Error loading user:', err))
  }, [])

  // Load users for assignee dropdown
  useEffect(() => {
    fetch('/api/users', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        // Handle both old and new response formats
        const users = data.success && data.data?.users 
          ? data.data.users 
          : data.users || []
        setUsers(users)
      })
      .catch(err => console.error('Error loading users:', err))
  }, [])

  // Load tasks
  const loadTasks = async () => {
    try {
      const params = new URLSearchParams()
      if (projectId) params.append('projectId', projectId)
      
      // Don't filter by date range - show all tasks for the project
      // Tasks outside the visible range will just be positioned off-screen
      
      const response = await fetch(`/api/gantt/tasks?${params.toString()}`, {
        credentials: 'include'
      })
      
      if (!response.ok) {
        throw new Error('Failed to load tasks')
      }
      
      const data = await response.json()
      if (data.success && data.data?.tasks) {
        setTasks(data.data.tasks)
      }
    } catch (error) {
      console.error('Error loading tasks:', error)
      toast.error('Failed to load tasks')
    }
  }

  useEffect(() => {
    loadTasks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStart, projectId, totalDays])

  // Global mouse handlers
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!draggingRef.current) return
      
      // Find which task row the mouse is over
      let hoverDay = 0
      let foundRow = false
      const taskRows = document.querySelectorAll('[id^="task-row-"]')
      
      for (const row of taskRows) {
        const rect = row.getBoundingClientRect()
        if (e.clientY >= rect.top && e.clientY <= rect.bottom &&
            e.clientX >= rect.left && e.clientX <= rect.right) {
          const relativeX = clamp(e.clientX - rect.left, 0, rect.width)
          const dayWidth = rect.width / totalDays
          hoverDay = clamp(Math.floor(relativeX / dayWidth), 0, totalDays - 1)
          foundRow = true
          break
        }
      }
      
      // If we're dragging a task and not over a row, still update based on timeline
      if (!foundRow && draggingRef.current.taskId && timelineRef.current) {
        // Find the scrollable timeline container
        const timelineContainer = timelineRef.current.querySelector('[style*="overflow"]') as HTMLElement
        if (timelineContainer) {
          const rect = timelineContainer.getBoundingClientRect()
          if (e.clientX >= rect.left && e.clientX <= rect.right &&
              e.clientY >= rect.top && e.clientY <= rect.bottom) {
            const relativeX = clamp(e.clientX - rect.left, 0, rect.width)
            const dayWidth = rect.width / totalDays
            hoverDay = clamp(Math.floor(relativeX / dayWidth), 0, totalDays - 1)
            foundRow = true
          }
        }
      }
      
      // For create operations, update endDay
      if (draggingRef.current.type === 'create') {
        draggingRef.current.endDay = hoverDay
      } else if (draggingRef.current.taskId) {
        // For move/resize/duplicate, update endDay and apply drag
        draggingRef.current.endDay = hoverDay
        applyDrag()
      }
    }

    function onMouseUp() {
      if (!draggingRef.current) {
        return
      }

      const dragType = draggingRef.current.type
      const dragTaskId = draggingRef.current.taskId

      if (dragType === 'create') {
        const { startDay, endDay } = draggingRef.current
        const start = Math.min(startDay, endDay)
        const end = Math.max(startDay, endDay)
        
        const startDate = getDateForDay(monthStart, start)
        const endDate = getDateForDay(monthStart, end)
        
        setNewTaskData({
          startDate: getLocalDateString(startDate),
          endDate: getLocalDateString(endDate)
        })
        setShowTaskDialog(true)
        draggingRef.current = null
        isDraggingRef.current = false
        setDragPreview({})
      } else if (dragType === 'move') {
        saveTaskMove()
      } else if (dragType === 'resize') {
        saveTaskResize()
      } else if (dragType === 'duplicate') {
        saveTaskDuplicate()
      }
      
      draggingRef.current = null
      isDraggingRef.current = false
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [totalDays, monthStart, projectId, tasks])

  function onMouseDownCell(taskRowId: string, dayIndex: number, e: any) {
    e.preventDefault()
    e.stopPropagation()
    
    if (user?.role !== 'admin' && user?.role !== 'booker') {
      return
    }
    
    isDraggingRef.current = true
    draggingRef.current = {
      type: 'create',
      taskId: undefined,
      startDay: dayIndex,
      endDay: dayIndex
    }
  }

  function onMouseDownTask(task: any, e: any) {
    e.preventDefault()
    e.stopPropagation()
    
    if (user?.role !== 'admin' && user?.role !== 'booker') {
      return
    }
    
    isDraggingRef.current = true
    
    const taskStartDate = normalizeToMidnight(parseLocalDateString(task.start_date))
    const taskEndDate = normalizeToMidnight(parseLocalDateString(task.end_date))
    const monthStartNormalized = normalizeToMidnight(new Date(monthStart))
    const startDayIndex = Math.floor(
      (taskStartDate.getTime() - monthStartNormalized.getTime()) / (1000 * 60 * 60 * 24)
    )
    const endDayIndex = Math.floor(
      (taskEndDate.getTime() - monthStartNormalized.getTime()) / (1000 * 60 * 60 * 24)
    )

    const row = document.getElementById(`task-row-${task.id}`)
    if (!row) {
      draggingRef.current = {
        type: 'move',
        taskId: task.id,
        startDay: startDayIndex,
        endDay: startDayIndex
      }
      return
    }

    const rect = row.getBoundingClientRect()
    const relativeX = e.clientX - rect.left
    const dayWidth = rect.width / totalDays
    const taskLeft = startDayIndex * dayWidth
    const taskRight = (endDayIndex + 1) * dayWidth
    const handleWidth = Math.min(EDGE_THRESHOLD, dayWidth / 2)

    const nearLeft = relativeX >= taskLeft && relativeX <= taskLeft + handleWidth
    const nearRight = relativeX <= taskRight && relativeX >= taskRight - handleWidth

    if (nearLeft) {
      draggingRef.current = {
        type: 'resize',
        edge: 'start',
        taskId: task.id,
        startDay: startDayIndex,
        endDay: endDayIndex
      }
    } else if (nearRight) {
      draggingRef.current = {
        type: 'resize',
        edge: 'end',
        taskId: task.id,
        startDay: startDayIndex,
        endDay: endDayIndex
      }
    } else {
      const isDuplicating = e.shiftKey
      draggingRef.current = {
        type: isDuplicating ? 'duplicate' : 'move',
        taskId: task.id,
        startDay: startDayIndex,
        endDay: startDayIndex,
        originalStartDay: startDayIndex,
        originalEndDay: endDayIndex
      }
    }
  }

  function applyDrag() {
    const drag = draggingRef.current
    if (!drag) return
    
    // For create operations, we don't need preview
    if (drag.type === 'create') {
      return
    }
    
    if (!drag.taskId) return
    
    const task = tasks.find(t => t.id === drag.taskId)
    if (!task) return
    
    let previewStart = drag.startDay
    let previewEnd = drag.endDay
    
    if (drag.type === 'move' || drag.type === 'duplicate') {
      const originalDragStart = drag.originalStartDay ?? drag.startDay
      const daysDiff = drag.endDay - originalDragStart
      const taskStartDate = normalizeToMidnight(parseLocalDateString(task.start_date))
      const taskEndDate = normalizeToMidnight(parseLocalDateString(task.end_date))
      const monthStartNormalized = normalizeToMidnight(new Date(monthStart))
      const originalStartIndex = Math.floor(
        (taskStartDate.getTime() - monthStartNormalized.getTime()) / (1000 * 60 * 60 * 24)
      )
      const originalEndIndex = Math.floor(
        (taskEndDate.getTime() - monthStartNormalized.getTime()) / (1000 * 60 * 60 * 24)
      )
      const spanDays = originalEndIndex - originalStartIndex
      
      previewStart = clamp(originalStartIndex + daysDiff, 0, totalDays - 1)
      previewEnd = clamp(previewStart + spanDays, previewStart, totalDays - 1)
    } else if (drag.type === 'resize') {
      const newEdgeDay = clamp(drag.endDay, 0, totalDays - 1)
      const taskStartDate = normalizeToMidnight(parseLocalDateString(task.start_date))
      const taskEndDate = normalizeToMidnight(parseLocalDateString(task.end_date))
      const monthStartNormalized = normalizeToMidnight(new Date(monthStart))
      const originalStartIndex = Math.floor(
        (taskStartDate.getTime() - monthStartNormalized.getTime()) / (1000 * 60 * 60 * 24)
      )
      const originalEndIndex = Math.floor(
        (taskEndDate.getTime() - monthStartNormalized.getTime()) / (1000 * 60 * 60 * 24)
      )
      
      if (drag.edge === 'start') {
        previewStart = Math.min(newEdgeDay, originalEndIndex)
        previewEnd = originalEndIndex
      } else if (drag.edge === 'end') {
        previewStart = originalStartIndex
        previewEnd = Math.max(newEdgeDay, originalStartIndex)
      }
    }
    
    setDragPreview({
      [drag.taskId]: {
        startDayIndex: previewStart,
        endDayIndex: previewEnd
      }
    })
  }

  async function saveTaskMove() {
    const drag = draggingRef.current
    if (!drag || drag.type !== 'move' || !drag.taskId) return
    
    const task = tasks.find(t => t.id === drag.taskId)
    if (!task) return
    
    const originalStartDay = drag.originalStartDay ?? drag.startDay
    const newDayIndex = clamp(drag.endDay, 0, totalDays - 1)
    const daysDiff = newDayIndex - originalStartDay
    
    if (daysDiff === 0) return
    
    const taskStartDate = normalizeToMidnight(parseLocalDateString(task.start_date))
    const taskEndDate = normalizeToMidnight(parseLocalDateString(task.end_date))
    
    const newStartDate = new Date(taskStartDate)
    newStartDate.setDate(newStartDate.getDate() + daysDiff)
    
    const newEndDate = new Date(taskEndDate)
    newEndDate.setDate(newEndDate.getDate() + daysDiff)
    
    try {
      const response = await fetch(`/api/gantt/tasks/${task.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dayOffset: daysDiff })
      })
      
      if (response.ok) {
        await loadTasks()
        toast.success('Task moved')
        setDragPreview({})
      } else {
        const errorData = await response.json()
        toast.error(errorData.message || 'Failed to move task')
      }
    } catch (error) {
      console.error('Error moving task:', error)
      toast.error('Failed to move task')
    }
  }

  async function saveTaskResize() {
    const drag = draggingRef.current
    if (!drag || drag.type !== 'resize' || !drag.taskId || !drag.edge) return
    
    const task = tasks.find(t => t.id === drag.taskId)
    if (!task) return
    
    const newDayIndex = clamp(drag.endDay, 0, totalDays - 1)
    const newDate = getDateForDay(monthStart, newDayIndex)
    const newDateStr = getLocalDateString(newDate)
    
    try {
      const response = await fetch(`/api/gantt/tasks/${task.id}/resize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ edge: drag.edge, newDate: newDateStr })
      })
      
      if (response.ok) {
        await loadTasks()
        toast.success('Task resized')
        setDragPreview({})
      } else {
        const errorData = await response.json()
        toast.error(errorData.message || 'Failed to resize task')
      }
    } catch (error) {
      console.error('Error resizing task:', error)
      toast.error('Failed to resize task')
    }
  }

  async function saveTaskDuplicate() {
    const drag = draggingRef.current
    if (!drag || drag.type !== 'duplicate' || !drag.taskId) return
    
    const task = tasks.find(t => t.id === drag.taskId)
    if (!task) return
    
    const originalStartDay = drag.originalStartDay ?? drag.startDay
    const newDayIndex = clamp(drag.endDay, 0, totalDays - 1)
    const daysDiff = newDayIndex - originalStartDay
    
    const taskStartDate = normalizeToMidnight(parseLocalDateString(task.start_date))
    const taskEndDate = normalizeToMidnight(parseLocalDateString(task.end_date))
    
    const newStartDate = new Date(taskStartDate)
    newStartDate.setDate(newStartDate.getDate() + daysDiff)
    
    const newEndDate = new Date(taskEndDate)
    newEndDate.setDate(newEndDate.getDate() + daysDiff)
    
    try {
      const response = await fetch('/api/gantt/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: `${task.title} (Copy)`,
          description: task.description,
          start_date: getLocalDateString(newStartDate),
          end_date: getLocalDateString(newEndDate),
          project_id: task.project_id,
          board_id: task.board_id,
          assignee_id: task.assignee_id,
          color: task.color,
          percent_complete: 0
        })
      })
      
      if (response.ok) {
        await loadTasks()
        toast.success('Task duplicated')
        setDragPreview({})
        onTaskCreated?.()
      } else {
        const errorData = await response.json()
        toast.error(errorData.message || 'Failed to duplicate task')
      }
    } catch (error) {
      console.error('Error duplicating task:', error)
      toast.error('Failed to duplicate task')
    }
  }

  const canEdit = user?.role === 'admin' || user?.role === 'booker'

  // Listen for new task event from page header
  useEffect(() => {
    const handleNewTask = () => {
      if (canEdit) {
        setNewTaskData({
          startDate: getLocalDateString(new Date()),
          endDate: getLocalDateString(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
        })
        setShowTaskDialog(true)
      }
    }

    window.addEventListener('gantt:new-task', handleNewTask)
    return () => window.removeEventListener('gantt:new-task', handleNewTask)
  }, [canEdit])

  return (
    <div
      ref={timelineRef}
      data-gantt-chart
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        background: 'transparent',
        overflow: 'hidden'
      }}
    >
      <div style={{ display: 'flex', position: 'relative', overflow: 'hidden', flex: 1 }}>
        {/* Sticky left column for task names */}
        <div style={{ 
          position: 'relative',
          zIndex: 10, 
          background: 'var(--surface)',
          borderRight: '2px solid var(--border)',
          minWidth: 400,
          width: 400,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Header with column titles */}
          <div style={{ 
            height: 105, 
            borderBottom: '2px solid var(--border)',
            flexShrink: 0,
            background: 'var(--surface)',
            padding: '0 16px',
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 0.8fr 0.8fr',
            gap: '12px',
            alignItems: 'center',
            boxSizing: 'border-box',
            position: 'sticky',
            top: 0,
            zIndex: 10
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Task
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Assigned To
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
              From
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
              To
            </div>
          </div>
          
          {/* Scrollable task rows */}
          <div style={{ overflowY: 'auto', flex: 1, margin: 0, padding: 0 }}>
            {tasks.map((task, idx) => {
              const assignee = users.find(u => u.id === task.assignee_id)
              const startDate = task.start_date ? new Date(task.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
              const endDate = task.end_date ? new Date(task.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
              
              const isEditingTitle = editingTitleId === task.id
              
              return (
                <div
                  key={task.id}
                  style={{
                    height: ROW_HEIGHT,
                    padding: '0 16px',
                    borderBottom: '1px solid var(--border)',
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 0.8fr 0.8fr',
                    gap: '12px',
                    alignItems: 'center',
                    background: 'var(--bg-secondary)',
                    fontSize: 12,
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box'
                  }}
                >
                  {isEditingTitle ? (
                    <input
                      type="text"
                      value={editingTitleValue}
                      onChange={(e) => setEditingTitleValue(e.target.value)}
                      onBlur={async () => {
                        if (editingTitleValue.trim() && editingTitleValue !== task.title) {
                          try {
                            const response = await fetch(`/api/gantt/tasks/${task.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              credentials: 'include',
                              body: JSON.stringify({ title: editingTitleValue.trim() })
                            })
                            
                            if (!response.ok) {
                              const errorData = await response.json()
                              throw new Error(errorData.message || 'Failed to update task')
                            }
                            
                            await loadTasks()
                            toast.success('Task title updated')
                          } catch (error: any) {
                            console.error('Error updating task title:', error)
                            toast.error(error.message || 'Failed to update task title')
                            setEditingTitleValue(task.title)
                          }
                        } else {
                          setEditingTitleValue(task.title)
                        }
                        setEditingTitleId(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur()
                        } else if (e.key === 'Escape') {
                          setEditingTitleValue(task.title)
                          setEditingTitleId(null)
                        }
                      }}
                      autoFocus
                      style={{
                        width: '100%',
                        padding: '4px 8px',
                        border: '1px solid var(--accent-primary)',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 500,
                        background: 'var(--surface)',
                        color: 'var(--text-primary)',
                        outline: 'none'
                      }}
                    />
                  ) : (
                    <div 
                      style={{ 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap', 
                        fontWeight: 500,
                        cursor: canEdit ? 'text' : 'default',
                        padding: '2px 4px',
                        borderRadius: '4px'
                      }}
                      onDoubleClick={() => {
                        if (canEdit) {
                          setEditingTitleId(task.id)
                          setEditingTitleValue(task.title)
                        }
                      }}
                      title={canEdit ? 'Double-click to edit' : task.title}
                    >
                      {task.title}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {assignee ? (assignee.name || assignee.email) : '-'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {startDate || '-'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {endDate || '-'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        
        {/* Scrollable timeline */}
        <div style={{ overflow: 'auto', flex: 1, position: 'relative', margin: 0, padding: 0 }}>
          <GanttTimelineHeader monthStart={monthStart} totalDays={totalDays} />
          
          <div style={{ position: 'relative', margin: 0, padding: 0 }}>
            {tasks.map((task) => (
              <GanttTaskRow
                key={task.id}
                task={task}
                monthStart={monthStart}
                totalDays={totalDays}
                onMouseDownCell={(dayIndex, e) => onMouseDownCell(`task-row-${task.id}`, dayIndex, e)}
                onMouseDownTask={onMouseDownTask}
                onEditTask={(task) => setEditingTask(task)}
                dragPreview={dragPreview}
                canEdit={canEdit}
              />
            ))}
          </div>
        </div>
      </div>
      
      {/* Task creation/edit dialog */}
      {(showTaskDialog || editingTask) && (
        <TaskDialog
          task={editingTask}
          projectId={projectId}
          defaultStartDate={newTaskData?.startDate}
          defaultEndDate={newTaskData?.endDate}
          defaultColor={!editingTask ? getCurrentColor() : undefined}
          users={users}
          onSave={async (taskData) => {
            if (editingTask) {
              // Update existing task
              const response = await fetch(`/api/gantt/tasks/${editingTask.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(taskData)
              })
              
              if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.message || 'Failed to update task')
              }
              
              await loadTasks()
              toast.success('Task updated')
            } else {
              // Create new task
              const response = await fetch('/api/gantt/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(taskData)
              })
              
              if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.message || 'Failed to create task')
              }
              
              await loadTasks()
              advanceColorCycle() // Advance color for next task
              toast.success('Task created')
              onTaskCreated?.()
            }
          }}
          onDelete={editingTask ? async (taskId) => {
            const response = await fetch(`/api/gantt/tasks/${taskId}`, {
              method: 'DELETE',
              credentials: 'include'
            })
            
            if (!response.ok) {
              const errorData = await response.json()
              throw new Error(errorData.message || 'Failed to delete task')
            }
            
            await loadTasks()
            toast.success('Task deleted')
          } : undefined}
          onClose={() => {
            setShowTaskDialog(false)
            setNewTaskData(null)
            setEditingTask(null)
          }}
        />
      )}
    </div>
  )
}

