'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Header from '../components/Header'

function ViewCurrentContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const userId = searchParams.get('userId')
  const from = searchParams.get('from') // Get the referring page

  const [timesheet, setTimesheet] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Determine where to navigate back to
  const getReturnPath = () => {
    if (from === 'admin') return '/admin'
    // Default fallback
    return '/admin'
  }

  useEffect(() => {
    if (!userId) {
      setError('No user ID provided')
      setLoading(false)
      return
    }

    const loadData = async () => {
      try {
        // Load user info
        const userRes = await fetch(`/api/user/${userId}`, { credentials: 'include' })
        if (!userRes.ok) throw new Error('Failed to load user')
        const userResponse = await userRes.json()
        const user = userResponse.data?.user || userResponse.user
        setUser(user)

        // Load autosaved timesheet
        const timesheetRes = await fetch(`/api/autosaved/${userId}`, { credentials: 'include' })
        if (timesheetRes.status === 404) {
          setError('No current timesheet found for this user')
        } else if (!timesheetRes.ok) {
          throw new Error('Failed to load timesheet')
        } else {
          const timesheetResponse = await timesheetRes.json()
          const timesheet = timesheetResponse.data?.timesheet || timesheetResponse.timesheet
          setTimesheet(timesheet)
        }
      } catch (e: any) {
        setError(e.message || 'An unexpected error occurred')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [userId])

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Header />
        <div style={{ padding: 16, textAlign: 'center' }}>Loading current timesheet...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Header />
        <div style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ color: 'var(--error)', marginBottom: 16 }}>{error}</div>
          <button 
            onClick={() => router.push(getReturnPath())}
            style={{
              background: 'var(--primary)',
              color: 'white',
              border: '1px solid var(--primary)',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  if (!timesheet) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Header />
        <div style={{ padding: 16, textAlign: 'center' }}>
          <div>No current timesheet found</div>
          <button 
            onClick={() => router.push(getReturnPath())}
            style={{
              background: 'var(--primary)',
              color: 'white',
              border: '1px solid var(--primary)',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const totalJobs = Object.keys(timesheet.summary?.jobs || {}).length
  // Ensure totalHours is a number
  const totalHours = typeof timesheet.summary?.totalHours === 'number' 
    ? timesheet.summary.totalHours 
    : parseFloat(timesheet.summary?.totalHours) || 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header />
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Current Timesheet (Autosaved)</h2>
          <button 
            onClick={() => router.push(getReturnPath())}
            style={{
              background: 'transparent',
              color: 'var(--primary)',
              border: '1px solid var(--primary)',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
        
        {/* Timesheet Header */}
        <div style={{ 
          border: '1px solid var(--border)', 
          borderRadius: 12, 
          padding: 16, 
          marginBottom: 16,
          background: 'var(--surface)'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div>
              <strong>User:</strong> {user?.name || 'Unknown'}
            </div>
            <div>
              <strong>Email:</strong> {user?.email || 'Unknown'}
            </div>
            <div>
              <strong>Week Starting:</strong> {new Date(timesheet.weekStartDate).toLocaleDateString()}
            </div>
            <div>
              <strong>Last Saved:</strong> {new Date(timesheet.submissionDate).toLocaleString()}
            </div>
            <div>
              <strong>Total Hours:</strong> {totalHours.toFixed(2)}
            </div>
            <div>
              <strong>Jobs:</strong> {totalJobs}
            </div>
          </div>
        </div>

        {/* Job Summary */}
        {timesheet.summary?.jobs && Object.keys(timesheet.summary.jobs).length > 0 && (
          <div style={{ 
            border: '1px solid var(--border)', 
            borderRadius: 12, 
            padding: 16, 
            marginBottom: 16,
            background: 'var(--surface)'
          }}>
            <h3 style={{ margin: 0, marginBottom: 12 }}>Job Summary</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th align="left" style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>Job Number</th>
                  <th align="right" style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>Hours</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(timesheet.summary.jobs).map(([job, hours]: [string, any]) => {
                  // Ensure hours is a number before calling toFixed
                  const hoursNum = typeof hours === 'number' ? hours : parseFloat(hours) || 0;
                  return (
                    <tr key={job}>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>{job}</td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>{hoursNum.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Daily Breakdown */}
        {timesheet.days && timesheet.days.length > 0 && (
          <div style={{ 
            border: '1px solid var(--border)', 
            borderRadius: 12, 
            padding: 16,
            background: 'var(--surface)'
          }}>
            <h3 style={{ margin: 0, marginBottom: 12 }}>Daily Breakdown</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              {timesheet.days.map((dayData: any[], dayIndex: number) => (
                <div key={dayIndex} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, background: 'var(--bg-secondary)' }}>
                  <h4 style={{ margin: 0, marginBottom: 8, color: 'var(--primary)' }}>{days[dayIndex]}</h4>
                  {dayData.length === 0 && <div style={{ color: 'var(--muted)' }}>No entries for this day.</div>}
                  {dayData.length > 0 && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr>
                          <th align="left" style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>Job Number</th>
                          <th align="right" style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>Hours</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayData.map((job: any, jobIdx: number) => {
                          // Ensure totalHours is a number before calling toFixed
                          const jobHours = typeof job.totalHours === 'number' 
                            ? job.totalHours 
                            : parseFloat(job.totalHours) || 0;
                          return (
                            <tr key={jobIdx}>
                              <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>{job.jobPrefix}{job.jobNumber}</td>
                              <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>{jobHours.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                  {(timesheet.dayNotes && timesheet.dayNotes[dayIndex]?.trim()) ? (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>Notes:</strong> {timesheet.dayNotes[dayIndex].trim()}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Note about autosaved data */}
        <div style={{ 
          marginTop: 16, 
          padding: 12, 
          background: 'var(--warning-light)', 
          border: '1px solid var(--warning)', 
          borderRadius: 8,
          fontSize: '14px',
          color: 'var(--warning-dark)'
        }}>
          <strong>Note:</strong> This is the user's current work-in-progress timesheet that is automatically saved as they work. It has not been formally submitted yet.
        </div>
      </div>
    </div>
  )
}

export default function ViewCurrentPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ViewCurrentContent />
    </Suspense>
  )
}
