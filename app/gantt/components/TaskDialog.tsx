'use client'
import { useEffect, useState } from 'react'
import { useToast } from '../../components/Toast'
import { X, Calendar, User, FileText, Palette } from 'lucide-react'
import { getLocalDateString } from '../../lib/utils/dateUtils'

interface GanttTask {
  id: string
  title: string
  description?: string
  start_date: string
  end_date: string
  project_id?: string
  assignee_id?: string
  color?: string
  percent_complete?: number
}

interface TaskDialogProps {
  task?: GanttTask | null
  projectId?: string
  defaultStartDate?: string
  defaultEndDate?: string
  defaultColor?: string
  users?: any[]
  onSave: (taskData: any) => Promise<void>
  onDelete?: (taskId: string) => Promise<void>
  onClose: () => void
}

const TASK_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6',
  '#f97316', '#06b6d4', '#84cc16', '#eab308'
]

export default function TaskDialog({
  task,
  projectId,
  defaultStartDate,
  defaultEndDate,
  defaultColor,
  users = [],
  onSave,
  onDelete,
  onClose
}: TaskDialogProps) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [color, setColor] = useState(TASK_COLORS[0])
  const [percentComplete, setPercentComplete] = useState(0)

  const isEdit = !!task

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description || '')
      setStartDate(task.start_date ? task.start_date.substring(0, 10) : '')
      setEndDate(task.end_date ? task.end_date.substring(0, 10) : '')
      setAssigneeId(task.assignee_id || '')
      setColor(task.color || TASK_COLORS[0])
      setPercentComplete(task.percent_complete || 0)
    } else {
      // New task defaults
      const today = new Date()
      const defaultStart = defaultStartDate || getLocalDateString(today)
      const defaultEnd = defaultEndDate || getLocalDateString(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000))
      
      setTitle('')
      setDescription('')
      setStartDate(defaultStart)
      setEndDate(defaultEnd)
      setAssigneeId('')
      setColor(defaultColor || TASK_COLORS[0])
      setPercentComplete(0)
    }
  }, [task, defaultStartDate, defaultEndDate, defaultColor])

  async function handleSave() {
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }

    if (!startDate || !endDate) {
      toast.error('Start date and end date are required')
      return
    }

    if (new Date(endDate) < new Date(startDate)) {
      toast.error('End date must be after start date')
      return
    }

    setLoading(true)
    try {
      const taskData: any = {
        title: title.trim(),
        description: description.trim() || null,
        start_date: startDate,
        end_date: endDate,
        project_id: projectId || null,
        assignee_id: assigneeId || null,
        color: color,
        percent_complete: percentComplete
      }

      await onSave(taskData)
      onClose()
    } catch (error: unknown) {
      console.error('Error saving task:', error)
      toast.error((error instanceof Error ? error.message : String(error)) || 'Failed to save task')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!task || !onDelete) return
    
    if (!confirm('Are you sure you want to delete this task?')) {
      return
    }

    setLoading(true)
    try {
      await onDelete(task.id)
      onClose()
    } catch (error: unknown) {
      console.error('Error deleting task:', error)
      toast.error((error instanceof Error ? error.message : String(error)) || 'Failed to delete task')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--modal-backdrop)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 12,
          padding: 24,
          maxWidth: '600px',
          width: '90vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 10px 25px var(--shadow-lg)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>
            {isEdit ? 'Edit Task' : 'Create New Task'}
          </h3>
          <button
            onClick={onClose}
            style={{
              padding: 4,
              background: 'transparent',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Title */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Task title"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 14,
              background: 'var(--surface)',
              color: 'var(--text-primary)'
            }}
            autoFocus
          />
        </div>

        {/* Description */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
            <FileText size={14} />
            Description
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Task description..."
            rows={4}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 14,
              fontFamily: 'inherit',
              resize: 'vertical',
              background: 'var(--surface)',
              color: 'var(--text-primary)'
            }}
          />
        </div>

        {/* Dates */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
              <Calendar size={14} />
              Start Date *
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: 14,
                background: 'var(--surface)',
                color: 'var(--text-primary)'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
              <Calendar size={14} />
              End Date *
            </label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: 14,
                background: 'var(--surface)',
                color: 'var(--text-primary)'
              }}
            />
          </div>
        </div>

        {/* Assignee */}
        {users.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
              <User size={14} />
              Assignee
            </label>
            <select
              value={assigneeId}
              onChange={e => setAssigneeId(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: 14,
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              <option value="">Unassigned</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Color */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
            <Palette size={14} />
            Color
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TASK_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  border: color === c ? '3px solid var(--text-primary)' : '2px solid var(--border)',
                  background: c,
                  cursor: 'pointer',
                  padding: 0
                }}
                title={c}
              />
            ))}
          </div>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
            Progress: {percentComplete}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={percentComplete}
            onChange={e => setPercentComplete(parseInt(e.target.value))}
            style={{
              width: '100%'
            }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {isEdit && onDelete && (
            <button
              onClick={handleDelete}
              disabled={loading}
              style={{
                padding: '8px 16px',
                background: 'var(--error)',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 500
              }}
            >
              Delete
            </button>
          )}
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '8px 16px',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 500
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            style={{
              padding: '8px 16px',
              background: 'var(--accent-primary)',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 500
            }}
          >
            {loading ? 'Saving...' : isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

