'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useToast } from '../../components/Toast'
import AuthForm, { authFormStyles } from '../../components/AuthForm/AuthForm'
import { apiGet, apiPost } from '../../lib/api/client'

export default function AcceptInvitePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()
  const token = searchParams.get('token') || ''

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(true)
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    if (!token) {
      setInvalid(true)
      setValidating(false)
      return
    }
    ;(async () => {
      try {
        const data = await apiGet<{ name: string; email: string }>(`/api/invite/${token}`)
        setName(data.name)
        setEmail(data.email)
      } catch {
        setInvalid(true)
      } finally {
        setValidating(false)
      }
    })()
  }, [token])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      const msg = 'Password must be at least 8 characters'
      setError(msg)
      toast.error(msg)
      return
    }
    setLoading(true)
    try {
      await apiPost('/api/accept-invite', { token, password }, { defaultErrorMessage: 'Failed to create account' })
      toast.success('Account created successfully!')
      router.replace('/login')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to create account'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  if (validating) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <p>Validating invitation…</p>
      </div>
    )
  }

  if (invalid) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 12 }}>
        <p>This invitation link is invalid or has expired.</p>
        <a href="/login" style={{ color: 'var(--accent-primary)' }}>Go to login</a>
      </div>
    )
  }

  return (
    <AuthForm
      title="Accept Invitation"
      onSubmit={onSubmit}
      submitLabel={loading ? 'Creating account…' : 'Create account'}
      loading={loading}
      error={error}
      actionsCenter
      description="Set a password to complete your account setup."
    >
      <label className={authFormStyles.label}>
        Name
        <input
          className={authFormStyles.input}
          value={name}
          readOnly
          tabIndex={-1}
          style={{ opacity: 0.7, cursor: 'default' }}
        />
      </label>
      <label className={authFormStyles.label}>
        Email
        <input
          className={authFormStyles.input}
          type="email"
          value={email}
          readOnly
          tabIndex={-1}
          style={{ opacity: 0.7, cursor: 'default' }}
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
          autoFocus
        />
      </label>
    </AuthForm>
  )
}
