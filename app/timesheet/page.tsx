'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Header from '../components/Header'
import LoadingSpinner from '../components/LoadingSpinner'
import Timeline from './components/Timeline'
import { useUser } from '../lib/hooks/useUser'
import { apiGet } from '../lib/api/client'

function TimesheetPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editUserId = searchParams.get('userId')
  const initialWeek = searchParams.get('week')
  const from = searchParams.get('from')
  const { user, loading } = useUser()
  const [timesheetsEnabled, setTimesheetsEnabled] = useState<boolean | null>(null)
  const [targetUserName, setTargetUserName] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  useEffect(() => {
    if (!loading && editUserId && user?.payrollAccess !== true) {
      router.replace('/schedule')
    }
  }, [loading, editUserId, user, router])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    apiGet<{ settings: { timesheets_enabled?: boolean } }>('/api/global-settings')
      .then((data) => {
        if (!cancelled) setTimesheetsEnabled(data.settings?.timesheets_enabled !== false)
      })
      .catch(() => { if (!cancelled) setTimesheetsEnabled(true) })
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    if (!editUserId) {
      setTargetUserName(null)
      return
    }
    let cancelled = false
    apiGet<{ user: { name?: string } }>(`/api/users/${encodeURIComponent(editUserId)}`)
      .then((data) => {
        if (!cancelled) setTargetUserName(data.user?.name ?? null)
      })
      .catch(() => {
        if (!cancelled) setTargetUserName(null)
      })
    return () => { cancelled = true }
  }, [editUserId])

  if (loading) return null

  if (editUserId && user?.payrollAccess !== true) return null

  if (timesheetsEnabled === false) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <Header />
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: 'var(--bg-primary)',
        }}>
          <div style={{
            background: 'var(--surface-elevated)',
            padding: 32,
            borderRadius: 12,
            maxWidth: 500,
            textAlign: 'center',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          }}>
            <h2 style={{
              margin: '0 0 16px 0',
              fontSize: 24,
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}>
              Timesheets Disabled
            </h2>
            <p style={{
              margin: 0,
              fontSize: 16,
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
            }}>
              Timesheets are currently disabled. Please contact an administrator if you need access.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const returnPath = from === 'admin' ? '/admin' : '/timesheet'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Header />
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <Timeline
          userName={editUserId ? (targetUserName ?? undefined) : user?.name}
          editUserId={editUserId}
          editUserDisplayName={targetUserName}
          initialWeek={initialWeek}
          returnPath={returnPath}
        />
      </div>
    </div>
  )
}

export default function TimesheetPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <Header />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LoadingSpinner />
        </div>
      </div>
    }>
      <TimesheetPageContent />
    </Suspense>
  )
}
