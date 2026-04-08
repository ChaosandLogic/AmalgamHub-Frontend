'use client'
import { useEffect, useState } from 'react'
import Header from '../components/Header'
import { useToast } from '../components/Toast'
import LoadingSpinner from '../components/LoadingSpinner'
import { BarChart3 } from 'lucide-react'
import { useApiData } from '../lib/hooks/useApiData'

export default function ReportsPage() {
  const toast = useToast()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'jobs' | 'weekly' | 'monthly'>('overview')

  // Set default date range to last 3 months
  useEffect(() => {
    const end = new Date()
    const start = new Date()
    start.setMonth(start.getMonth() - 3)
    setEndDate(end.toISOString().split('T')[0])
    setStartDate(start.toISOString().split('T')[0])
  }, [])

  const reportsUrl = startDate && endDate
    ? `/api/reports?${new URLSearchParams({ startDate, endDate })}`
    : null

  const { data: reportData, loading, error, refetch: refreshReports } = useApiData<any>(reportsUrl)

  useEffect(() => {
    if (error) toast.error(error || 'Failed to load reports')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error])

  function exportToCSV(data: any[], filename: string) {
    try {
      const headers = Object.keys(data[0]).join(',')
      const rows = data.map(row => Object.values(row).join(','))
      const csv = [headers, ...rows].join('\n')
      
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      
      toast.success('Report exported successfully!')
    } catch (e) {
      toast.error('Failed to export report')
    }
  }

  const container: React.CSSProperties = {
    padding: 16,
    flex: 1,
    overflow: 'auto'
  }

  const inner: React.CSSProperties = {
    maxWidth: 1400,
    margin: '0 auto'
  }

  const header: React.CSSProperties = {
    marginBottom: 24,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16
  }

  const dateFilters: React.CSSProperties = {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap'
  }

  const input: React.CSSProperties = {
    padding: '8px 12px',
    border: '1px solid var(--border)',
    borderRadius: 8,
    fontSize: 14,
    background: 'var(--surface)',
    color: 'var(--text-primary)'
  }

  const tabs: React.CSSProperties = {
    display: 'flex',
    gap: 8,
    marginBottom: 24,
    borderBottom: '1px solid var(--border)',
    overflowX: 'auto'
  }

  const tab = (isActive: boolean): React.CSSProperties => ({
    padding: '12px 20px',
    cursor: 'pointer',
    borderBottom: isActive ? '3px solid var(--accent-primary)' : '3px solid transparent',
    color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)',
    fontWeight: isActive ? 600 : 500,
    fontSize: 14,
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap'
  })

  const card: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16
  }

  const statCard: React.CSSProperties = {
    ...card,
    textAlign: 'center'
  }

  const statGrid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16,
    marginBottom: 24
  }

  const table: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14
  }

  const th: React.CSSProperties = {
    textAlign: 'left',
    padding: 12,
    borderBottom: '2px solid var(--border)',
    fontWeight: 600,
    color: 'var(--text-secondary)'
  }

  const td: React.CSSProperties = {
    padding: 12,
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-primary)'
  }

  const button: React.CSSProperties = {
    padding: '8px 16px',
    background: 'var(--accent-primary)',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500
  }

  if (loading) {
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
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>Reports</h1>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, background: 'var(--bg-secondary)' }}>
          <LoadingSpinner size={32} />
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading reports...</div>
        </div>
      </div>
    )
  }

  if (!reportData) {
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
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>Reports</h1>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No data available</div>
        </div>
      </div>
    )
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
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <BarChart3 size={28} style={{ flexShrink: 0, color: 'var(--accent-primary)' }} />
          Reports & Analytics
        </h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={dateFilters}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              From:
              <input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)}
                style={input}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              To:
              <input 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)}
                style={input}
              />
            </label>
            <button 
              onClick={refreshReports} 
              style={{
                ...button,
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--accent-primary-hover)'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--accent-primary)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16, background: 'var(--bg-secondary)' }}>
        <div style={{
          maxWidth: 1400,
          margin: '0 auto',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 24,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          {/* Tabs */}
          <div style={tabs}>
            <div onClick={() => setActiveTab('overview')} style={tab(activeTab === 'overview')}>
              Overview
            </div>
            <div onClick={() => setActiveTab('users')} style={tab(activeTab === 'users')}>
              By User
            </div>
            <div onClick={() => setActiveTab('jobs')} style={tab(activeTab === 'jobs')}>
              By Job
            </div>
            <div onClick={() => setActiveTab('weekly')} style={tab(activeTab === 'weekly')}>
              Weekly
            </div>
            <div onClick={() => setActiveTab('monthly')} style={tab(activeTab === 'monthly')}>
              Monthly
            </div>
          </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div>
            <div style={statGrid}>
              <div style={statCard}>
                <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent-primary)', marginBottom: 8 }}>
                  {(reportData?.totalHours ?? 0).toFixed(1)}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Total Hours</div>
              </div>
              <div style={statCard}>
                <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--success)', marginBottom: 8 }}>
                  {(reportData?.totalStandardHours ?? 0).toFixed(1)}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Standard Hours</div>
              </div>
              <div style={statCard}>
                <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--warning)', marginBottom: 8 }}>
                  {(reportData?.totalOvertimeHours ?? 0).toFixed(1)}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Overtime Hours</div>
              </div>
              <div style={statCard}>
                <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent-primary)', marginBottom: 8 }}>
                  {reportData?.timesheetCount ?? 0}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Timesheets</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>
              <div style={card}>
                <h3 style={{ marginTop: 0, color: 'var(--text-primary)', fontWeight: 600 }}>Top 5 Users by Hours</h3>
                <table style={table}>
                  <thead>
                    <tr>
                      <th style={th}>User</th>
                      <th style={th}>Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.byUser.slice(0, 5).map((user: any, i: number) => (
                      <tr key={i}>
                        <td style={td}>{user.userName}</td>
                        <td style={td}>{user.totalHours.toFixed(1)}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={card}>
                <h3 style={{ marginTop: 0, color: 'var(--text-primary)', fontWeight: 600 }}>Top 5 Jobs by Hours</h3>
                <table style={table}>
                  <thead>
                    <tr>
                      <th style={th}>Job Number</th>
                      <th style={th}>Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.byJob.slice(0, 5).map((job: any, i: number) => (
                      <tr key={i}>
                        <td style={td}>{job.jobNumber}</td>
                        <td style={td}>{job.totalHours.toFixed(1)}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 600 }}>Hours by User</h3>
              <button 
                onClick={() => exportToCSV(reportData.byUser, 'hours_by_user')}
                style={button}
              >
                Export CSV
              </button>
            </div>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>User</th>
                  <th style={th}>Email</th>
                  <th style={th}>Total Hours</th>
                  <th style={th}>Standard</th>
                  <th style={th}>Overtime</th>
                  <th style={th}>Timesheets</th>
                </tr>
              </thead>
              <tbody>
                {reportData.byUser.map((user: any, i: number) => (
                  <tr key={i}>
                    <td style={td}>{user.userName}</td>
                    <td style={td}>{user.userEmail}</td>
                    <td style={td}><strong>{user.totalHours.toFixed(1)}h</strong></td>
                    <td style={td}>{user.standardHours.toFixed(1)}h</td>
                    <td style={td}>{user.overtimeHours.toFixed(1)}h</td>
                    <td style={td}>{user.timesheetCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Jobs Tab */}
        {activeTab === 'jobs' && (
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 600 }}>Hours by Job Number</h3>
              <button 
                onClick={() => exportToCSV(reportData.byJob, 'hours_by_job')}
                style={button}
              >
                Export CSV
              </button>
            </div>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Job Number</th>
                  <th style={th}>Total Hours</th>
                  <th style={th}>Users</th>
                </tr>
              </thead>
              <tbody>
                {reportData.byJob.map((job: any, i: number) => (
                  <tr key={i}>
                    <td style={td}><strong>{job.jobNumber}</strong></td>
                    <td style={td}>{job.totalHours.toFixed(1)}h</td>
                    <td style={td}>{job.userCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Weekly Tab */}
        {activeTab === 'weekly' && (
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 600 }}>Weekly Summary</h3>
              <button 
                onClick={() => exportToCSV(reportData.byWeek, 'weekly_summary')}
                style={button}
              >
                Export CSV
              </button>
            </div>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Week Starting</th>
                  <th style={th}>Total Hours</th>
                  <th style={th}>Standard</th>
                  <th style={th}>Overtime</th>
                  <th style={th}>Users</th>
                </tr>
              </thead>
              <tbody>
                {reportData.byWeek.map((week: any, i: number) => (
                  <tr key={i}>
                    <td style={td}><strong>{new Date(week.weekStart).toLocaleDateString('en-GB')}</strong></td>
                    <td style={td}>{week.totalHours.toFixed(1)}h</td>
                    <td style={td}>{week.standardHours.toFixed(1)}h</td>
                    <td style={td}>{week.overtimeHours.toFixed(1)}h</td>
                    <td style={td}>{week.userCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Monthly Tab */}
        {activeTab === 'monthly' && (
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 600 }}>Monthly Summary</h3>
              <button 
                onClick={() => exportToCSV(reportData.byMonth, 'monthly_summary')}
                style={button}
              >
                Export CSV
              </button>
            </div>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Month</th>
                  <th style={th}>Total Hours</th>
                  <th style={th}>Standard</th>
                  <th style={th}>Overtime</th>
                  <th style={th}>Users</th>
                </tr>
              </thead>
              <tbody>
                {reportData.byMonth.map((month: any, i: number) => (
                  <tr key={i}>
                    <td style={td}><strong>{month.month}</strong></td>
                    <td style={td}>{month.totalHours.toFixed(1)}h</td>
                    <td style={td}>{month.standardHours.toFixed(1)}h</td>
                    <td style={td}>{month.overtimeHours.toFixed(1)}h</td>
                    <td style={td}>{month.userCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

