'use client'
import { useEffect, useState } from 'react'
import Header from '../components/Header'
import { useToast } from '../components/Toast'

export default function HistoryPage() {
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const r = await fetch('/api/timesheets', { credentials: 'include' })
        if (!r.ok) {
          const errorData = await r.json().catch(() => ({ message: 'Failed to load history' }))
          throw new Error(errorData.message || 'Failed to load history')
        }
        const response = await r.json()
        const data = response.data || response
        if (!cancelled) setRows(Array.isArray(data.timesheets) ? data.timesheets : [])
      } catch (e: any) { if (!cancelled) setError(e.message) } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [])

  async function onExport(id: string) {
    try {
      const res = await fetch('/api/export-csv', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }), credentials: 'include' })
      if (!res.ok) throw new Error('Failed to export timesheet')
      const blob = await res.blob(); const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `timesheet-${id}.csv`; document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); document.body.removeChild(a)
    } catch (e: any) { 
      toast.error(e.message) 
    }
  }

  function fmtDate(d: any) { try { return new Date(d).toLocaleDateString() } catch { return 'N/A' } }
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
        {loading && <div>Loading…</div>}
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
                {rows.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 16, textAlign: 'center', color: 'var(--text-secondary)' }}>No timesheets found</td></tr>
                )}
                {rows.map(ts => (
                  <tr key={ts.id}>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>{fmtDate(ts.week_start_date || ts.weekStartDate)}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>{fmtDateTime(ts.submission_date || ts.submissionDate)}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>{total(ts).toFixed(2)}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button 
                        onClick={() => window.open(`/view?id=${ts.id}&from=history`, '_blank')}
                        style={{ 
                          background: 'transparent', 
                          color: 'var(--primary)', 
                          borderColor: 'var(--primary)',
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


