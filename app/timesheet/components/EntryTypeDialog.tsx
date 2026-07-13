'use client'

import { ENTRY_TYPE_COLORS, type EntryType } from '../lib/constants'

export interface EntryTypeSegment {
  dayIndex: number
  rowId: string
  start: number
  end: number
}

const ENTRY_TYPE_OPTIONS: {
  type: EntryType
  label: string
  description: string
}[] = [
  {
    type: 'standard',
    label: 'Standard',
    description:
      'Work at your base, or local travel during normal hours.',
  },
  {
    type: 'overtime',
    label: 'Overtime',
    description:
      'Approved site work away from base (client site, exhibition, installation, etc.). Includes travel to/from site and time on site. Paid at 1.33× or taken as TOIL — record your choice on the timesheet. Site rate already covers overtime; no extra premium for hours over 8/day while on site.',
  },
  {
    type: 'extra-overtime',
    label: 'Overtime+',
    description:
      'Overnight site work — when you are required to stay away from home overnight. Paid at 1.5× or taken as TOIL. Must be pre-approved and recorded on your timesheet.',
  },
]

interface EntryTypeDialogProps {
  segment: EntryTypeSegment | null
  onSelectType: (type: EntryType) => void
  onDelete: () => void
  onCancel: () => void
}

export default function EntryTypeDialog({
  segment,
  onSelectType,
  onDelete,
  onCancel,
}: EntryTypeDialogProps) {
  if (!segment) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 24,
          maxWidth: 440,
          width: '90vw',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          style={{
            margin: '0 0 8px 0',
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          Entry type
        </h3>
        <p
          style={{
            margin: '0 0 16px 0',
            fontSize: 13,
            color: 'var(--text-secondary)',
            lineHeight: 1.45,
          }}
        >
          Choose how this time block is counted under the Site Work and Expenses Policy.
          Site hours must be pre-approved; unpaid lunch breaks stay as separate entries.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ENTRY_TYPE_OPTIONS.map(({ type, label, description }) => (
            <button
              key={type}
              type="button"
              onClick={() => onSelectType(type)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '12px 16px',
                borderRadius: 8,
                border: `2px solid ${ENTRY_TYPE_COLORS[type].border}`,
                background: ENTRY_TYPE_COLORS[type].bg,
                color: 'var(--text-primary)',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  background: ENTRY_TYPE_COLORS[type].border,
                  flexShrink: 0,
                  marginTop: 2,
                }}
              />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontWeight: 600 }}>{label}</span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 400,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.4,
                  }}
                >
                  {description}
                </span>
              </span>
            </button>
          ))}
        </div>
        <div
          style={{
            marginTop: 16,
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={onDelete}
            style={{
              background: 'transparent',
              color: 'var(--error)',
              border: '1px solid var(--error)',
              padding: '8px 16px',
              borderRadius: 6,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Delete entry
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              padding: '8px 16px',
              borderRadius: 6,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
