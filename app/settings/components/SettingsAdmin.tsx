'use client'

import { useState, useEffect } from 'react'
import { useToast } from '../../components/Toast'
import ConfirmDialog from '../../components/ConfirmDialog'
import LoadingSpinner from '../../components/LoadingSpinner'
import { apiGet, apiPost, apiDelete, apiPostFormData, apiDownload } from '../../lib/api/client'

export default function SettingsAdmin() {
  const toast = useToast()
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showClearBookingsConfirm, setShowClearBookingsConfirm] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  function normalizeSettings(s: any) {
    return {
      ...s,
      overtime_enabled: !!s?.overtime_enabled,
      weekend_overtime_enabled: !!s?.weekend_overtime_enabled,
      timesheets_enabled: s?.timesheets_enabled !== undefined ? !!s.timesheets_enabled : true,
      timezone: s?.timezone || 'UTC',
      country_code: s?.country_code || '',
      department_list: Array.isArray(s?.department_list) ? s.department_list : (s?.department_list ? JSON.parse(s.department_list) : []),
      job_role_list: Array.isArray(s?.job_role_list) ? s.job_role_list : (s?.job_role_list ? JSON.parse(s.job_role_list) : []),
      label_list: Array.isArray(s?.label_list) ? s.label_list : (s?.label_list ? JSON.parse(s.label_list) : [])
    }
  }

  async function loadSettings() {
    setLoading(true)
    try {
      const data = await apiGet<{ settings: any }>('/api/global-settings', { defaultErrorMessage: 'Failed to load settings' })
      setSettings(normalizeSettings(data.settings))
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : String(e)))
    } finally { setLoading(false) }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault()
    setMessage(''); setError('')

    if (!settings) return

    try {
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
      const data = await apiPost<{ settings: any }>('/api/global-settings', settingsToSave, { defaultErrorMessage: 'Failed to save settings' })
      if (!data.settings) throw new Error('Settings not returned from server')
      setSettings(normalizeSettings(data.settings))
      setMessage('Settings saved successfully')
      toast.success('Settings saved successfully!')
    } catch (e: unknown) {
      console.error('Save error:', e)
      const errorMsg = (e instanceof Error ? e.message : String(e)) || 'Failed to save settings'
      setError(errorMsg)
      toast.error(errorMsg)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
        <LoadingSpinner size={32} />
      </div>
    )
  }

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
          <button type="submit" className="btn-lift" style={button}>Save Settings</button>
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
                    await apiDownload(
                      '/api/admin/backup',
                      `timetracker-backup-${new Date().toISOString().slice(0, 10)}.db`,
                      { method: 'POST' }
                    )
                    toast.success('Backup created and downloaded successfully')
                    setMessage('Backup created and downloaded successfully')
                  } catch (e: unknown) {
                    console.error('Backup error:', e)
                    setError((e instanceof Error ? e.message : String(e)) || 'Failed to create backup')
                    toast.error((e instanceof Error ? e.message : String(e)) || 'Failed to create backup')
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

                      const data = await apiPostFormData<{ message?: string }>(
                        '/api/admin/restore',
                        formData,
                        { defaultErrorMessage: 'Failed to restore database' }
                      )

                      toast.success(data?.message || 'Database restored successfully')
                      setMessage(data?.message || 'Database restored successfully. Please refresh the page.')

                      // Reset file input
                      e.target.value = ''
                    } catch (e: unknown) {
                      console.error('Restore error:', e)
                      setError((e instanceof Error ? e.message : String(e)) || 'Failed to restore database')
                      toast.error((e instanceof Error ? e.message : String(e)) || 'Failed to restore database')
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
            await apiDelete('/api/bookings')
            toast.success('All bookings cleared')
          } catch (e: unknown) {
            toast.error((e instanceof Error ? e.message : String(e)) || 'Failed to clear bookings')
          }
        }}
        onCancel={() => setShowClearBookingsConfirm(false)}
      />
    </div>
  )
}
