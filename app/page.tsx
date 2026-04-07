'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DEFAULT_DASHBOARD_ROUTE } from './lib/constants/routes'
import LoadingSpinner from './components/LoadingSpinner'
import LandingContent from './LandingContent'
import { useUser } from './lib/hooks/useUser'
import { apiPost } from './lib/api/client'

export default function LandingPage() {
  const router = useRouter()
  const { user, loading } = useUser()
  const isAuthenticated = !!user

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const handleGetStarted = () => {
    if (isAuthenticated) router.push(DEFAULT_DASHBOARD_ROUTE)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    try {
      await apiPost('/api/login', { email, password })
      router.replace(DEFAULT_DASHBOARD_ROUTE)
    } catch (e: unknown) {
      setLoginError((e instanceof Error ? e.message : String(e)) || 'Invalid credentials')
    } finally {
      setLoginLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <LoadingSpinner size={48} />
        <span style={{ color: 'var(--text-secondary)', fontSize: 16, fontWeight: 500 }}>Loading...</span>
      </div>
    )
  }

  return (
    <>
      {/* Login dialog — shown when not authenticated */}
      {!isAuthenticated && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-backdrop)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div
            style={{ background: 'var(--surface)', borderRadius: 12, padding: 32, maxWidth: '400px', width: '90vw', boxShadow: '0 10px 25px var(--shadow-lg)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 24px 0', fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center' }}>Login</h2>
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--input-bg)', color: 'var(--input-text)', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--input-bg)', color: 'var(--input-text)', boxSizing: 'border-box' }}
                />
              </div>
              {loginError && (
                <div style={{ color: 'var(--error)', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
                  {loginError}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <a href="/forgot-password" style={{ fontSize: 13, color: 'var(--accent-primary)', textDecoration: 'none' }}>
                  Forgot password?
                </a>
                <button
                  type="submit"
                  disabled={loginLoading}
                  style={{ padding: '10px 24px', background: loginLoading ? 'var(--text-tertiary)' : 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: loginLoading ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}
                >
                  {loginLoading ? 'Signing in…' : 'Sign in'}
                </button>
              </div>
            </form>
            <div style={{ textAlign: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                Don't have an account?{' '}
                <a href="/register" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}>Sign up</a>
              </p>
            </div>
          </div>
        </div>
      )}

      <LandingContent
        isAuthenticated={isAuthenticated}
        onGetStarted={handleGetStarted}
        onRegister={() => router.push('/register')}
      />
    </>
  )
}
