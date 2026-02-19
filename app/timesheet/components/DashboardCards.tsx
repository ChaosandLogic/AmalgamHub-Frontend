'use client'

import { formatTimeFromString } from '../timesheetUtils'

interface DashboardCardsProps {
  summary: {
    totalHours: number
    standardHours?: number
    overtimeHours?: number
    overtimeEnabled?: boolean
    byJob?: Map<string, unknown>
  }
  todaysBookings: any[]
  projects: any[]
  recentJobs: Array<{ jobNumber: string; title: string }>
}

export default function DashboardCards({
  summary,
  todaysBookings,
  projects,
  recentJobs,
}: DashboardCardsProps) {
  const cardStyle: React.CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 16,
    background: 'var(--surface)',
    display: 'grid',
    gap: 4,
  }
  const valueStyle: React.CSSProperties = { fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }
  const labelStyle: React.CSSProperties = { fontSize: 13, color: 'var(--text-secondary)' }

  const todaysJobs =
    todaysBookings && todaysBookings.length > 0
      ? todaysBookings.map((booking: any) => {
          const project = projects.find((p: any) => p.id === booking.project_id)
          return {
            title: booking.title || 'No title',
            projectCode: project?.code || booking.project_id || '',
            projectName: project?.name || '',
            startTime: booking.start_time || null,
            endTime: booking.end_time || null,
            hours: booking.hours || null,
            bookerName: booking.booker_name || '',
            booking,
          }
        })
      : []

  const summaryCardCount =
    (todaysJobs.length === 1 ? 1 : 0) +
    1 +
    (summary?.overtimeEnabled ? 2 : 0)
  const summaryGridCols = `repeat(${Math.max(summaryCardCount, 1)}, minmax(0, 1fr))`
  const gridColumnFull = '1 / -1'

  return (
    <>
      {todaysJobs.length > 1 && (
        <div style={{ width: '100%', marginBottom: 12 }}>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              marginBottom: 12,
              fontWeight: 500,
            }}
          >
            Today&apos;s Jobs ({todaysJobs.length})
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 12,
            }}
          >
            {todaysJobs.map((jobInfo: any, index: number) => (
              <div
                key={index}
                style={{
                  border: '1px solid var(--accent-primary)',
                  borderRadius: 12,
                  padding: 14,
                  background: 'var(--accent-primary-light)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  position: 'relative',
                  height: '100%',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'
                  e.currentTarget.style.borderColor = 'var(--accent-primary-hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)'
                  e.currentTarget.style.borderColor = 'var(--accent-primary)'
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 12,
                    fontSize: 11,
                    fontWeight: 700,
                    background: 'var(--accent-primary)',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: 12,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {index + 1}
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: 'var(--accent-primary-dark)',
                    marginBottom: 8,
                    lineHeight: 1.2,
                    paddingRight: '40px',
                  }}
                >
                  {jobInfo.projectCode
                    ? `${jobInfo.projectCode} - ${jobInfo.projectName}`
                    : jobInfo.title}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {jobInfo.startTime && jobInfo.endTime && (
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span>🕐</span>
                      <span>
                        {formatTimeFromString(jobInfo.startTime)} -{' '}
                        {formatTimeFromString(jobInfo.endTime)}
                      </span>
                    </div>
                  )}
                  {jobInfo.hours && (
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--text-secondary)',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span>⏱</span>
                      <span>{jobInfo.hours} hrs per day</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: summaryGridCols, gap: 12 }}>
        {todaysJobs.length === 1 && (
          <div
            style={{
              ...cardStyle,
              border: '1px solid var(--accent-primary)',
              background: 'var(--accent-primary-light)',
            }}
          >
            <div style={{ ...labelStyle, color: 'var(--accent-primary-dark)' }}>
              Today&apos;s Job
            </div>
            <div
              style={{
                ...valueStyle,
                fontSize: 20,
                color: 'var(--accent-primary-dark)',
              }}
            >
              {todaysJobs[0].projectCode
                ? `${todaysJobs[0].projectCode} - ${todaysJobs[0].projectName}`
                : todaysJobs[0].title}
            </div>
            {todaysJobs[0].startTime && todaysJobs[0].endTime && (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                {formatTimeFromString(todaysJobs[0].startTime)} -{' '}
                {formatTimeFromString(todaysJobs[0].endTime)}
              </div>
            )}
            {todaysJobs[0].hours && (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {todaysJobs[0].hours} hrs per day
              </div>
            )}
            {todaysJobs[0].bookerName && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Booked by <strong>{todaysJobs[0].bookerName}</strong>
              </div>
            )}
          </div>
        )}
        <div style={cardStyle}>
          <div style={labelStyle}>Total Hours (This Week)</div>
          <div style={valueStyle}>{summary.totalHours.toFixed(2)}</div>
        </div>
        {summary?.overtimeEnabled && (
          <>
            <div style={cardStyle}>
              <div style={labelStyle}>Standard Hours</div>
              <div style={{ ...valueStyle, fontSize: 24 }}>
                {(summary.standardHours ?? 0).toFixed(2)}
              </div>
            </div>
            <div
              style={{
                ...cardStyle,
                border: '1px solid var(--warning)',
                background: 'var(--warning-light)',
              }}
            >
              <div style={{ ...labelStyle, color: 'var(--warning-dark)' }}>Overtime Hours</div>
              <div style={{ ...valueStyle, fontSize: 24, color: 'var(--warning-dark)' }}>
                {(summary.overtimeHours ?? 0).toFixed(2)}
              </div>
            </div>
          </>
        )}
        <div style={{ ...cardStyle, gridColumn: gridColumnFull, minWidth: 0 }}>
          <div style={labelStyle}>Most Recent Job Numbers</div>
          {recentJobs.length === 0 ? (
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              No jobs used yet this week
            </div>
          ) : (
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {recentJobs.map((job, i) => (
                <li
                  key={`${job.jobNumber}-${i}`}
                  style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.4 }}
                >
                  <strong>{job.jobNumber}</strong>
                  {job.title !== job.jobNumber && (
                    <span style={{ color: 'var(--text-secondary)' }}> — {job.title}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}
