'use client'
import Header from '../components/Header'
import LoadingSpinner from '../components/LoadingSpinner'
import { useToast } from '../components/Toast'
import { apiDownload } from '../lib/api/client'
import { useApiData } from '../lib/hooks/useApiData'

export default function HistoryPage() {
  const toast = useToast()
  const { data: rows, loading, error } = useApiData<any[]>('/api/timesheets', {
    transform: (raw: any) => Array.isArray(raw?.timesheets) ? raw.timesheets : [],
  })

  async function onExport(id: string) {
    try {
      await apiDownload(
        '/api/timesheets/export-csv',
        `timesheet-${id}.csv`,
        { method: 'POST', body: JSON.stringify({ id }) }
      )
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)))
    }
  }

  function fmtDate(d: any) { try { return new Date(d).toLocaleDateString('en-GB') } catch { return 'N/A' } }
  function fmtDateTime(d: any) { try { return new Date(d).toLocaleString() } catch { return 'N/A' } }
  function total(ts: any) {
    if (typeof ts?.totalHours === 'number') return ts.totalHours
    if (typeof ts?.summary?.totalHours === 'number') return ts.summary.totalHours
    if (typeof ts?.summary?.total === 'number') return ts.summary.total
    if (ts?.data) { try { const p = typeof ts.data === 'string' ? JSON.parse(ts.data) : ts.data; if (p?.summary?.totalHours) return p.summary.totalHours; if (p?.summary?.total) return p.summary.total } catch {} }
    return 0
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header />
      <div style={{ padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>History</h2>
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
                  <th align="left" style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>Week Start</th>
                  <th align="left" style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>Submitted</th>
                  <th align="right" style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>Total Hours</th>
                  <th align="right" style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(rows ?? []).length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 16, textAlign: 'center', color: 'var(--text-secondary)' }}>No timesheets found</td></tr>
                )}
                {(rows ?? []).map(ts => (
                  <tr key={ts.id}>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>{fmtDate(ts.week_start_date || ts.weekStartDate)}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>{fmtDateTime(ts.submission_date || ts.submissionDate)}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>{total(ts).toFixed(2)}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button
                        type="button"
                        className="btn-lift"
                        onClick={() => window.open(`/view?id=${ts.id}&from=history`, '_blank')}
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
                        View
                      </button>
                      <button
                        type="button"
                        className="btn-lift"
                        onClick={() => onExport(ts.id)}
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
                        Export
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}


