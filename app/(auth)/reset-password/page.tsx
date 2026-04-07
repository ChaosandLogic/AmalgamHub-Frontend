'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '../../components/Toast'
import { AuthForm, authFormStyles } from '../../components/AuthForm'
import LoadingSpinner from '../../components/LoadingSpinner'
import { apiPost } from '../../lib/api/client'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()
  const [token, setToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [invalidToken, setInvalidToken] = useState(false)

  useEffect(() => {
    const tokenFromUrl = searchParams.get('token')
    if (tokenFromUrl) {
      setToken(tokenFromUrl)
    } else {
      setInvalidToken(true)
      toast.error('Invalid or missing reset token')
    }
  }, [searchParams, toast])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (newPassword.length < 8) {
      const msg = 'Password must be at least 8 characters'
      setError(msg)
      toast.error(msg)
      return
    }
    if (newPassword !== confirmPassword) {
      const msg = 'Passwords do not match'
      setError(msg)
      toast.error(msg)
      return
    }
    setLoading(true)
    try {
      await apiPost('/api/reset-password', { token, newPassword }, { defaultErrorMessage: 'Failed to reset password' })
      setSuccess(true)
      toast.success('Password reset successful! Redirecting to login...')
      setTimeout(() => router.push('/login'), 3000)
    } catch (e: unknown) {
      const message = e instanceof Error ? (e instanceof Error ? e.message : String(e)) : 'Failed to reset password'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  if (invalidToken) {
    return (
      <div className={authFormStyles.container}>
        <div className={authFormStyles.wrapper}>
          <h2 className={authFormStyles.title}>Invalid Reset Link</h2>
          <div className={authFormStyles.card}>
            <div className={authFormStyles.error}>
              This password reset link is invalid or missing. Please request a new password reset.
            </div>
            <Link href="/forgot-password" className={authFormStyles.linkButton}>
              Request New Reset Link
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className={authFormStyles.container}>
        <div className={authFormStyles.wrapper}>
          <h2 className={authFormStyles.title}>Set New Password</h2>
          <div className={authFormStyles.card}>
            <div className={authFormStyles.success}>
              <strong>✓ Password Reset Successful!</strong>
              <br />
              Your password has been updated. Redirecting to login...
            </div>
            <Link href="/login" className={authFormStyles.linkButton}>
              Go to Login Now
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <AuthForm
      title="Set New Password"
      description="Enter your new password below."
      onSubmit={onSubmit}
      submitLabel={loading ? 'Resetting…' : 'Reset Password'}
      loading={loading}
      error={error}
      actionsCenter
    >
      <label className={authFormStyles.label}>
        New Password
        <input
          className={authFormStyles.input}
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Minimum 8 characters"
          required
          minLength={8}
        />
      </label>
      <label className={authFormStyles.label}>
        Confirm Password
        <input
          className={authFormStyles.input}
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter your password"
          required
          minLength={8}
        />
      </label>
    </AuthForm>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className={authFormStyles.container}>
          <div className={authFormStyles.wrapper}>
            <div className={authFormStyles.card} style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <LoadingSpinner size={32} />
            </div>
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
