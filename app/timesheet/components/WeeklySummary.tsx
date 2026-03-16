'use client'

import { DAYS } from '../lib/constants'

interface WeeklySummaryProps {
  summary: {
    byJob: Map<string, { days: number[]; total: number; standardHours?: number; overtimeHours?: number }>
    dayTotals: number[]
    totalHours: number
    standardHours?: number
    overtimeHours?: number
    overtimeEnabled?: boolean
    overtimeByDay?: number[]
    standardByDay?: number[]
  }
}

export default function WeeklySummary({ summary }: WeeklySummaryProps) {
  const days = DAYS
  const overtimeByDay = summary.overtimeByDay ?? Array(7).fill(0)
  const standardByDay = summary.standardByDay ?? summary.dayTotals

  return (
    <section style={{ border: '1px solid var(--border,#ddd)', borderRadius: 8, padding: 12, overflowX: 'auto' }}>
      <h3 style={{ marginTop: 0 }}>Weekly Summary</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th align="left" style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
              Job Number
            </th>
            {days.map((d) => (
              <th key={d} style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
                {d}
              </th>
            ))}
            <th style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {(Array.from(summary.byJob.entries()) as [string, any][]).map(([job, entry]) => (
            <tr key={job}>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>{job}</td>
              {entry.days.map((h: number, idx: number) => (
                <td
                  key={idx}
                  style={{
                    padding: '6px 8px',
                    borderBottom: '1px solid var(--border)',
                    textAlign: 'right',
                  }}
                >
                  {h.toFixed(2)}
                </td>
              ))}
              <td
                style={{
                  padding: '6px 8px',
                  borderBottom: '1px solid var(--border)',
                  textAlign: 'right',
                  fontWeight: 600,
                }}
              >
                {entry.total.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {summary.overtimeEnabled && (
            <>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <td
                  style={{
                    padding: '6px 8px',
                    borderTop: '1px solid var(--border)',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  Standard Hours
                </td>
                {standardByDay.map((h: number, idx: number) => (
                  <td
                    key={idx}
                    style={{
                      padding: '6px 8px',
                      borderTop: '1px solid var(--border)',
                      textAlign: 'right',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {h.toFixed(2)}
                  </td>
                ))}
                <td
                  style={{
                    padding: '6px 8px',
                    borderTop: '1px solid var(--border)',
                    textAlign: 'right',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                  }}
                >
                  {(summary.standardHours ?? 0).toFixed(2)}
                </td>
              </tr>
              <tr style={{ background: 'var(--warning-light)' }}>
                <td
                  style={{
                    padding: '6px 8px',
                    fontWeight: 600,
                    color: 'var(--warning-dark)',
                  }}
                >
                  Overtime Hours
                </td>
                {overtimeByDay.map((h: number, idx: number) => (
                  <td
                    key={idx}
                    style={{
                      padding: '6px 8px',
                      textAlign: 'right',
                      fontWeight: 600,
                      color: 'var(--warning-dark)',
                    }}
                  >
                    {h.toFixed(2)}
                  </td>
                ))}
                <td
                  style={{
                    padding: '6px 8px',
                    textAlign: 'right',
                    fontWeight: 700,
                    color: 'var(--warning-dark)',
                  }}
                >
                  {(summary.overtimeHours ?? 0).toFixed(2)}
                </td>
              </tr>
            </>
          )}
          <tr style={{ background: 'var(--bg-tertiary)' }}>
            <td
              style={{
                padding: '6px 8px',
                borderTop: '2px solid var(--border-strong)',
                fontWeight: 700,
              }}
            >
              Total Hours
            </td>
            {summary.dayTotals.map((h: number, idx: number) => (
              <td
                key={idx}
                style={{
                  padding: '6px 8px',
                  borderTop: '2px solid var(--border-strong)',
                  textAlign: 'right',
                  fontWeight: 700,
                }}
              >
                {h.toFixed(2)}
              </td>
            ))}
            <td
              style={{
                padding: '6px 8px',
                borderTop: '2px solid var(--border-strong)',
                textAlign: 'right',
                fontWeight: 700,
                fontSize: '15px',
              }}
            >
              {summary.totalHours.toFixed(2)}
            </td>
          </tr>
        </tfoot>
      </table>
    </section>
  )
}
