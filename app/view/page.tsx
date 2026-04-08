'use client'
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Header from '../components/Header'
import LoadingSpinner from '../components/LoadingSpinner'
import { useApiData } from '../lib/hooks/useApiData'

function ViewContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const timesheetId = searchParams.get('id')
  const from = searchParams.get('from')

  const { data: timesheet, loading, error } = useApiData<any>(
    timesheetId ? `/api/timesheets/${timesheetId}` : null,
    { transform: (raw: any) => raw?.timesheet ?? null }
  )

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

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  
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
              {Object.entries(timesheet.summary.jobs).map(([jobNumber, hours]: [string, any]) => {
                const hoursNum = typeof hours === 'number' ? hours : parseFloat(hours) || 0;
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
            </div>
          </div>
        )}

        {/* Daily Breakdown */}
        <div style={{ 
          border: '1px solid var(--border)', 
          borderRadius: 12, 
          padding: 16 
        }}>
          <h3 style={{ margin: '0 0 16px 0' }}>Daily Breakdown</h3>
          <div style={{ display: 'grid', gap: 16 }}>
            {timesheet.days?.map((dayData: any[], dayIndex: number) => {
              const dayJobs = dayData.filter(job => job.jobNumber && job.totalHours > 0)
              const dayTotal = dayJobs.reduce((sum, job) => {
                const hours = typeof job.totalHours === 'number' ? job.totalHours : parseFloat(job.totalHours) || 0;
                return sum + hours;
              }, 0)
              
              return (
                <div key={dayIndex} style={{ 
                  border: '1px solid var(--border)', 
                  borderRadius: 8, 
                  padding: 12,
                  background: 'var(--bg-secondary)'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    marginBottom: 8 
                  }}>
                    <h4 style={{ margin: 0, fontSize: '16px' }}>{days[dayIndex]}</h4>
                    <span style={{ 
                      fontWeight: 'bold', 
                      color: 'var(--primary)',
                      fontSize: '14px'
                    }}>
                      {dayTotal.toFixed(2)} hours
                    </span>
                  </div>
                  
                  {dayJobs.length > 0 ? (
                    <div style={{ display: 'grid', gap: 6 }}>
                      {dayJobs.map((job, jobIndex) => {
                        const jobHours = typeof job.totalHours === 'number' ? job.totalHours : parseFloat(job.totalHours) || 0;
                        return (
                          <div key={jobIndex} style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            padding: '6px 8px', 
                            background: 'var(--surface)', 
                            borderRadius: 4,
                            fontSize: '14px'
                          }}>
                            <span>{job.jobNumber}</span>
                            <span>{jobHours.toFixed(2)}h</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ 
                      color: 'var(--text-tertiary)', 
                      fontSize: '14px', 
                      fontStyle: 'italic' 
                    }}>
                      No hours logged
                    </div>
                  )}
                  {/* Per-day notes */}
                  {(timesheet.dayNotes && timesheet.dayNotes[dayIndex]?.trim()) ? (
                    <div style={{ 
                      marginTop: 10, 
                      paddingTop: 10, 
                      borderTop: '1px solid var(--border)',
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}>
                      <strong style={{ color: 'var(--text-primary)' }}>Notes:</strong>{' '}
                      {timesheet.dayNotes[dayIndex].trim()}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
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
