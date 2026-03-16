'use client'

import { useState, useEffect } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useToast } from '../../components/Toast'
import { useUser } from '../../lib/hooks/useUser'
import { apiPatch, apiPut } from '../../lib/api/client'

export default function SettingsAccount() {
  const toast = useToast()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [dailyWorkingHoursStart, setDailyWorkingHoursStart] = useState('09:00')
  const [dailyWorkingHoursEnd, setDailyWorkingHoursEnd] = useState('17:00')
  const [message, setMessage] = useState('')
  const [pwdMsg, setPwdMsg] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [darkMode, setDarkMode] = useState(false)
  const { user } = useUser()

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

  useEffect(() => {
    if (!user) return
    setName(user.name || '')
    setEmail(user.email || '')
    const u = user as { dailyWorkingHoursStart?: string; dailyWorkingHoursEnd?: string }
    if (u.dailyWorkingHoursStart) setDailyWorkingHoursStart(u.dailyWorkingHoursStart)
    if (u.dailyWorkingHoursEnd) setDailyWorkingHoursEnd(u.dailyWorkingHoursEnd)
  }, [user])

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

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    try {
      await apiPatch('/api/users/me', {
        name,
        email,
        dailyWorkingHoursStart,
        dailyWorkingHoursEnd
      })
      setMessage('Profile updated')
      toast.success('Profile updated successfully!')
    } catch (error: unknown) {
      const msg = (error instanceof Error ? error.message : String(error)) || 'Failed to update profile'
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
      const res = await apiPut('/api/users/me/password', { currentPassword, newPassword })
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
    } catch (error: unknown) {
      const msg = (error instanceof Error ? error.message : String(error)) || 'Failed to change password'
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
          <button type="submit" className="btn-lift" style={button}>
            Save profile
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
          <button type="submit" className="btn-lift" style={button}>
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
