import Link from 'next/link'

export default function NotFound() {
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
      <p style={{ fontSize: 72, fontWeight: 700, margin: 0, lineHeight: 1, color: 'var(--border-strong)' }}>404</p>
      <h2 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Page not found</h2>
      <p style={{ color: 'var(--text-secondary)', margin: 0, textAlign: 'center', maxWidth: 400 }}>
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/schedule"
        style={{
          padding: '8px 20px',
          background: 'var(--accent-primary)',
          color: '#fff',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 500,
          textDecoration: 'none',
        }}
      >
        Go to dashboard
      </Link>
    </div>
  )
}
