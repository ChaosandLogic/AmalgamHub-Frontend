'use client'
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Header from '../components/Header'
import LoadingSpinner from '../components/LoadingSpinner'
import { useApiData } from '../lib/hooks/useApiData'
import { jobSummaryHours } from '../lib/utils/timesheetSummary'
import TimesheetReadOnlyTimeline from '../timesheet/components/TimesheetReadOnlyTimeline'

function weekStartKey(ts: Record<string, unknown>): string {
  const w = ts.weekStartDate ?? ts.week_start_date
  if (!w) return new Date().toISOString().slice(0, 10)
  if (typeof w === 'string') return w.slice(0, 10)
  try {
    return new Date(w as string | number | Date).toISOString().slice(0, 10)
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

function ViewCurrentContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const userId = searchParams.get('userId')
  const from = searchParams.get('from')

  const { data: user, loading: userLoading, error: userError } = useApiData<any>(
    userId ? `/api/users/${userId}` : null,
    { transform: (raw: any) => raw?.user ?? null }
  )
  const { data: timesheet, loading: tsLoading, error: tsError } = useApiData<any>(
    userId ? `/api/timesheets/draft/${userId}` : null,
    { transform: (raw: any) => raw?.timesheet ?? null }
  )

  const { data: globalSettings } = useApiData<any>(userId ? '/api/global-settings' : null)
  const overtimeEnabled = globalSettings?.settings?.overtime_enabled !== false

  const loading = userLoading || tsLoading
  const error = userError || tsError

  const getReturnPath = () => {
    if (from === 'admin') return '/admin'
    return '/admin'
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Header />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16 }}>
          <LoadingSpinner size={32} />
          <span>Loading current timesheet...</span>
        </div>
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

  // Ensure totalHours is a number
  const totalHours = typeof timesheet.summary?.totalHours === 'number' 
    ? timesheet.summary.totalHours 
    : parseFloat(timesheet.summary?.totalHours) || 0

  const totalJobs = Object.keys(timesheet.summary?.jobs || {}).length

  const draftWeekKey = weekStartKey(timesheet)

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
              <strong>Week Starting:</strong> {new Date(timesheet.weekStartDate).toLocaleDateString('en-GB')}
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
                {Object.entries(timesheet.summary.jobs).map(([job, hours]: [string, unknown]) => {
                  const hoursNum = jobSummaryHours(hours)
                  return (
                    <tr key={job}>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>{job}</td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>{hoursNum.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ padding: '10px 12px', borderTop: '2px solid var(--border)', fontWeight: 700 }}>Total</td>
                  <td style={{ padding: '10px 12px', borderTop: '2px solid var(--border)', textAlign: 'right', fontWeight: 700 }}>
                    {Object.values(timesheet.summary.jobs).reduce((sum: number, h: unknown) => sum + jobSummaryHours(h), 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <TimesheetReadOnlyTimeline
          days={timesheet.days ?? []}
          dayNotes={timesheet.dayNotes ?? timesheet.day_notes}
          weekStartDate={draftWeekKey}
          overtimeEnabled={overtimeEnabled}
        />

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
    <Suspense fallback={
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: '100vh' }}>
        <LoadingSpinner size={32} />
        <span>Loading...</span>
      </div>
    }>
      <ViewCurrentContent />
    </Suspense>
  )
}
