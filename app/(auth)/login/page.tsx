'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useToast } from '../../components/Toast'
import { AuthForm, authFormStyles } from '../../components/AuthForm'
import LoadingSpinner from '../../components/LoadingSpinner'
import { DEFAULT_DASHBOARD_ROUTE } from '../../lib/constants/routes'
import { apiPost } from '../../lib/api/client'

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
      await apiPost('/api/login', { email, password }, { defaultErrorMessage: 'Invalid credentials' })
      toast.success('Login successful!')
      const redirectTo = searchParams.get('redirect') || DEFAULT_DASHBOARD_ROUTE
      router.replace(redirectTo)
    } catch (e: unknown) {
      const message = e instanceof Error ? (e instanceof Error ? e.message : String(e)) : 'Invalid credentials'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthForm
      title="Login"
      onSubmit={onSubmit}
      submitLabel={loading ? 'Signing in…' : 'Sign in'}
      loading={loading}
      error={error}
      secondaryLink={{ href: '/forgot-password', label: 'Forgot password?' }}
      footer={
        <p className={authFormStyles.footerText}>
          Don&apos;t have an account?{' '}
          <a href="/register" className={authFormStyles.link}>
            Sign up
          </a>
        </p>
      }
    >
      <label className={authFormStyles.label}>
        Email
        <input
          className={authFormStyles.input}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label className={authFormStyles.label}>
        Password
        <input
          className={authFormStyles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
    </AuthForm>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className={authFormStyles.container}>
          <div className={authFormStyles.wrapper}>
            <h2 className={authFormStyles.title}>Login</h2>
            <div className={authFormStyles.card} style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <LoadingSpinner size={32} />
            </div>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
