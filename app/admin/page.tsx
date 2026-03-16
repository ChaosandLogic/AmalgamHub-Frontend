'use client'
import { useEffect, useState } from 'react'
import Header from '../components/Header'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'
import LoadingSpinner from '../components/LoadingSpinner'
import { startOfWeek, getLocalDateString } from '../lib/utils/dateUtils'
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
        const tsWeekKey = getLocalDateString(new Date(ts.week_start_date || ts.weekStartDate))
        if (tsWeekKey === weekKey) submitted.add(ts.user_id || ts.userId)
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
                const newDate = new Date(e.target.value)
                setSelectedWeek(startOfWeek(newDate))
              }}
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
                <div className="muted">Week starting: {new Date(autosaved.weekStartDate).toLocaleDateString()}</div>
                <div className="muted">Last saved: {new Date(autosaved.submissionDate).toLocaleString()}</div>
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
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>{new Date(ts.weekStartDate || ts.week_start_date).toLocaleDateString()}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>{new Date(ts.submissionDate || ts.submission_date).toLocaleString()}</td>
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


