'use client'

import { useEffect, type ReactNode } from 'react'
import { parseLocalDateString } from '../../lib/utils/dateUtils'

const TIMESLOT_RESOURCE_TYPES = ['vehicle', 'room', 'equipment']

function formatTime(time: string): string {
  const [h, m] = time.split(':')
  return `${parseInt(h, 10)}:${m}`
}

function formatDateRange(start: string, end?: string | null): string {
  const startD = parseLocalDateString(start)
  const endD = end ? parseLocalDateString(end) : startD
  const opts: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }
  const a = startD.toLocaleDateString('en-GB', opts)
  const b = endD.toLocaleDateString('en-GB', opts)
  return a === b ? a : `${a} – ${b}`
}

interface BookingDetailDialogProps {
  booking: any
  resourceName: string
  resourceType?: string
  projectLabel: string
  projectManagerName?: string | null
  onClose: () => void
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontSize: 14, color: 'var(--text-primary)', wordBreak: 'break-word' }}>{children}</span>
    </div>
  )
}

export default function BookingDetailDialog({
  booking,
  resourceName,
  resourceType = 'person',
  projectLabel,
  projectManagerName,
  onClose,
}: BookingDetailDialogProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const showTimeslots = TIMESLOT_RESOURCE_TYPES.includes(resourceType.toLowerCase())
  const tentative = booking.tentative === 1 || booking.tentative === true
  const description = (booking.description ?? '').toString().trim()
  const priority = (booking.priority ?? '').toString().trim() || 'normal'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--modal-backdrop)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={onClose}
      role="presentation"
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 12,
          padding: 24,
          maxWidth: '450px',
          width: '90vw',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 10px 25px var(--shadow-lg)',
          color: 'var(--text-primary)',
        }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-detail-title"
      >
        <h3 id="booking-detail-title" style={{ margin: '0 0 16px 0', color: 'var(--text-primary)' }}>
          Booking details
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
          {resourceName ? <Row label="Resource">{resourceName}</Row> : null}
          {(booking.title ?? '').toString().trim() ? (
            <Row label="Title">{booking.title}</Row>
          ) : null}
          <Row label="Dates">{formatDateRange(booking.start_date, booking.end_date)}</Row>

          {showTimeslots && booking.start_time && booking.end_time ? (
            <Row label="Time">
              {formatTime(booking.start_time)} – {formatTime(booking.end_time)}
            </Row>
          ) : null}
          {!showTimeslots && booking.hours != null && booking.hours !== '' ? (
            <Row label="Hours per day">{String(booking.hours)}</Row>
          ) : null}

          <Row label="Project">{projectLabel || '—'}</Row>
          {projectManagerName ? <Row label="Project manager">{projectManagerName}</Row> : null}
          <Row label="Priority">{priority}</Row>
          <Row label="Tentative">{tentative ? 'Yes' : 'No'}</Row>
          {description ? <Row label="Description">{description}</Row> : null}
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '10px 18px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--accent-primary)',
            color: 'white',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            width: '100%',
          }}
        >
          Close
        </button>
      </div>
    </div>
  )
}
