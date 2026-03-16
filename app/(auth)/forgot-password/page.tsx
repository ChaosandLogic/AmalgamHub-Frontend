'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useToast } from '../../components/Toast'
import { AuthForm, authFormStyles } from '../../components/AuthForm'
import { apiPost } from '../../lib/api/client'

export default function ForgotPasswordPage() {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resetLink, setResetLink] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setLoading(true)
    try {
      const data = await apiPost<{ resetLink?: string }>(
        '/api/forgot-password',
        { email },
        { defaultErrorMessage: 'Failed to process request' }
      )
      setSuccess(true)
      toast.success('Password reset instructions sent!')
      if (data?.resetLink) setResetLink(data.resetLink)
    } catch (e: unknown) {
      const message = e instanceof Error ? (e instanceof Error ? e.message : String(e)) : 'Failed to process request'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className={authFormStyles.container}>
        <div className={authFormStyles.wrapper}>
          <h2 className={authFormStyles.title}>Reset Your Password</h2>
          <div className={authFormStyles.card}>
            <div className={authFormStyles.success}>
              <strong>Check your email!</strong>
              <br />
              If an account exists with <strong>{email}</strong>, you will receive a password reset link shortly.
            </div>
            {resetLink && (
              <div className={authFormStyles.devMode}>
                <strong>Development Mode:</strong>
                <br />
                <a
                  href={resetLink.replace('http://localhost:3002', '')}
                  className={authFormStyles.devModeLink}
                >
                  Click here to reset password
                </a>
              </div>
            )}
            <Link href="/login" className={authFormStyles.linkButton} style={{ width: '100%', display: 'block', textAlign: 'center' }}>
              Return to Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <AuthForm
      title="Reset Your Password"
      description="Enter your email address and we'll send you a link to reset your password."
      onSubmit={onSubmit}
      submitLabel={loading ? 'Sending…' : 'Send Reset Link'}
      loading={loading}
      error={error}
      secondaryLink={{ href: '/login', label: 'Back to Login' }}
    >
      <label className={authFormStyles.label}>
        Email Address
        <input
          className={authFormStyles.input}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
        />
      </label>
    </AuthForm>
  )
}
