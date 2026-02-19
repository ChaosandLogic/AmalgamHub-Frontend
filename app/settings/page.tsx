'use client'

import { useState, useEffect } from 'react'
import Header from '../components/Header'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'
import { Moon, Sun } from 'lucide-react'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'account' | 'history' | 'admin'>('account')
  const [user, setUser] = useState<{ role: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load user data to check role
    const loadUser = async () => {
      try {
        const res = await fetch('/api/user', { credentials: 'include' })
        if (res.ok) {
          const response = await res.json()
          setUser(response.data?.user || response.user)
        }
      } catch {
        setUser(null)
      } finally {
        setLoading(false)
      }
    }
    loadUser()
  }, [])

  const isAdmin = user?.role === 'admin'
  const isBooker = user?.role === 'booker'

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
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>Settings</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {/* Tab selector */}
          <div
            style={{
              display: 'inline-flex',
              borderRadius: 999,
              border: '1px solid var(--border)',
              padding: 4,
              background: 'var(--surface)',
              gap: 4
            }}
          >
            <button
              onClick={() => setActiveTab('account')}
              style={{
                border: 'none',
                borderRadius: 999,
                padding: '6px 14px',
                fontSize: 13,
                cursor: 'pointer',
                background: activeTab === 'account' ? 'var(--surface)' : 'transparent',
                color: activeTab === 'account' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'account' ? 600 : 500
              }}
            >
              Account
            </button>
            <button
              onClick={() => setActiveTab('history')}
              style={{
                border: 'none',
                borderRadius: 999,
                padding: '6px 14px',
                fontSize: 13,
                cursor: 'pointer',
                background: activeTab === 'history' ? 'var(--surface)' : 'transparent',
                color: activeTab === 'history' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'history' ? 600 : 500
              }}
            >
              History
            </button>
            {isAdmin && !isBooker && (
              <button
                onClick={() => setActiveTab('admin')}
                style={{
                  border: 'none',
                  borderRadius: 999,
                  padding: '6px 14px',
                  fontSize: 13,
                  cursor: 'pointer',
                  background: activeTab === 'admin' ? 'var(--surface)' : 'transparent',
                  color: activeTab === 'admin' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontWeight: activeTab === 'admin' ? 600 : 500
                }}
              >
                Admin
              </button>
            )}
          </div>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16, background: 'var(--bg-secondary)' }}>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 24,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {activeTab === 'account' ? <AccountSettings /> : activeTab === 'history' ? <HistorySettings /> : (isAdmin && !isBooker) ? <AdminSettings /> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function AccountSettings() {
  const toast = useToast()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [timelineStartHour, setTimelineStartHour] = useState<number | string>(7)
  const [dailyWorkingHoursStart, setDailyWorkingHoursStart] = useState('09:00')
  const [dailyWorkingHoursEnd, setDailyWorkingHoursEnd] = useState('17:00')
  const [message, setMessage] = useState('')
  const [pwdMsg, setPwdMsg] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    // Check if dark mode is enabled from localStorage or class
    const savedDarkMode = localStorage.getItem('darkMode')
    const isDark = savedDarkMode === 'enabled' || 
                   document.documentElement.classList.contains('dark-mode') || 
                   document.body.classList.contains('dark-mode')
    setDarkMode(isDark)
    
    // Apply dark mode if saved
    if (savedDarkMode === 'enabled') {
      document.documentElement.classList.add('dark-mode')
      document.body.classList.add('dark-mode')
    }
  }, [])

  function toggleDarkMode() {
    const newDarkMode = !darkMode
    setDarkMode(newDarkMode)
    
    // Toggle dark mode class on html and body
    if (newDarkMode) {
      document.documentElement.classList.add('dark-mode')
      document.body.classList.add('dark-mode')
      localStorage.setItem('darkMode', 'enabled')
    } else {
      document.documentElement.classList.remove('dark-mode')
      document.body.classList.remove('dark-mode')
      localStorage.setItem('darkMode', 'disabled')
    }
    
    toast.success(newDarkMode ? 'Dark mode enabled' : 'Dark mode disabled')
  }

  // Load user on first render
  useState(() => {
    ;(async () => {
      try {
        const r = await fetch('/api/user', { credentials: 'include' })
        if (r.ok) {
          const response = await r.json()
          const user = response.data?.user || response.user
          setName(user?.name || '')
          setEmail(user?.email || '')
          if (user?.timelineStartHour != null) setTimelineStartHour(user.timelineStartHour)
          if (user?.dailyWorkingHoursStart) setDailyWorkingHoursStart(user.dailyWorkingHoursStart)
          if (user?.dailyWorkingHoursEnd) setDailyWorkingHoursEnd(user.dailyWorkingHoursEnd)
        }
      } catch {}
    })()
  })

  async function post(path: string, body: any) {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include'
    })
    if (!r.ok) throw new Error('Request failed')
    return r.json().catch(() => ({}))
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    try {
      await post('/api/update-account', { 
        name, 
        email, 
        dailyWorkingHoursStart,
        dailyWorkingHoursEnd
      })
      setMessage('Profile updated')
      toast.success('Profile updated successfully!')
    } catch (error: any) {
      const msg = error.message || 'Failed to update profile'
      setMessage(msg)
      toast.error(msg)
    }
  }

  async function saveTimeline(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    try {
      await post('/api/update-timeline-settings', { timelineStartHour: Number(timelineStartHour) })
      setMessage('Timeline settings saved')
      toast.success('Timeline settings saved successfully!')
    } catch (error: any) {
      const msg = error.message || 'Failed to save timeline settings'
      setMessage(msg)
      toast.error(msg)
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwdMsg('')
    if (!currentPassword) {
      const msg = 'Current password is required'
      setPwdMsg(msg)
      toast.error(msg)
      return
    }
    if (!newPassword) {
      const msg = 'New password is required'
      setPwdMsg(msg)
      toast.error(msg)
      return
    }
    if (newPassword.length < 8) {
      const msg = 'Password must be at least 8 characters'
      setPwdMsg(msg)
      toast.error(msg)
      return
    }
    if (newPassword !== confirmPassword) {
      const msg = 'Passwords do not match'
      setPwdMsg(msg)
      toast.error(msg)
      return
    }
    try {
      const res = await post('/api/change-password', { currentPassword, newPassword })
      if ((res as any)?.success === false) {
        const msg = (res as any)?.message || 'Failed to change password'
        setPwdMsg(msg)
        toast.error(msg)
        return
      }
      setPwdMsg('Password changed successfully')
      toast.success('Password changed successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      const msg = error.message || 'Failed to change password'
      setPwdMsg(msg)
      toast.error(msg)
    }
  }

  const container: React.CSSProperties = { width: '100%', display: 'grid', gap: 24 }
  const card: React.CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 12,
    background: 'var(--card)',
    padding: 16,
    display: 'grid',
    gap: 12
  }
  const label: React.CSSProperties = { display: 'grid', gap: 6, fontSize: 13, color: 'var(--muted)' }
  const input: React.CSSProperties = {
    padding: '10px 12px',
    border: '1px solid var(--border)',
    borderRadius: 10,
    fontSize: 14
  }
  const actions: React.CSSProperties = { display: 'flex', gap: 8, justifyContent: 'flex-end' }
  const button: React.CSSProperties = {
    background: 'var(--primary)',
    color: 'white',
    border: '1px solid var(--primary)',
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  }
  const heading: React.CSSProperties = { margin: 0 }
  const note: React.CSSProperties = { color: 'green' }

  return (
    <div style={container}>
      <h3 style={heading}>Account</h3>
      {message && <div style={note}>{message}</div>}

      <form onSubmit={saveProfile} style={card}>
        <h4 style={heading}>Profile</h4>
        <label style={label}>
          Name
          <input style={input} value={name} onChange={e => setName((e.target as HTMLInputElement).value)} required />
        </label>
        <label style={label}>
          Email
          <input
            style={input}
            value={email}
            onChange={e => setEmail((e.target as HTMLInputElement).value)}
            type="email"
            required
          />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={label}>
            Daily working hours start
            <input
              style={input}
              type="time"
              value={dailyWorkingHoursStart}
              onChange={e => setDailyWorkingHoursStart((e.target as HTMLInputElement).value)}
            />
          </label>
          <label style={label}>
            Daily working hours end
            <input
              style={input}
              type="time"
              value={dailyWorkingHoursEnd}
              onChange={e => setDailyWorkingHoursEnd((e.target as HTMLInputElement).value)}
            />
          </label>
        </div>
        <div style={actions}>
          <button type="submit" style={button}>
            Save profile
          </button>
        </div>
      </form>

      <form onSubmit={saveTimeline} style={card}>
        <h4 style={heading}>Timeline Preferences</h4>
        <label style={label}>
          Timeline start hour
          <input
            style={input}
            type="number"
            min={0}
            max={23}
            value={timelineStartHour}
            onChange={e => setTimelineStartHour((e.target as HTMLInputElement).value)}
          />
        </label>
        <div style={actions}>
          <button type="submit" style={button}>
            Save timeline
          </button>
        </div>
      </form>

      <form onSubmit={changePassword} style={card}>
        <h4 style={heading}>Change Password</h4>
        {pwdMsg && (
          <div style={{ color: pwdMsg.includes('successfully') ? 'green' : 'crimson' }}>
            {pwdMsg}
          </div>
        )}
        <label style={label}>
          Current password
          <input
            style={input}
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword((e.target as HTMLInputElement).value)}
          />
        </label>
        <label style={label}>
          New password
          <input
            style={input}
            type="password"
            value={newPassword}
            onChange={e => setNewPassword((e.target as HTMLInputElement).value)}
          />
        </label>
        <label style={label}>
          Confirm new password
          <input
            style={input}
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword((e.target as HTMLInputElement).value)}
          />
        </label>
        <div style={actions}>
          <button type="submit" style={button}>
            Change password
          </button>
        </div>
      </form>

      {/* Dark Mode Toggle */}
      <div style={card}>
        <h4 style={heading}>Appearance</h4>
        <label style={label}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {darkMode ? (
                <Moon size={20} style={{ color: 'var(--accent-primary)' }} />
              ) : (
                <Sun size={20} style={{ color: 'var(--accent-primary)' }} />
              )}
              <span style={{ fontWeight: '500', color: 'var(--text)' }}>
                Dark Mode
              </span>
            </div>
            <button
              type="button"
              onClick={toggleDarkMode}
              style={{
                width: '52px',
                height: '28px',
                borderRadius: '14px',
                border: 'none',
                background: darkMode ? 'var(--accent-primary)' : 'var(--border-strong)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.3s ease',
                padding: 0
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'white',
                  position: 'absolute',
                  top: '2px',
                  left: darkMode ? '26px' : '2px',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                }}
              />
            </button>
          </div>
          <small style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8, display: 'block' }}>
            Toggle between light and dark theme
          </small>
        </label>
      </div>
    </div>
  )
}

function AdminSettings() {
  const toast = useToast()
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showClearBookingsConfirm, setShowClearBookingsConfirm] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    setLoading(true)
    try {
      console.log('Loading settings...')
      const r = await fetch('/api/global-settings', { credentials: 'include' })
      console.log('Settings response status:', r.status)
      if (!r.ok) {
        if (r.status === 401) {
          throw new Error('Please login first')
        } else if (r.status === 403) {
          throw new Error('Admin access required')
        }
        throw new Error(`Failed to load settings (${r.status})`)
      }
      const response = await r.json()
      const d = response.data || response
      const settings = d.settings || response.settings
      console.log('Settings loaded:', settings)
      // Normalize booleans from SQLite (0/1 -> false/true)
      setSettings({
        ...settings,
        overtime_enabled: !!settings?.overtime_enabled,
        weekend_overtime_enabled: !!settings?.weekend_overtime_enabled,
        timesheets_enabled: settings?.timesheets_enabled !== undefined ? !!settings.timesheets_enabled : true, // Default to enabled
        timezone: settings?.timezone || 'UTC',
        country_code: settings?.country_code || '',
        department_list: Array.isArray(settings?.department_list) ? settings.department_list : (settings?.department_list ? JSON.parse(settings.department_list) : []),
        job_role_list: Array.isArray(settings?.job_role_list) ? settings.job_role_list : (settings?.job_role_list ? JSON.parse(settings.job_role_list) : []),
        label_list: Array.isArray(settings?.label_list) ? settings.label_list : (settings?.label_list ? JSON.parse(settings.label_list) : [])
      })
    } catch (e: any) {
      console.error('Load settings error:', e)
      setError(e.message)
    } finally { setLoading(false) }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault()
    setMessage(''); setError('')

    if (!settings) return

    try {
      // Ensure shapes match API: booleans and arrays
      const settingsToSave = {
        ...settings,
        overtime_enabled: !!settings.overtime_enabled,
        weekend_overtime_enabled: !!settings.weekend_overtime_enabled,
        timesheets_enabled: settings.timesheets_enabled !== undefined ? !!settings.timesheets_enabled : true,
        timezone: settings.timezone || 'UTC',
        country_code: settings.country_code || '',
        department_list: Array.isArray(settings.department_list) 
          ? settings.department_list.map((d: string) => d.trim()).filter((d: string) => d.length > 0)
          : [],
        job_role_list: Array.isArray(settings.job_role_list) 
          ? settings.job_role_list.map((r: string) => r.trim()).filter((r: string) => r.length > 0)
          : [],
        label_list: Array.isArray(settings.label_list) 
          ? settings.label_list.filter((l: any) => l && typeof l === 'object' && l.name && l.name.trim().length > 0)
          : []
      }
      const r = await fetch('/api/global-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsToSave),
        credentials: 'include'
      })

      const responseText = await r.text() // Get raw response
      console.log('Response status:', r.status)
      console.log('Response text:', responseText)

      if (!r.ok) {
        let errorMessage = 'Failed to save settings'
        try {
          const errorData = JSON.parse(responseText)
          errorMessage = errorData.message || errorMessage
        } catch {
          errorMessage = responseText || errorMessage
        }
        throw new Error(errorMessage)
      }

      const d = JSON.parse(responseText)
      // Extract settings from response (handle both response.data.settings and response.settings)
      const responseData = d.data || d
      const savedSettings = responseData.settings || d.settings
      
      if (!savedSettings) {
        throw new Error('Settings not returned from server')
      }
      
      // Normalize booleans from SQLite (0/1 -> false/true)
      setSettings({
        ...savedSettings,
        overtime_enabled: !!savedSettings?.overtime_enabled,
        weekend_overtime_enabled: !!savedSettings?.weekend_overtime_enabled,
        timesheets_enabled: savedSettings?.timesheets_enabled !== undefined ? !!savedSettings.timesheets_enabled : true, // Default to enabled
        timezone: savedSettings?.timezone || 'UTC',
        country_code: savedSettings?.country_code || '',
        department_list: Array.isArray(savedSettings?.department_list) ? savedSettings.department_list : (savedSettings?.department_list ? JSON.parse(savedSettings.department_list) : []),
        job_role_list: Array.isArray(savedSettings?.job_role_list) ? savedSettings.job_role_list : (savedSettings?.job_role_list ? JSON.parse(savedSettings.job_role_list) : []),
        label_list: Array.isArray(savedSettings?.label_list) ? savedSettings.label_list : (savedSettings?.label_list ? JSON.parse(savedSettings.label_list) : [])
      })
      setMessage('Settings saved successfully')
      toast.success('Settings saved successfully!')
    } catch (e: any) {
      console.error('Save error:', e)
      const errorMsg = e.message || 'Failed to save settings'
      setError(errorMsg)
      toast.error(errorMsg)
    }
  }

  if (loading) return <div>Loading...</div>

  if (!settings) return <div style={{ color: 'crimson' }}>{error || 'Failed to load settings'}</div>

  const container: React.CSSProperties = { width: '100%', display: 'grid', gap: 24 }
  const card: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, background: 'var(--card)', padding: 16, display: 'grid', gap: 12 }
  const label: React.CSSProperties = { display: 'grid', gap: 6, fontSize: 13, color: 'var(--muted)' }
  const input: React.CSSProperties = { padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14 }
  const actions: React.CSSProperties = { display: 'flex', gap: 8, justifyContent: 'flex-end' }
  const button: React.CSSProperties = { 
    background: 'var(--primary)', 
    color: 'white', 
    border: '1px solid var(--primary)',
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  }
  const heading: React.CSSProperties = { margin: 0 }
  const note: React.CSSProperties = { color: 'var(--success)', textAlign: 'center' }
  const errorStyle: React.CSSProperties = { color: 'crimson', textAlign: 'center' }

  return (
    <div style={container}>
      <h3 style={heading}>Admin Settings</h3>
      {message && <div style={note}>{message}</div>}
      {error && <div style={errorStyle}>{error}</div>}

      <form 
        onSubmit={saveSettings} 
        onKeyDown={e => {
          // Prevent form submission when Enter is pressed in a textarea
          if (e.key === 'Enter' && e.target instanceof HTMLTextAreaElement) {
            e.preventDefault()
            e.stopPropagation()
            // Allow the textarea to handle Enter normally (new line)
            return false
          }
        }}
        style={card}
      >
        <h4 style={heading}>Features</h4>
        <label style={label}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={settings.timesheets_enabled !== false}
              onChange={e => {
                const newValue = e.target.checked
                setSettings({ ...settings, timesheets_enabled: newValue })
              }}
            />
            Enable timesheets access for all users
          </div>
          <small style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 24 }}>
            When disabled, all users (including admins) cannot access or create timesheets.
          </small>
        </label>

        <h4 style={heading}>Overtime</h4>
        <label style={label}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={!!settings.overtime_enabled}
              onChange={e => setSettings({ ...settings, overtime_enabled: e.target.checked })}
            />
            Enable user-controlled overtime entry
          </div>
        </label>

        <label style={label}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={!!settings.weekend_overtime_enabled}
              onChange={e => setSettings({ ...settings, weekend_overtime_enabled: e.target.checked })}
              disabled={!settings.overtime_enabled}
            />
            Automatically mark weekend hours (Sat & Sun) as overtime
          </div>
          <small style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 24 }}>
            When enabled, all hours recorded on Saturday and Sunday will automatically count as overtime
          </small>
        </label>

        <label style={label}>
          <div style={{ fontWeight: '500', marginBottom: 8 }}>System Timezone</div>
          <select
            value={settings.timezone || 'UTC'}
            onChange={e => setSettings({ ...settings, timezone: e.target.value })}
            style={{
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontSize: '14px',
              background: 'var(--surface)',
              cursor: 'pointer',
              maxWidth: '400px'
            }}
          >
            <option value="UTC">UTC (Coordinated Universal Time)</option>
            <option value="America/New_York">Eastern Time (ET)</option>
            <option value="America/Chicago">Central Time (CT)</option>
            <option value="America/Denver">Mountain Time (MT)</option>
            <option value="America/Los_Angeles">Pacific Time (PT)</option>
            <option value="America/Anchorage">Alaska Time (AKT)</option>
            <option value="Pacific/Honolulu">Hawaii Time (HT)</option>
            <option value="Europe/London">London (GMT/BST)</option>
            <option value="Europe/Paris">Central European Time (CET)</option>
            <option value="Europe/Athens">Eastern European Time (EET)</option>
            <option value="Asia/Dubai">Dubai (GST)</option>
            <option value="Asia/Kolkata">India (IST)</option>
            <option value="Asia/Shanghai">China (CST)</option>
            <option value="Asia/Tokyo">Japan (JST)</option>
            <option value="Australia/Sydney">Sydney (AEDT/AEST)</option>
            <option value="Australia/Perth">Perth (AWST)</option>
            <option value="Pacific/Auckland">New Zealand (NZDT/NZST)</option>
          </select>
          <small style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8, display: 'block' }}>
            Sets the timezone for date calculations and week boundaries
          </small>
        </label>

        <label style={label}>
          <div style={{ fontWeight: '500', marginBottom: 8 }}>Country for Public Holidays</div>
          <select
            value={settings.country_code || ''}
            onChange={e => setSettings({ ...settings, country_code: e.target.value })}
            style={{
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontSize: '14px',
              background: 'var(--surface)',
              cursor: 'pointer',
              maxWidth: '400px'
            }}
          >
            <option value="">-- Select Country --</option>
            <option value="US">United States</option>
            <option value="GB">United Kingdom</option>
            <option value="CA">Canada</option>
            <option value="AU">Australia</option>
            <option value="NZ">New Zealand</option>
            <option value="IE">Ireland</option>
            <option value="DE">Germany</option>
            <option value="FR">France</option>
            <option value="ES">Spain</option>
            <option value="IT">Italy</option>
            <option value="NL">Netherlands</option>
            <option value="BE">Belgium</option>
            <option value="CH">Switzerland</option>
            <option value="AT">Austria</option>
            <option value="SE">Sweden</option>
            <option value="NO">Norway</option>
            <option value="DK">Denmark</option>
            <option value="FI">Finland</option>
            <option value="PL">Poland</option>
            <option value="PT">Portugal</option>
            <option value="GR">Greece</option>
            <option value="JP">Japan</option>
            <option value="CN">China</option>
            <option value="IN">India</option>
            <option value="SG">Singapore</option>
            <option value="MY">Malaysia</option>
            <option value="PH">Philippines</option>
            <option value="TH">Thailand</option>
            <option value="ID">Indonesia</option>
            <option value="KR">South Korea</option>
            <option value="BR">Brazil</option>
            <option value="MX">Mexico</option>
            <option value="AR">Argentina</option>
            <option value="ZA">South Africa</option>
          </select>
          <small style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8, display: 'block' }}>
            Select your country to automatically sync public holidays to the schedule. Holidays will be added to all person resources.
          </small>
        </label>

        <h4 style={heading}>Value Lists</h4>
        
        <label style={label}>
          Departments (one per line)
          <textarea
            value={Array.isArray(settings.department_list) ? settings.department_list.join('\n') : ''}
            onChange={e => {
              // Don't filter empty lines here - allow them for multi-line editing
              const departments = e.target.value.split('\n')
              setSettings({...settings, department_list: departments})
            }}
            onKeyDown={e => {
              // Allow Enter to work normally in textarea
              if (e.key === 'Enter') {
                e.stopPropagation()
                // Don't prevent default - let Enter create new line
              }
            }}
            placeholder="Engineering&#10;Sales&#10;Marketing&#10;Operations"
            style={{
              ...input,
              minHeight: '100px',
              fontFamily: 'monospace',
              resize: 'vertical'
            }}
          />
          <small style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Enter one department per line. These will be available as options when creating resources.
          </small>
        </label>

        <label style={label}>
          Job Roles (one per line)
          <textarea
            value={Array.isArray(settings.job_role_list) ? settings.job_role_list.join('\n') : ''}
            onChange={e => {
              // Don't filter empty lines here - allow them for multi-line editing
              const roles = e.target.value.split('\n')
              setSettings({...settings, job_role_list: roles})
            }}
            onKeyDown={e => {
              // Allow Enter to work normally in textarea
              if (e.key === 'Enter') {
                e.stopPropagation()
                // Don't prevent default - let Enter create new line
              }
            }}
            placeholder="Manager&#10;Developer&#10;Designer&#10;Analyst"
            style={{
              ...input,
              minHeight: '100px',
              fontFamily: 'monospace',
              resize: 'vertical'
            }}
          />
          <small style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Enter one job role per line. These will be available as options when creating resources.
          </small>
        </label>

        <label style={label}>
          <div style={{ fontWeight: '500', marginBottom: 8 }}>Task Labels</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.isArray(settings.label_list) && settings.label_list.map((label: any, index: number) => (
              <div key={index} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="color"
                  value={label.color || '#3b82f6'}
                  onChange={e => {
                    const newLabelList = [...(settings.label_list || [])]
                    newLabelList[index] = { ...label, color: e.target.value }
                    setSettings({ ...settings, label_list: newLabelList })
                  }}
                  style={{
                    width: '40px',
                    height: '40px',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    padding: 0
                  }}
                />
                <input
                  type="text"
                  value={label.name || ''}
                  onChange={e => {
                    const newLabelList = [...(settings.label_list || [])]
                    newLabelList[index] = { ...label, name: e.target.value }
                    setSettings({ ...settings, label_list: newLabelList })
                  }}
                  placeholder="Label name"
                  style={{
                    ...input,
                    flex: 1
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const newLabelList = [...(settings.label_list || [])]
                    newLabelList.splice(index, 1)
                    setSettings({ ...settings, label_list: newLabelList })
                  }}
                  style={{
                    ...button,
                    background: 'var(--error)',
                    borderColor: 'var(--error)',
                    padding: '8px 12px'
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const newLabelList = [...(settings.label_list || []), { name: '', color: '#3b82f6' }]
                setSettings({ ...settings, label_list: newLabelList })
              }}
              style={{
                ...button,
                background: 'var(--accent-primary)',
                borderColor: 'var(--accent-primary)',
                alignSelf: 'flex-start'
              }}
            >
              Add Label
            </button>
          </div>
          <small style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8, display: 'block' }}>
            Configure task labels that will be available when creating or editing task cards. Each label has a name and color.
          </small>
        </label>

        <div style={actions}>
          <button type="submit" style={button}>Save Settings</button>
        </div>
      </form>

      {/* Database Backup and Restore */}
      <div style={card}>
        <h4 style={heading}>Database Backup & Restore</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <p style={{ margin: '0 0 12px 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
              Create a backup of your database or restore from a previous backup. 
              A safety backup is automatically created before any restore operation.
            </p>
            
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={async () => {
                  try {
                    setMessage('')
                    setError('')
                    const response = await fetch('/api/admin/backup', {
                      method: 'POST',
                      credentials: 'include'
                    })
                    
                    if (!response.ok) {
                      const errorData = await response.json().catch(() => ({}))
                      throw new Error(errorData.message || 'Failed to create backup')
                    }
                    
                    // Download the file
                    const blob = await response.blob()
                    const url = window.URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `timetracker-backup-${new Date().toISOString().slice(0, 10)}.db`
                    document.body.appendChild(a)
                    a.click()
                    window.URL.revokeObjectURL(url)
                    document.body.removeChild(a)
                    
                    toast.success('Backup created and downloaded successfully')
                    setMessage('Backup created and downloaded successfully')
                  } catch (e: any) {
                    console.error('Backup error:', e)
                    setError(e.message || 'Failed to create backup')
                    toast.error(e.message || 'Failed to create backup')
                  }
                }}
                style={{
                  ...button,
                  background: 'var(--accent-primary)',
                  color: 'white',
                  border: '1px solid var(--accent-primary)'
                }}
              >
                Download Backup
              </button>
              
              <label style={{ ...button, cursor: 'pointer', display: 'inline-block' }}>
                <input
                  type="file"
                  accept=".db"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    
                    try {
                      setMessage('')
                      setError('')
                      
                      if (!file.name.endsWith('.db')) {
                        throw new Error('Please select a .db file')
                      }
                      
                      const formData = new FormData()
                      formData.append('backupFile', file)
                      
                      const response = await fetch('/api/admin/restore', {
                        method: 'POST',
                        credentials: 'include',
                        body: formData
                      })
                      
                      const responseData = await response.json()
                      const data = responseData.data || responseData
                      
                      if (!response.ok) {
                        throw new Error(data.message || 'Failed to restore database')
                      }
                      
                      toast.success(data.message || 'Database restored successfully')
                      setMessage(data.message || 'Database restored successfully. Please refresh the page.')
                      
                      // Reset file input
                      e.target.value = ''
                    } catch (e: any) {
                      console.error('Restore error:', e)
                      setError(e.message || 'Failed to restore database')
                      toast.error(e.message || 'Failed to restore database')
                      e.target.value = ''
                    }
                  }}
                />
                <span style={{ pointerEvents: 'none' }}>Restore from Backup</span>
              </label>
            </div>
            
            <small style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8, display: 'block' }}>
              ⚠️ Restoring will replace your current database. A safety backup is created automatically before restore.
            </small>
          </div>
        </div>
      </div>

      {/* Clear All Bookings */}
      <div style={card}>
        <h4 style={heading}>Danger Zone</h4>
        <label style={label}>
          <div style={{ fontWeight: '500', marginBottom: 8, color: 'var(--error)' }}>Clear All Bookings</div>
          <small style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12, display: 'block' }}>
            This will permanently delete all bookings from the schedule. This action cannot be undone.
          </small>
          <button
            type="button"
            onClick={() => {
              setShowClearBookingsConfirm(true)
            }}
            style={{
              ...button,
              background: 'var(--error)',
              borderColor: 'var(--error)',
              color: 'white'
            }}
          >
            Clear All Bookings
          </button>
        </label>
      </div>

      <ConfirmDialog
        isOpen={showClearBookingsConfirm}
        title="Clear All Bookings"
        message="This will permanently delete all bookings from the schedule. This action cannot be undone."
        confirmText="Clear All"
        type="danger"
        onConfirm={async () => {
          setShowClearBookingsConfirm(false)
          try {
            const r = await fetch('/api/bookings/all', { method: 'DELETE', credentials: 'include' })
            if (!r.ok) throw new Error('Failed to clear bookings')
            const response = await r.json().catch(() => ({}))
            const data = response.data || response
            toast.success(data.message || 'All bookings cleared')
          } catch (e: any) {
            toast.error(e.message || 'Failed to clear bookings')
          }
        }}
        onCancel={() => setShowClearBookingsConfirm(false)}
      />
    </div>
  )
}

function HistorySettings() {
  const toast = useToast()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useState(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const r = await fetch('/api/timesheets', { credentials: 'include' })
        if (!r.ok) throw new Error('Failed to load history')
        const response = await r.json()
        const data = response.data || response
        if (!cancelled) setRows(Array.isArray(data.timesheets) ? data.timesheets : [])
      } catch (e: any) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  })

  async function onExport(id: string) {
    try {
      const res = await fetch('/api/export-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Failed to export timesheet')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `timesheet-${id}.csv`
      document.body.appendChild(a)
      a.click()
      URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  function fmtDate(d: any) {
    try {
      return new Date(d).toLocaleDateString()
    } catch {
      return 'N/A'
    }
  }
  function fmtDateTime(d: any) {
    try {
      return new Date(d).toLocaleString()
    } catch {
      return 'N/A'
    }
  }
  function total(ts: any) {
    if (typeof ts?.totalHours === 'number') return ts.totalHours
    if (typeof ts?.summary?.totalHours === 'number') return ts.summary.totalHours
    if (typeof ts?.summary?.total === 'number') return ts.summary.total
    if (ts?.data) {
      try {
        const p = typeof ts.data === 'string' ? JSON.parse(ts.data) : ts.data
        if (p?.summary?.totalHours) return p.summary.totalHours
        if (p?.summary?.total) return p.summary.total
      } catch {}
    }
    return 0
  }

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>History</h3>
      {loading && <div>Loading…</div>}
      {error && <div style={{ color: 'crimson' }}>{error}</div>}
      {!loading && !error && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <th align="left" style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                  Week Start
                </th>
                <th align="left" style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                  Submitted
                </th>
                <th align="right" style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                  Total Hours
                </th>
                <th align="right" style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    style={{ padding: 16, textAlign: 'center', color: 'var(--text-secondary)' }}
                  >
                    No timesheets found
                  </td>
                </tr>
              )}
              {rows.map(ts => (
                <tr key={ts.id}>
                  <td
                    style={{
                      padding: '10px 12px',
                      borderBottom: '1px solid var(--border)'
                    }}
                  >
                    {fmtDate(ts.week_start_date || ts.weekStartDate)}
                  </td>
                  <td
                    style={{
                      padding: '10px 12px',
                      borderBottom: '1px solid var(--border)'
                    }}
                  >
                    {fmtDateTime(ts.submission_date || ts.submissionDate)}
                  </td>
                  <td
                    style={{
                      padding: '10px 12px',
                      borderBottom: '1px solid var(--border)',
                      textAlign: 'right'
                    }}
                  >
                    {total(ts).toFixed(2)}
                  </td>
                  <td
                    style={{
                      padding: '10px 12px',
                      borderBottom: '1px solid var(--border)',
                      textAlign: 'right',
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: 8
                    }}
                  >
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
  )
}


