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

function ViewContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const timesheetId = searchParams.get('id')
  const from = searchParams.get('from')

  const { data: timesheet, loading, error } = useApiData<any>(
    timesheetId ? `/api/timesheets/${timesheetId}` : null,
    { transform: (raw: any) => raw?.timesheet ?? null }
  )

  const { data: globalSettings } = useApiData<any>('/api/global-settings')
  const overtimeEnabled = globalSettings?.settings?.overtime_enabled !== false

  const getReturnPath = () => {
    if (from === 'history') return '/history'
    if (from === 'admin') return '/admin'
    return '/admin'
  }

  if (loading) {
    return (
      <div>
        <Header />
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <LoadingSpinner size={32} />
          <span>Loading timesheet...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
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
      <div>
        <Header />
        <div style={{ padding: 16, textAlign: 'center' }}>
          <div>Timesheet not found</div>
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

  const weekKey = weekStartKey(timesheet)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header />
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Timesheet View</h2>
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
              <strong>User:</strong> {timesheet.userName || timesheet.user_name}
            </div>
            <div>
              <strong>Email:</strong> {timesheet.userEmail || timesheet.user_email}
            </div>
            <div>
              <strong>Week Starting:</strong> {new Date(timesheet.weekStartDate || timesheet.week_start_date).toLocaleDateString('en-GB')}
            </div>
            <div>
              <strong>Submitted:</strong> {new Date(timesheet.submissionDate || timesheet.submission_date).toLocaleString()}
            </div>
            <div>
              <strong>Total Hours:</strong> {(() => {
                const total = timesheet.summary?.totalHours || timesheet.summary?.total || 0;
                const totalNum = typeof total === 'number' ? total : parseFloat(total) || 0;
                return totalNum.toFixed(2);
              })()}
            </div>
            <div>
              <strong>Jobs:</strong> {Object.keys(timesheet.summary?.jobs || {}).length}
            </div>
          </div>
        </div>

        {/* Job Summary */}
        {timesheet.summary?.jobs && Object.keys(timesheet.summary.jobs).length > 0 && (
          <div style={{ 
            border: '1px solid var(--border)', 
            borderRadius: 12, 
            padding: 16, 
            marginBottom: 16 
          }}>
            <h3 style={{ margin: '0 0 12px 0' }}>Job Summary</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {Object.entries(timesheet.summary.jobs).map(([jobNumber, hours]: [string, unknown]) => {
                const hoursNum = jobSummaryHours(hours)
                return (
                  <div key={jobNumber} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    padding: '8px 12px', 
                    background: 'var(--bg-secondary)', 
                    borderRadius: 6 
                  }}>
                    <span><strong>{jobNumber}</strong></span>
                    <span>{hoursNum.toFixed(2)} hours</span>
                  </div>
                );
              })}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 12px',
                marginTop: 4,
                borderTop: '2px solid var(--border)',
                fontWeight: 700,
              }}>
                <span>Total</span>
                <span>
                  {Object.values(timesheet.summary.jobs).reduce((sum: number, h: unknown) => sum + jobSummaryHours(h), 0).toFixed(2)} hours
                </span>
              </div>
            </div>
          </div>
        )}

        <TimesheetReadOnlyTimeline
          days={timesheet.days}
          dayNotes={timesheet.dayNotes ?? timesheet.day_notes}
          weekStartDate={weekKey}
          overtimeEnabled={overtimeEnabled}
        />
      </div>
    </div>
  )
}

export default function ViewPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: '100vh' }}>
        <LoadingSpinner size={32} />
        <span>Loading...</span>
      </div>
    }>
      <ViewContent />
    </Suspense>
  )
}
