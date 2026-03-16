'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import { getDateForDay, getLocalDateString, parseLocalDateString, normalizeToMidnight } from '../../lib/utils/dateUtils'
import { useToast } from '../../components/Toast'
import ConfirmDialog from '../../components/ConfirmDialog'

function getClientName(p: any): string {
  return (p?.client_name ?? p?.clientName ?? '') || 'No company'
}

interface BookingDialogProps {
  data: any
  booking: any
  projects: any[]
  users: any[]
  monthStart: Date
  onSave: (data: any) => Promise<void>
  onDelete?: () => void
  onCancel: () => void
}

export default function BookingDialog({ data, booking, projects, users, monthStart, onSave, onDelete, onCancel }: BookingDialogProps) {
  const toast = useToast()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const isEdit = !!booking
  // Determine if this is a time off booking based on title or description
  const isTimeOffBooking = (booking?.title ?? '').toLowerCase().includes('holiday') ||
                           (booking?.title ?? '').toLowerCase().includes('sick') ||
                           (booking?.title ?? '').toLowerCase().includes('public holiday') ||
                           (booking?.title ?? '').toLowerCase().includes('non work') ||
                           (booking?.title ?? '').toLowerCase().includes('non-work') ||
                           (booking?.description ?? '').toLowerCase().includes('time off')
  
  const [activeTab, setActiveTab] = useState<'booking' | 'timeoff'>(isEdit && isTimeOffBooking ? 'timeoff' : 'booking')
  const [title, setTitle] = useState(booking?.title || '')
  const [projectId, setProjectId] = useState(booking?.project_id || '')
  const [color, setColor] = useState(booking?.color || 'var(--accent-primary)')
  const [hours, setHours] = useState(booking?.hours ? String(booking.hours) : '')
  const [startDate, setStartDate] = useState(() => {
    if (booking) return booking.start_date
    if (data) return getLocalDateString(getDateForDay(monthStart, data.startDay))
    return ''
  })
  const [endDate, setEndDate] = useState(() => {
    if (booking) return booking.end_date
    if (data) return getLocalDateString(getDateForDay(monthStart, data.endDay))
    return ''
  })
  const [priority, setPriority] = useState(booking?.priority || 'normal')
  const [projectManagerId, setProjectManagerId] = useState(booking?.project_manager_id || '')
  const [tentative, setTentative] = useState(booking?.tentative || false)
  
  // Time off specific state
  const [timeOffType, setTimeOffType] = useState<'holiday' | 'sick' | 'public' | 'nonwork'>(() => {
    const t = (booking?.title ?? '').toLowerCase()
    if (t.includes('holiday')) return 'holiday'
    if (t.includes('sick')) return 'sick'
    if (t.includes('public')) return 'public'
    if (t.includes('non work') || t.includes('non-work')) return 'nonwork'
    return 'holiday'
  })
  const [repeatEnabled, setRepeatEnabled] = useState(false)
  const [repeatType, setRepeatType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('yearly')
  const [repeatEndDate, setRepeatEndDate] = useState('')
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false)
  const [projectSearch, setProjectSearch] = useState('')
  const projectDropdownRef = useRef<HTMLDivElement>(null)
  
  // Update form when booking changes
  useEffect(() => {
    if (booking) {
      setTitle(booking.title || '')
      setProjectId(booking.project_id || '')
      setColor(booking.color || 'var(--accent-primary)')
      setHours(booking.hours ? String(booking.hours) : '')
      setStartDate(booking.start_date)
      setEndDate(booking.end_date)
      setPriority(booking.priority || 'normal')
      setProjectManagerId(booking.project_manager_id || '')
      setTentative(booking.tentative || false)
    } else if (data) {
      // Update dates from data when creating new booking
      setStartDate(getLocalDateString(getDateForDay(monthStart, data.startDay)))
      setEndDate(getLocalDateString(getDateForDay(monthStart, data.endDay)))
    }
  }, [booking, data, monthStart])

  const selectedProject = projects.find((p: any) => p.id === projectId)

  // When project changes (booking tab), resolve FileMaker name to user id for save payload.
  // Use Project Manager first; if empty, fall back to Account Manager. Match by exact name or prefix (e.g. "Glen W" -> "Glen Wilde").
  // Exclude makers (job_role === 'maker') so only non-maker resources can match as project manager.
  useEffect(() => {
    if (activeTab !== 'booking' || !selectedProject) return
    const fmName = (String(selectedProject.project_manager || '').trim() || String(selectedProject.account_manager || '').trim())
    if (!fmName) return
    const fmLower = fmName.toLowerCase()
    const userList = (users || []).filter(
      (u: any) => (u?.job_role ?? '').toString().trim().toLowerCase() !== 'maker'
    )
    const exactMatch = userList.find(
      (u: any) => (u?.name ?? '').toString().trim().toLowerCase() === fmLower
    )
    const match = exactMatch ?? userList.find(
      (u: any) => (u?.name ?? '').toString().trim().toLowerCase().startsWith(fmLower)
    )
    setProjectManagerId(match?.id ?? '')
  }, [projectId, selectedProject?.project_manager, selectedProject?.account_manager, activeTab, users])
  
  // Searchable project list: filter then group by company (sub-summary header)
  const projectSearchLower = projectSearch.trim().toLowerCase()
  const filteredProjects = useMemo(() => {
    if (!projectSearchLower) return projects
    return projects.filter((p: any) => {
      const name = (p?.name ?? '').toLowerCase()
      const client = getClientName(p).toLowerCase()
      return name.includes(projectSearchLower) || client.includes(projectSearchLower)
    })
  }, [projects, projectSearchLower])
  const projectsByCompany = useMemo(() => {
    const map = new Map<string, any[]>()
    filteredProjects.forEach((p: any) => {
      const key = getClientName(p)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    })
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredProjects])
  
  // Close project dropdown on click outside
  useEffect(() => {
    if (!projectDropdownOpen) return
    const handle = (e: MouseEvent) => {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target as Node)) {
        setProjectDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [projectDropdownOpen])
  
  // Generate time off title based on type
  const getTimeOffTitle = () => {
    switch (timeOffType) {
      case 'holiday':
        return 'Holiday'
      case 'sick':
        return 'Sick Day'
      case 'public':
        return 'Public Holiday'
      case 'nonwork':
        return 'Non Work Day'
      default:
        return 'Time Off'
    }
  }
  
  // Calculate repeat dates
  const calculateRepeatDates = () => {
    if (!repeatEnabled) return []
    
    // Get dates from state or calculate from data
    let startDateStr = startDate
    let endDateStr = endDate
    
    if (!startDateStr || !endDateStr) {
      // Fallback to calculating from data if dates aren't set
      if (data) {
        startDateStr = getLocalDateString(getDateForDay(monthStart, data.startDay))
        endDateStr = getLocalDateString(getDateForDay(monthStart, data.endDay))
      } else {
        return []
      }
    }
    
    const dates: Array<{ startDate: string; endDate: string }> = []
    
    // Parse dates and normalize to midnight
    const start = normalizeToMidnight(new Date(startDateStr))
    const end = normalizeToMidnight(new Date(endDateStr))
    
    // Calculate duration in days (inclusive of both start and end dates)
    // If start and end are the same day, duration is 1. Otherwise, it's the difference + 1
    const durationDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)
    
    let currentStart = new Date(start)
    const repeatEndDateObj = repeatEndDate 
      ? normalizeToMidnight(new Date(repeatEndDate))
      : new Date(currentStart.getFullYear() + 1, currentStart.getMonth(), currentStart.getDate())
    
    // Always include the first occurrence
    while (currentStart <= repeatEndDateObj) {
      const currentEnd = new Date(currentStart)
      currentEnd.setDate(currentEnd.getDate() + durationDays - 1) // Subtract 1 because duration is inclusive
      
      dates.push({
        startDate: getLocalDateString(currentStart),
        endDate: getLocalDateString(currentEnd)
      })
      
      // Move to next occurrence
      switch (repeatType) {
        case 'daily':
          currentStart.setDate(currentStart.getDate() + 1)
          break
        case 'weekly':
          currentStart.setDate(currentStart.getDate() + 7)
          break
        case 'monthly':
          currentStart.setMonth(currentStart.getMonth() + 1)
          break
        case 'yearly':
          currentStart.setFullYear(currentStart.getFullYear() + 1)
          break
      }
    }
    
    return dates
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
        zIndex: 50
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 12,
          padding: 24,
          maxWidth: '450px',
          width: '90vw',
          boxShadow: '0 10px 25px var(--shadow-lg)',
          color: 'var(--text-primary)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)' }}>{isEdit ? 'Edit Booking' : 'Create Booking'}</h3>
        
        {/* Tabs */}
        {!isEdit && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
            <button
              onClick={() => setActiveTab('booking')}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderBottom: activeTab === 'booking' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                background: 'transparent',
                color: activeTab === 'booking' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: activeTab === 'booking' ? 600 : 500,
                transition: 'all 0.2s'
              }}
            >
              Booking
            </button>
            <button
              onClick={() => setActiveTab('timeoff')}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderBottom: activeTab === 'timeoff' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                background: 'transparent',
                color: activeTab === 'timeoff' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: activeTab === 'timeoff' ? 600 : 500,
                transition: 'all 0.2s'
              }}
            >
              Time Off
            </button>
          </div>
        )}
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {activeTab === 'booking' ? (
            /* Booking Tab Content */
            <>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Booking title"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: 14,
                background: 'var(--input-bg)',
                color: 'var(--input-text)'
              }}
            />
          </div>
          
          <div ref={projectDropdownRef}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              Project
            </label>
            <div
              role="combobox"
              aria-expanded={projectDropdownOpen}
              aria-haspopup="listbox"
              aria-controls="project-listbox"
              id="project-combobox"
              onClick={() => setProjectDropdownOpen(prev => !prev)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: 14,
                background: 'var(--input-bg)',
                color: 'var(--input-text)',
                cursor: 'pointer',
                minHeight: 38,
                display: 'flex',
                alignItems: 'center'
              }}
            >
              {selectedProject ? (
                <span>
                  <span style={{ fontWeight: 500 }}>{selectedProject.name}</span>
                  {getClientName(selectedProject) !== 'No company' && (
                    <span style={{ color: 'var(--text-secondary)', fontSize: 12, marginLeft: 6 }}>
                      — {getClientName(selectedProject)}
                    </span>
                  )}
                </span>
              ) : (
                <span style={{ color: 'var(--text-secondary)' }}>Select project...</span>
              )}
            </div>
            {projectDropdownOpen && (
              <div
                id="project-listbox"
                role="listbox"
                aria-labelledby="project-combobox"
                style={{
                  marginTop: 4,
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--surface)',
                  boxShadow: '0 4px 12px var(--shadow-lg)',
                  maxHeight: 280,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <input
                  type="text"
                  placeholder="Search project or company..."
                  value={projectSearch}
                  onChange={e => setProjectSearch(e.target.value)}
                  onKeyDown={e => e.stopPropagation()}
                  autoFocus
                  style={{
                    margin: 8,
                    padding: '8px 10px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 13,
                    background: 'var(--input-bg)',
                    color: 'var(--input-text)'
                  }}
                />
                <div style={{ overflow: 'auto', flex: 1, paddingBottom: 8 }}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={!projectId}
                    onClick={() => {
                      setProjectId('')
                      setProjectDropdownOpen(false)
                      setProjectSearch('')
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: 'none',
                      background: projectId === '' ? 'var(--accent-primary-light)' : 'transparent',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
                    No project
                  </button>
                  {projectsByCompany.map(([company, projs]) => (
                    <div key={company}>
                      <div
                        style={{
                          padding: '6px 12px',
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: 'var(--text-secondary)',
                          background: 'var(--border)',
                          position: 'sticky',
                          top: 0,
                          zIndex: 1
                        }}
                      >
                        {company}
                      </div>
                      {projs.map((p: any) => (
                        <button
                          key={p.id}
                          type="button"
                          role="option"
                          aria-selected={projectId === p.id}
                          onClick={() => {
                            setProjectId(p.id)
                            if (p.color) setColor(p.color)
                            setProjectDropdownOpen(false)
                            setProjectSearch('')
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px 8px 20px',
                            border: 'none',
                            background: projectId === p.id ? 'var(--accent-primary-light)' : 'transparent',
                            color: 'var(--text-primary)',
                            fontSize: 13,
                            textAlign: 'left',
                            cursor: 'pointer'
                          }}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  ))}
                  {filteredProjects.length === 0 && (
                    <div style={{ padding: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
                      No projects match &quot;{projectSearch}&quot;
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                From Date *
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
                  fontSize: 14
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                To Date *
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
                  fontSize: 14
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              Hours per day
            </label>
            <input
              type="number"
              step="0.25"
              min="0"
              value={hours}
              onChange={e => setHours(e.target.value)}
              placeholder="Hours per day for this booking"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: 14,
                background: 'var(--input-bg)',
                color: 'var(--input-text)'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              Priority
            </label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: 14,
                background: 'var(--input-bg)',
                color: 'var(--input-text)'
              }}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              Project Manager
            </label>
            <div
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: 14,
                background: 'var(--input-bg)',
                color: 'var(--input-text)',
                minHeight: 38
              }}
            >
              {(selectedProject?.project_manager && String(selectedProject.project_manager).trim()) ||
              (selectedProject?.account_manager && String(selectedProject.account_manager).trim())
                ? (String(selectedProject?.project_manager || '').trim() || String(selectedProject?.account_manager || '').trim())
                : projectManagerId
                  ? (users || []).find((u: any) => u.id === projectManagerId)?.name ?? '—'
                  : '—'}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              id="tentative"
              checked={tentative}
              onChange={e => setTentative(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
                <label htmlFor="tentative" style={{ fontSize: 13, fontWeight: 500, cursor: 'pointer', color: 'var(--text-primary)' }}>
              Tentative
            </label>
          </div>

          {!isEdit && data && (
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              Days: {data.endDay - data.startDay + 1} day{data.endDay - data.startDay > 0 ? 's' : ''}
            </label>
          </div>
          )}
            </>
          ) : (
            /* Time Off Tab Content */
            <>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                  Type *
                </label>
                <select
                  value={timeOffType}
                  onChange={e => setTimeOffType(e.target.value as 'holiday' | 'sick' | 'public' | 'nonwork')}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 14
                  }}
                >
                  <option value="holiday">Holiday</option>
                  <option value="sick">Sick Day</option>
                  <option value="public">Public Holiday</option>
                  <option value="nonwork">Non Work Day</option>
                </select>
        </div>
        
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    From Date *
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
                      fontSize: 14
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    To Date *
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
                      fontSize: 14
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="repeatEnabled"
                  checked={repeatEnabled}
                  onChange={e => setRepeatEnabled(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="repeatEnabled" style={{ fontSize: 13, fontWeight: 500, cursor: 'pointer', color: 'var(--text-primary)' }}>
                  Repeat
                </label>
              </div>

              {repeatEnabled && (
                <>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                      Repeat Frequency
                    </label>
                    <select
                      value={repeatType}
                      onChange={e => setRepeatType(e.target.value as 'daily' | 'weekly' | 'monthly' | 'yearly')}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        fontSize: 14
                      }}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                      Repeat Until (optional)
                    </label>
                    <input
                      type="date"
                      value={repeatEndDate}
                      onChange={e => setRepeatEndDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        fontSize: 14
                      }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                      Leave empty to repeat for 1 year
                    </div>
                  </div>
                </>
              )}

              {!isEdit && data && (
                <div>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    Days: {data.endDay - data.startDay + 1} day{data.endDay - data.startDay > 0 ? 's' : ''}
                  </label>
                </div>
              )}
            </>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
          <div>
            {isEdit && onDelete && (
              <button
                onClick={() => {
                  setShowDeleteConfirm(true)
                }}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: 6,
                  background: 'var(--error)',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500
                }}
              >
                Delete
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500
            }}
          >
            Cancel
          </button>
          <button
              onClick={async () => {
                if (activeTab === 'timeoff') {
                  // Handle time off booking
                  const timeOffTitle = getTimeOffTitle()
                  const baseBookingData = {
                    title: timeOffTitle,
                    projectId: null,
                    startDate: startDate || (data ? getLocalDateString(getDateForDay(monthStart, data.startDay)) : ''),
                    endDate: endDate || (data ? getLocalDateString(getDateForDay(monthStart, data.endDay)) : ''),
                    startTime: null,
                    endTime: null,
                    hours: null,
                    color: 'var(--timeoff-bg)', // Grey for all time off types
                    priority: 'low',
                    projectManagerId: null,
                    description: `Time Off - ${timeOffType}`
                  }

                  if (isEdit) {
                    await onSave(baseBookingData)
                  } else if (repeatEnabled) {
                    // Create multiple bookings for repeat
                    const repeatDates = calculateRepeatDates()
                    if (repeatDates.length === 0) {
                      toast.error('No repeat dates calculated. Please check your dates and repeat settings.')
                      return
                    }
                    
                    // Generate a unique repeat_group_id for this repeat series (32-char hex UUID)
                    const repeatGroupId = crypto.randomUUID().replace(/-/g, '')
                    
                    // Create all repeat bookings in parallel for better performance
                    try {
                      const bookingPromises = repeatDates.map(dateRange =>
                        onSave({
                          resourceId: data.resourceId,
                          ...baseBookingData,
                          startDate: dateRange.startDate,
                          endDate: dateRange.endDate,
                          repeatGroupId: repeatGroupId
                        })
                      )
                      
                      await Promise.all(bookingPromises)
                      toast.success(`Successfully created ${repeatDates.length} repeat booking(s)`)
                      onCancel() // Close dialog after creating all repeats
                    } catch (error) {
                      console.error('Error creating repeat bookings:', error)
                      toast.error('Some repeat bookings failed to create. Please check the console for details.')
                    }
                  } else {
                    await onSave({
                      ...data,
                      ...baseBookingData
                    })
                  }
                } else {
                  // Handle regular booking: use company name as title when title is empty
                  const effectiveTitle = title.trim() || (selectedProject && getClientName(selectedProject) !== 'No company' ? getClientName(selectedProject) : 'New Booking')
                  if (isEdit) {
                    await onSave({
                      title: effectiveTitle,
                      projectId: projectId || null,
                      startDate,
                      endDate,
                      startTime: null,
                      endTime: null,
                      hours: hours ? parseFloat(hours) : null,
                      color: color || null,
                      priority: priority ? priority : 'normal',
                      projectManagerId: projectManagerId || null,
                      tentative: tentative || false
                    })
                  } else {
                    await onSave({
                      ...data,
                      title: effectiveTitle,
                      projectId: projectId || null,
                      startDate: startDate || getLocalDateString(getDateForDay(monthStart, data.startDay)),
                      endDate: endDate || getLocalDateString(getDateForDay(monthStart, data.endDay)),
                      startTime: null,
                      endTime: null,
                      hours: hours ? parseFloat(hours) : null,
                      color: color || null,
                      priority: priority ? priority : 'normal',
                      projectManagerId: projectManagerId || null,
                      tentative: tentative || false
                    })
                  }
                }
              }}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 6,
              background: 'var(--accent-primary)',
              color: 'white',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500
            }}
          >
              {isEdit ? 'Save' : 'Create'}
          </button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Booking"
        message="Are you sure you want to delete this booking? This action cannot be undone."
        confirmText="Delete"
        type="danger"
        onConfirm={() => {
          setShowDeleteConfirm(false)
          onDelete?.()
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}

