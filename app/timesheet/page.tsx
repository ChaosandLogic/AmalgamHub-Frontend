'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '../components/Header'
import Timeline from './Timeline'

export default function TimesheetPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [timesheetsEnabled, setTimesheetsEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/user', { credentials: 'include' })
      if (r.status === 401) { router.replace('/login'); return }
      const response = await r.json()
      setUser(response.data?.user || response.user)
      
      // Check if timesheets are enabled
      try {
        const settingsRes = await fetch('/api/global-settings', { credentials: 'include' })
        if (settingsRes.ok) {
          const settingsResponse = await settingsRes.json()
          const settings = settingsResponse.data?.settings || settingsResponse.settings
          setTimesheetsEnabled(settings?.timesheets_enabled !== false)
        }
      } catch (error) {
        console.error('Error checking timesheets status:', error)
        setTimesheetsEnabled(true) // Default to enabled on error
      }
    })()
  }, [router])

  // Show message if timesheets are disabled (all users including admins)
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
          background: 'var(--bg-primary)'
        }}>
          <div style={{
            background: 'var(--surface-elevated)',
            padding: 32,
            borderRadius: 12,
            maxWidth: 500,
            textAlign: 'center',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{ 
              margin: '0 0 16px 0', 
              fontSize: 24, 
              fontWeight: 600,
              color: 'var(--text-primary)'
            }}>
              Timesheets Disabled
            </h2>
            <p style={{ 
              margin: 0, 
              fontSize: 16,
              color: 'var(--text-secondary)',
              lineHeight: 1.6
            }}>
              Timesheets are currently disabled. Please contact an administrator if you need access.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Header />
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <Timeline userName={user?.name} />
      </div>
    </div>
  )
}


