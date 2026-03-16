'use client'

import { useEffect } from 'react'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Unhandled application error:', error)
  }, [error])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      gap: 16,
      padding: 24,
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
    }}>
      <h2 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Something went wrong</h2>
      <p style={{ color: 'var(--text-secondary)', margin: 0, textAlign: 'center', maxWidth: 400 }}>
        An unexpected error occurred. You can try again or return to the dashboard.
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={reset}
          style={{
            padding: '8px 20px',
            background: 'var(--accent-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Try again
        </button>
        <a
          href="/schedule"
          style={{
            padding: '8px 20px',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 14,
            cursor: 'pointer',
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          Go to dashboard
        </a>
      </div>
    </div>
  )
}
