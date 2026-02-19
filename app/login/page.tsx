'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useToast } from '../components/Toast'
import { DEFAULT_DASHBOARD_ROUTE } from '../lib/constants/routes'
import styles from './page.module.css'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }), credentials: 'include' })
      if (!r.ok) {
        const data = await r.json().catch(() => ({ message: 'Invalid credentials' }))
        throw new Error(data.message || 'Invalid credentials')
      }
      toast.success('Login successful!')
      // Redirect to the original page they were trying to access, or default dashboard
      const redirectTo = searchParams.get('redirect') || DEFAULT_DASHBOARD_ROUTE
      router.replace(redirectTo)
    } catch (e: any) { 
      const message = e.message || 'Invalid credentials'
      setError(message)
      toast.error(message)
    } finally { setLoading(false) }
  }

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <h2 className={styles.title}>Login</h2>
        <form onSubmit={onSubmit} className={styles.card}>
          <label className={styles.label}>
            Email
            <input className={styles.input} value={email} onChange={e => setEmail(e.target.value)} type="email" required />
          </label>
          <label className={styles.label}>
            Password
            <input className={styles.input} value={password} onChange={e => setPassword(e.target.value)} type="password" required />
          </label>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.actions}>
            <a href="/forgot-password" className={styles.link}>
              Forgot password?
            </a>
            <button disabled={loading} type="submit">{loading ? 'Signing in…' : 'Sign in'}</button>
          </div>
        </form>
        <div className={styles.footer}>
          <p className={styles.footerText}>
            Don't have an account?{' '}
            <a href="/register" className={styles.link}>
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className={styles.container}>
        <div className={styles.wrapper}>
          <h2 className={styles.title}>Login</h2>
          <div className={styles.card}>Loading...</div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
