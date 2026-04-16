'use client'

/**
 * Admin database cleanup UI (clear week / clear all timesheets).
 * Not mounted on the Users page by default — import into `app/admin/page.tsx`
 * when you need to expose these actions again.
 */

import { useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'
import { getLocalDateString } from '../lib/utils/dateUtils'
import { apiDelete } from '../lib/api/client'

type AdminDatabaseCleanupProps = {
  selectedWeek: Date
  onAfterClear: () => Promise<void>
}

export function AdminDatabaseCleanup({ selectedWeek, onAfterClear }: AdminDatabaseCleanupProps) {
  const toast = useToast()
  const [showClearWeekConfirm, setShowClearWeekConfirm] = useState(false)
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false)
  const [clearAllInput, setClearAllInput] = useState('')
  const [isClearing, setIsClearing] = useState(false)

  async function confirmClearWeek() {
    setIsClearing(true)
    try {
      const weekKey = getLocalDateString(selectedWeek)
      const data = await apiDelete<{ deleted: number }>(`/api/timesheets/admin/clear?weekDate=${weekKey}`)
      await onAfterClear()
      toast.success(`Cleared ${data.deleted ?? 0} record(s) for week ${weekKey}`)
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || 'Failed to clear week')
    } finally {
      setIsClearing(false)
      setShowClearWeekConfirm(false)
    }
  }

  async function confirmClearAll() {
    if (clearAllInput.trim().toUpperCase() !== 'DELETE ALL') return
    setIsClearing(true)
    try {
      const data = await apiDelete<{ deleted: number }>('/api/timesheets/admin/clear')
      await onAfterClear()
      toast.success(`All timesheet records cleared (${(data as { deleted?: number }).deleted ?? 0} rows removed)`)
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || 'Failed to clear all timesheets')
    } finally {
      setIsClearing(false)
      setShowClearAllConfirm(false)
      setClearAllInput('')
    }
  }

  return (
    <>
      <div style={{
        margin: '16px 16px 0',
        border: '1px solid var(--error-border, #fca5a5)',
        borderRadius: 10,
        padding: 16,
        background: 'var(--error-light, #fef2f2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--error-dark, #991b1b)', fontSize: 14 }}>
              Danger Zone — Database Cleanup
            </div>
            <div style={{ fontSize: 12, color: 'var(--error-dark, #991b1b)', opacity: 0.8, marginTop: 2 }}>
              These actions permanently remove timesheet records from SQLite. Use to purge test or spurious data.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setShowClearWeekConfirm(true)}
              style={{
                background: 'transparent',
                color: 'var(--error-dark, #991b1b)',
                border: '1px solid var(--error-border, #fca5a5)',
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
              title={`Clear all timesheet records for week commencing ${getLocalDateString(selectedWeek)}`}
            >
              Clear selected week
            </button>
            <button
              type="button"
              onClick={() => { setClearAllInput(''); setShowClearAllConfirm(true) }}
              style={{
                background: 'var(--error, #dc2626)',
                color: 'white',
                border: 'none',
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
              title="Permanently delete every timesheet record in the database"
            >
              Clear all timesheets
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showClearWeekConfirm}
        title="Clear week's timesheets"
        message={
          <>
            This will permanently delete <strong>all</strong> timesheet records (all users) for week
            commencing <strong>{new Date(getLocalDateString(selectedWeek)).toLocaleDateString('en-GB')}</strong>.
            <br /><br />
            This cannot be undone.
          </>
        }
        confirmText={isClearing ? 'Clearing…' : 'Clear week'}
        cancelText="Cancel"
        type="danger"
        onConfirm={confirmClearWeek}
        onCancel={() => setShowClearWeekConfirm(false)}
      />

      {showClearAllConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 24, width: 'min(440px, 92vw)', display: 'grid', gap: 16
          }}>
            <h3 style={{ margin: 0, color: 'var(--error, #dc2626)' }}>Clear all timesheet records</h3>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
              This will <strong>permanently delete every timesheet record</strong> in the database
              for all users across all time. This cannot be undone.
            </p>
            <p style={{ margin: 0, fontSize: 14 }}>
              Type <strong>DELETE ALL</strong> to confirm:
            </p>
            <input
              autoFocus
              value={clearAllInput}
              onChange={e => setClearAllInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && clearAllInput.trim().toUpperCase() === 'DELETE ALL') void confirmClearAll() }}
              placeholder="DELETE ALL"
              style={{
                padding: '8px 12px', borderRadius: 6,
                border: '1px solid var(--border)', fontSize: 14,
                background: 'var(--bg-primary)', color: 'var(--text-primary)'
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => { setShowClearAllConfirm(false); setClearAllInput('') }}
                style={{
                  background: 'transparent', color: 'var(--text-primary)',
                  border: '1px solid var(--border)', padding: '8px 16px',
                  borderRadius: 6, fontSize: 13, cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={clearAllInput.trim().toUpperCase() !== 'DELETE ALL' || isClearing}
                onClick={() => void confirmClearAll()}
                style={{
                  background: clearAllInput.trim().toUpperCase() === 'DELETE ALL' ? 'var(--error, #dc2626)' : 'var(--text-tertiary)',
                  color: 'white', border: 'none', padding: '8px 16px',
                  borderRadius: 6, fontSize: 13, fontWeight: 500,
                  cursor: clearAllInput.trim().toUpperCase() === 'DELETE ALL' ? 'pointer' : 'not-allowed',
                  opacity: isClearing ? 0.6 : 1,
                }}
              >
                {isClearing ? 'Clearing…' : 'Clear all timesheets'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
