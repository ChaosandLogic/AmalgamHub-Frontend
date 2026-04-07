'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '../../components/Toast'
import { AuthForm, authFormStyles } from '../../components/AuthForm'
import { apiPost } from '../../lib/api/client'

export default function RegisterPage() {
  const router = useRouter()
  const toast = useToast()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      await apiPost('/api/register', { name, email, password }, { defaultErrorMessage: 'Registration failed' })
      toast.success('Account created successfully! Please login.')
      router.replace('/login')
    } catch (e: unknown) {
      const message = e instanceof Error ? (e instanceof Error ? e.message : String(e)) : 'Registration failed'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthForm
      title="Create account"
      onSubmit={onSubmit}
      submitLabel={loading ? 'Creating…' : 'Create account'}
      loading={loading}
      error={error}
      actionsCenter
    >
      <label className={authFormStyles.label}>
        Name
        <input
          className={authFormStyles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>
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
