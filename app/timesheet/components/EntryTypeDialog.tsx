'use client'

import { ENTRY_TYPE_COLORS, type EntryType } from '../lib/constants'

export interface EntryTypeSegment {
  dayIndex: number
  rowId: string
  start: number
  end: number
}

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
          maxWidth: 360,
          width: '90vw',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          style={{
            margin: '0 0 16px 0',
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
          }}
        >
          Choose how this time block is counted:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(
            ['standard', 'overtime'] as EntryType[]
          ).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onSelectType(type)}
              style={{
                display: 'flex',
                alignItems: 'center',
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
                }}
              />
              {type === 'standard' && 'Standard'}
              {type === 'overtime' && 'Overtime'}
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
