'use client'
import { useEffect, useState } from 'react'
import Header from '../components/Header'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'
import LoadingSpinner from '../components/LoadingSpinner'
import { startOfWeek, getLocalDateString, parseLocalDateString } from '../lib/utils/dateUtils'
import { apiGet, apiPost, apiDelete, apiPatch, apiDownload } from '../lib/api/client'
import type { CurrentUser } from '../lib/types/user'
import type { Timesheet } from '../lib/types/timesheet'

export default function AdminPage() {
  const toast = useToast()
  const [users, setUsers] = useState<CurrentUser[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [viewUser, setViewUser] = useState<CurrentUser | null>(null)
  const [selectedWeek, setSelectedWeek] = useState(() => startOfWeek(new Date()))
  const [submittedUsers, setSubmittedUsers] = useState<Set<string>>(new Set())
  const [testingNotifications, setTestingNotifications] = useState(false)
  const [notificationResult, setNotificationResult] = useState<string | null>(null)
  const [showDeleteUserConfirm, setShowDeleteUserConfirm] = useState<CurrentUser | null>(null)
  const [showClearWeekConfirm, setShowClearWeekConfirm] = useState(false)
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false)
  const [clearAllInput, setClearAllInput] = useState('')
  const [isClearing, setIsClearing] = useState(false)

  async function loadUsers() {
    setLoading(true)
    try {
      const data = await apiGet<{ users: CurrentUser[] }>('/api/users', { defaultErrorMessage: 'Failed to load users' })
      setUsers(data.users || [])
    } catch (e: unknown) { setError((e instanceof Error ? e.message : String(e))) } finally { setLoading(false) }
  }

  async function loadSubmissionStatus() {
    try {
      const weekKey = getLocalDateString(selectedWeek)
      const data = await apiGet<{ timesheets: Timesheet[] }>('/api/timesheets/all')
      const submitted = new Set<string>()
      ;(data.timesheets || []).forEach((ts) => {
        const weekStart = ts.week_start_date || ts.weekStartDate
        const userId = ts.user_id || ts.userId
        if (!weekStart || !userId) return
        const tsWeekKey = getLocalDateString(new Date(weekStart))
        if (tsWeekKey === weekKey) submitted.add(userId)
      })
      setSubmittedUsers(submitted)
    } catch (e) {
      console.error('Failed to load submission status:', e)
    }
  }

  useEffect(() => { loadUsers() }, [])
  useEffect(() => { loadSubmissionStatus() }, [selectedWeek])

  async function downloadWeeklyTimesheets() {
    try {
      const weekKey = getLocalDateString(selectedWeek)
      await apiDownload(
        `/api/timesheets/export-week?week=${encodeURIComponent(weekKey)}`,
        `timesheets_week_${weekKey}.xlsx`
      )
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || 'Failed to download timesheets')
    }
  }

  async function updateRole(userId: string, role: string) {
    try {
      await apiPatch(`/api/users/${userId}/role`, { role })
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, role } : u)))
    } catch {}
  }

  async function deleteUser(user: CurrentUser) {
    setShowDeleteUserConfirm(user)
  }

  const confirmDeleteUser = async (user: CurrentUser) => {
    try {
      await apiDelete(`/api/users/${user.id}`, { defaultErrorMessage: 'Failed to delete' })
      setUsers(prev => prev.filter(u => u.id !== user.id))
      toast.success('User deleted successfully')
    } catch (e: unknown) { 
      toast.error((e instanceof Error ? e.message : String(e))) 
    }
    setShowDeleteUserConfirm(null)
  }

  async function testDailyNotifications() {
    setTestingNotifications(true)
    setNotificationResult(null)
    try {
      const data = await apiPost<{ message?: string }>('/api/admin/test-daily-notifications')
      setNotificationResult(`✅ Success! ${data.message || 'Notifications sent successfully.'}`)
    } catch (e: unknown) {
      setNotificationResult(`❌ Error: ${(e instanceof Error ? e.message : String(e))}`)
    } finally {
      setTestingNotifications(false)
      // Clear result after 5 seconds
      setTimeout(() => setNotificationResult(null), 5000)
    }
  }

  async function confirmClearWeek() {
    setIsClearing(true)
    try {
      const weekKey = getLocalDateString(selectedWeek)
      const data = await apiDelete<{ deleted: number }>(`/api/timesheets/admin/clear?weekDate=${weekKey}`)
      await loadSubmissionStatus()
      toast.success(`Cleared ${data.deleted ?? 0} record(s) for week ${weekKey}`)
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || 'Failed to clear week')
    } finally {
      setIsClearing(false)
      setShowClearWeekConfirm(false)
    }
  }

  async function confirmClearAll() {
    if (clearAllInput.trim().toUpperCase() !== 'DELETE ALL') return
    setIsClearing(true)
    try {
      const data = await apiDelete<{ deleted: number }>('/api/timesheets/admin/clear')
      await loadSubmissionStatus()
      toast.success(`All timesheet records cleared (${(data as any).deleted ?? 0} rows removed)`)
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || 'Failed to clear all timesheets')
    } finally {
      setIsClearing(false)
      setShowClearAllConfirm(false)
      setClearAllInput('')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Header />
      <div style={{ 
        padding: '16px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        flexShrink: 0,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)'
      }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>Users</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: 'var(--muted)', fontWeight: '500' }}>
              Week Commencing:
            </span>
            <input
              type="date"
              value={getLocalDateString(selectedWeek)}
              onChange={(e) => {
                const newDate = parseLocalDateString(e.target.value)
                setSelectedWeek(startOfWeek(newDate))
              }}
              min="2000-01-03"
              step={7}
              style={{
                padding: '6px 10px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '14px',
                background: 'var(--surface)'
              }}
            />
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
              ({submittedUsers.size} of {users.length} submitted)
            </div>
            <button
              onClick={downloadWeeklyTimesheets}
              disabled={submittedUsers.size === 0}
              style={{
                background: submittedUsers.size > 0 ? 'var(--success)' : 'var(--text-tertiary)',
                color: 'white',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: submittedUsers.size > 0 ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                opacity: submittedUsers.size > 0 ? 1 : 0.6
              }}
              title={submittedUsers.size === 0 ? 'No timesheets to download' : 'Download all timesheets for this week as Excel (2 sheets)'}
            >
              <span style={{ fontSize: '16px' }}>📥</span>
              Download Excel
            </button>
            <button
              onClick={testDailyNotifications}
              disabled={testingNotifications}
              style={{
                background: testingNotifications ? 'var(--text-tertiary)' : 'var(--primary)',
                color: 'white',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: testingNotifications ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                opacity: testingNotifications ? 0.6 : 1
              }}
              title="Test daily email notifications (sends to all users with bookings today)"
            >
              <span style={{ fontSize: '16px' }}>📧</span>
              {testingNotifications ? 'Sending...' : 'Test Notifications'}
            </button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16, background: 'var(--bg-secondary)' }}>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 24,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          {notificationResult && (
            <div style={{
              padding: '12px',
              marginBottom: '16px',
              borderRadius: '8px',
              background: notificationResult.includes('✅') ? 'var(--success-light)' : 'var(--error-light)',
              color: notificationResult.includes('✅') ? 'var(--success-dark)' : 'var(--error-dark)',
              border: `1px solid ${notificationResult.includes('✅') ? 'var(--success)' : 'var(--error)'}`,
              fontSize: '14px'
            }}>
              {notificationResult}
            </div>
          )}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
              <LoadingSpinner size={28} />
              <span>Loading…</span>
            </div>
          )}
          {error && <div style={{ color: 'crimson' }}>{error}</div>}
          {!loading && !error && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  <th align="left" style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>Status</th>
                  <th align="left" style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>Name</th>
                  <th align="left" style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>Email</th>
                  <th align="left" style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>Role</th>
                  <th align="left" style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>Created</th>
                  <th align="right" style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const hasSubmitted = submittedUsers.has(u.id)
                  return (
                    <tr key={u.id}>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          background: hasSubmitted ? 'var(--success-light)' : 'var(--error-light)',
                          color: hasSubmitted ? 'var(--success-dark)' : 'var(--error-dark)',
                          border: `1px solid ${hasSubmitted ? 'var(--success)' : 'var(--error-border)'}`
                        }}>
                          {hasSubmitted ? '✓' : '○'} {hasSubmitted ? 'Submitted' : 'Pending'}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>{u.name}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>{u.email}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                      <select value={u.role} onChange={e => updateRole(u.id, (e.target as HTMLSelectElement).value)}>
                        <option value="user">user</option>
                        <option value="booker">booker</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>{u.created_at ? new Date(u.created_at).toLocaleString() : '—'}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button 
                        onClick={() => setViewUser(u)} 
                        style={{ 
                          background: 'var(--primary)', 
                          color: 'white', 
                          border: '1px solid var(--primary)',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontWeight: '500',
                          cursor: 'pointer'
                        }}
                      >
                        Timesheets
                      </button>
                      <button 
                        onClick={() => deleteUser(u)} 
                        style={{ 
                          background: 'var(--danger-200)', 
                          color: 'var(--text-primary)', 
                          border: '1px solid var(--danger-200)',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontWeight: '500',
                          cursor: 'pointer'
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>
      {viewUser && <UserModal user={viewUser} onClose={() => setViewUser(null)} />}
      {/* ── Danger Zone ─────────────────────────────────────────── */}
      <div style={{
        margin: '16px 16px 0',
        border: '1px solid var(--error-border, #fca5a5)',
        borderRadius: 10,
        padding: 16,
        background: 'var(--error-light, #fef2f2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--error-dark, #991b1b)', fontSize: 14 }}>
              Danger Zone — Database Cleanup
            </div>
            <div style={{ fontSize: 12, color: 'var(--error-dark, #991b1b)', opacity: 0.8, marginTop: 2 }}>
              These actions permanently remove timesheet records from SQLite. Use to purge test or spurious data.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => setShowClearWeekConfirm(true)}
              style={{
                background: 'transparent',
                color: 'var(--error-dark, #991b1b)',
                border: '1px solid var(--error-border, #fca5a5)',
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
              title={`Clear all timesheet records for week commencing ${getLocalDateString(selectedWeek)}`}
            >
              Clear selected week
            </button>
            <button
              onClick={() => { setClearAllInput(''); setShowClearAllConfirm(true) }}
              style={{
                background: 'var(--error, #dc2626)',
                color: 'white',
                border: 'none',
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
              title="Permanently delete every timesheet record in the database"
            >
              Clear all timesheets
            </button>
          </div>
        </div>
      </div>

      {/* Clear week confirmation */}
      <ConfirmDialog
        isOpen={showClearWeekConfirm}
        title="Clear week's timesheets"
        message={
          <>
            This will permanently delete <strong>all</strong> timesheet records (all users) for week
            commencing <strong>{new Date(getLocalDateString(selectedWeek)).toLocaleDateString('en-GB')}</strong>.
            <br /><br />
            This cannot be undone.
          </>
        }
        confirmText={isClearing ? 'Clearing…' : 'Clear week'}
        cancelText="Cancel"
        type="danger"
        onConfirm={confirmClearWeek}
        onCancel={() => setShowClearWeekConfirm(false)}
      />

      {/* Clear ALL confirmation — requires typing DELETE ALL */}
      {showClearAllConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 24, width: 'min(440px, 92vw)', display: 'grid', gap: 16
          }}>
            <h3 style={{ margin: 0, color: 'var(--error, #dc2626)' }}>Clear all timesheet records</h3>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
              This will <strong>permanently delete every timesheet record</strong> in the database
              for all users across all time. This cannot be undone.
            </p>
            <p style={{ margin: 0, fontSize: 14 }}>
              Type <strong>DELETE ALL</strong> to confirm:
            </p>
            <input
              autoFocus
              value={clearAllInput}
              onChange={e => setClearAllInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && clearAllInput.trim().toUpperCase() === 'DELETE ALL') confirmClearAll() }}
              placeholder="DELETE ALL"
              style={{
                padding: '8px 12px', borderRadius: 6,
                border: '1px solid var(--border)', fontSize: 14,
                background: 'var(--bg-primary)', color: 'var(--text-primary)'
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowClearAllConfirm(false); setClearAllInput('') }}
                style={{
                  background: 'transparent', color: 'var(--text-primary)',
                  border: '1px solid var(--border)', padding: '8px 16px',
                  borderRadius: 6, fontSize: 13, cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                disabled={clearAllInput.trim().toUpperCase() !== 'DELETE ALL' || isClearing}
                onClick={confirmClearAll}
                style={{
                  background: clearAllInput.trim().toUpperCase() === 'DELETE ALL' ? 'var(--error, #dc2626)' : 'var(--text-tertiary)',
                  color: 'white', border: 'none', padding: '8px 16px',
                  borderRadius: 6, fontSize: 13, fontWeight: 500,
                  cursor: clearAllInput.trim().toUpperCase() === 'DELETE ALL' ? 'pointer' : 'not-allowed',
                  opacity: isClearing ? 0.6 : 1,
                }}
              >
                {isClearing ? 'Clearing…' : 'Clear all timesheets'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!showDeleteUserConfirm}
        title="Delete User"
        message={`Are you sure you want to delete "${showDeleteUserConfirm?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        onConfirm={async () => {
          if (showDeleteUserConfirm) {
            await confirmDeleteUser(showDeleteUserConfirm)
          }
        }}
        onCancel={() => setShowDeleteUserConfirm(null)}
      />
    </div>
  )
}

function UserModal({ user, onClose }: { user: CurrentUser; onClose: () => void }) {
  const toast = useToast()
  const [autosaved, setAutosaved] = useState<Timesheet | null>(null)
  const [submitted, setSubmitted] = useState<Timesheet[]>([])
  const [error, setError] = useState('')
  const [selectedTimesheets, setSelectedTimesheets] = useState<Set<string>>(new Set())
  const [showDeleteTimesheetsConfirm, setShowDeleteTimesheetsConfirm] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const tsData = await apiGet<{ timesheet: Timesheet }>(`/api/timesheets/draft/${user.id}`)
        if (!cancelled) setAutosaved(tsData.timesheet)
      } catch {}
      try {
        const allData = await apiGet<{ timesheets: Timesheet[] }>('/api/timesheets/all')
        const list = allData.timesheets.filter((ts) => ts.user_id === user.id)
        if (!cancelled) setSubmitted(list)
      } catch { if (!cancelled) setError('Failed to load timesheets') }
    })()
    return () => { cancelled = true }
  }, [user.id])

  const toggleTimesheetSelection = (timesheetId: string) => {
    setSelectedTimesheets(prev => {
      const newSet = new Set(prev)
      if (newSet.has(timesheetId)) {
        newSet.delete(timesheetId)
      } else {
        newSet.add(timesheetId)
      }
      return newSet
    })
  }

  const selectAllTimesheets = () => {
    if (selectedTimesheets.size === submitted.length) {
      // Deselect all
      setSelectedTimesheets(new Set())
    } else {
      // Select all
      setSelectedTimesheets(new Set(submitted.map(ts => ts.id)))
    }
  }

  const deleteSelectedTimesheets = async () => {
    if (selectedTimesheets.size === 0) {
      toast.warning('Please select at least one timesheet to delete.')
      return
    }

    setShowDeleteTimesheetsConfirm(true)
  }

  const confirmDeleteTimesheets = async () => {
    const timesheetIds = Array.from(selectedTimesheets)
    try {
      const results = await Promise.allSettled(
        timesheetIds.map(id => apiDelete(`/api/timesheets/${id}`))
      )
      const failedCount = results.filter(r => r.status === 'rejected').length
      if (failedCount === 0) {
        setSubmitted(prev => prev.filter(ts => !selectedTimesheets.has(ts.id)))
        setSelectedTimesheets(new Set())
        toast.success(`Successfully deleted ${timesheetIds.length} timesheet(s).`)
      } else {
        toast.error(`Failed to delete ${failedCount} timesheet(s). Please try again.`)
      }
    } catch (error) {
      console.error('Error deleting timesheets:', error)
      toast.error('Failed to delete timesheets')
    }
    setShowDeleteTimesheetsConfirm(false)
  }


  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-backdrop)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ width: 'min(900px, 96vw)', maxHeight: '90vh', overflow: 'auto', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ margin: 0 }}>User Details: {user.name} ({user.email})</h3>
          <button onClick={onClose} style={{ background: 'transparent', color: 'var(--primary)', borderColor: 'var(--primary)' }}>Close</button>
        </div>
        <div style={{ padding: 12, display: 'grid', gap: 16 }}>
          {error && <div style={{ color: 'crimson' }}>{error}</div>}
          <section style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
            <h4 style={{ margin: 0 }}>Current (Autosaved)</h4>
            {!autosaved && <div className="muted">No autosaved timesheet</div>}
            {autosaved && (
              <div style={{ display: 'grid', gap: 6 }}>
                <div className="muted">
                  Week starting: {autosaved.weekStartDate || autosaved.week_start_date ? new Date(autosaved.weekStartDate || autosaved.week_start_date || '').toLocaleDateString('en-GB') : '—'}
                </div>
                <div className="muted">
                  Last saved: {autosaved.submissionDate || autosaved.submission_date || autosaved.submitted_at ? new Date(autosaved.submissionDate || autosaved.submission_date || autosaved.submitted_at || '').toLocaleString('en-GB') : '—'}
                </div>
                <div className="muted">Jobs: {Object.keys(autosaved.summary?.jobs || {}).length}</div>
                <div style={{ marginTop: 8 }}>
                  <button 
                    onClick={() => window.open(`/view-current?userId=${user.id}&from=admin`, '_blank')}
                    style={{ 
                      background: 'transparent', 
                      color: 'var(--primary)', 
                      border: '1px solid var(--primary)',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    View Current Timesheet
                  </button>
                </div>
              </div>
            )}
          </section>
          <section style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <h4 style={{ margin: 0 }}>Submitted Timesheets</h4>
              {submitted.length > 0 && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    {selectedTimesheets.size} of {submitted.length} selected
                  </span>
                  <button 
                    onClick={deleteSelectedTimesheets}
                    disabled={selectedTimesheets.size === 0}
                    style={{ 
                      background: selectedTimesheets.size === 0 ? 'var(--muted)' : 'var(--danger-200)', 
                      color: selectedTimesheets.size === 0 ? 'var(--text-tertiary)' : 'var(--text-primary)', 
                      border: `1px solid ${selectedTimesheets.size === 0 ? 'var(--muted)' : 'var(--danger-200)'}`,
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: selectedTimesheets.size === 0 ? 'not-allowed' : 'pointer',
                      opacity: selectedTimesheets.size === 0 ? 0.5 : 1
                    }}
                  >
                    Delete Selected
                  </button>
                </div>
              )}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
              <thead>
                <tr>
                  <th align="left" style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', width: '40px' }}>
                    <input 
                      type="checkbox" 
                      checked={submitted.length > 0 && selectedTimesheets.size === submitted.length}
                      onChange={selectAllTimesheets}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th align="left" style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>Week Start</th>
                  <th align="left" style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>Submitted</th>
                  <th align="right" style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>Hours</th>
                  <th align="right" style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {submitted.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 8, textAlign: 'center' }} className="muted">No submitted timesheets</td></tr>
                )}
                {submitted.map((ts: any) => (
                  <tr key={ts.id}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedTimesheets.has(ts.id)}
                        onChange={() => toggleTimesheetSelection(ts.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>{ts.weekStartDate || ts.week_start_date ? new Date(ts.weekStartDate || ts.week_start_date || '').toLocaleDateString('en-GB') : '—'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>{ts.submissionDate || ts.submission_date || ts.submitted_at ? new Date(ts.submissionDate || ts.submission_date || ts.submitted_at || '').toLocaleString('en-GB') : '—'}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>{(ts.summary?.totalHours || ts.summary?.total || 0).toFixed(2)}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                      <button 
                        onClick={() => window.open(`/view?id=${ts.id}&from=admin`, '_blank')}
                        style={{ 
                          background: 'transparent', 
                          color: 'var(--primary)', 
                          border: '1px solid var(--primary)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: 'pointer'
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
      <ConfirmDialog
        isOpen={showDeleteTimesheetsConfirm}
        title="Delete Timesheets"
        message={`Are you sure you want to delete ${selectedTimesheets.size} timesheet(s)? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        onConfirm={async () => {
          await confirmDeleteTimesheets()
        }}
        onCancel={() => setShowDeleteTimesheetsConfirm(false)}
      />
    </div>
  )
}


