'use client'

export interface OverlapDetail {
  day: string
  dayIndex: number
  time: string
  jobs: string[]
}

interface OverlapWarningDialogProps {
  isOpen: boolean
  overlapDetails: OverlapDetail[]
  onDismiss: () => void
  onProceedAnyway: () => void
}

export default function OverlapWarningDialog({
  isOpen,
  overlapDetails,
  onDismiss,
  onProceedAnyway,
}: OverlapWarningDialogProps) {
  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={onDismiss}
    >
      <div
        style={{
          background: 'var(--card)',
          border: '2px solid var(--error)',
          borderRadius: 12,
          padding: 24,
          maxWidth: 500,
          width: '90vw',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 10px 25px rgba(239, 68, 68, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: '32px' }}>⚠️</span>
          <h3
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: '600',
              color: 'var(--error)',
            }}
          >
            Time Overlap Detected
          </h3>
        </div>
        <p
          style={{
            margin: 0,
            marginBottom: 16,
            color: 'var(--muted)',
            lineHeight: 1.5,
          }}
        >
          Multiple jobs are assigned to the same time slots. Please review the
          overlaps below:
        </p>

        <div
          style={{
            background: 'var(--error-light)',
            border: '1px solid var(--error-border)',
            borderRadius: 8,
            padding: 12,
            marginBottom: 20,
            maxHeight: 300,
            overflowY: 'auto',
          }}
        >
          {overlapDetails.map((overlap, idx) => (
            <div
              key={idx}
              style={{
                marginBottom:
                  idx < overlapDetails.length - 1 ? 12 : 0,
                paddingBottom:
                  idx < overlapDetails.length - 1 ? 12 : 0,
                borderBottom:
                  idx < overlapDetails.length - 1
                    ? '1px solid var(--error-border)'
                    : 'none',
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: 'var(--error-dark)',
                  marginBottom: 4,
                }}
              >
                {overlap.day} at {overlap.time}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--error-dark)',
                }}
              >
                Overlapping jobs:{' '}
                <strong>{overlap.jobs.join(', ')}</strong>
              </div>
            </div>
          ))}
        </div>

        <p
          style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          You can either go back and fix the overlaps, or proceed with submission
          anyway. Overlapping time entries may cause issues with reporting and
          billing.
        </p>

        <div
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onDismiss}
            style={{
              background: 'var(--primary)',
              color: 'white',
              border: '1px solid var(--primary)',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Go Back & Fix
          </button>
          <button
            type="button"
            onClick={onProceedAnyway}
            style={{
              background: 'var(--error)',
              color: 'white',
              border: '1px solid var(--error)',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Proceed Anyway
          </button>
        </div>
      </div>
    </div>
  )
}
