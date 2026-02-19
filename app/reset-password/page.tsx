'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '../components/Toast'
import styles from './page.module.css'

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
      const response = await fetch('/api/reset-password', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ token, newPassword }),
        credentials: 'include' 
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to reset password')
      }
      
      setSuccess(true)
      toast.success('Password reset successful! Redirecting to login...')
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login')
      }, 3000)
    } catch (e: any) {
      const message = e.message || 'Failed to reset password'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  if (invalidToken) {
    return (
      <div className={styles.container}>
        <div className={styles.wrapper}>
          <h2 className={styles.title}>Invalid Reset Link</h2>
          <div className={styles.card}>
            <div className={styles.error}>
              This password reset link is invalid or missing. Please request a new password reset.
            </div>
            <Link href="/forgot-password" className={styles.linkButton}>
              Request New Reset Link
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <h2 className={styles.title}>Set New Password</h2>
        
        {!success ? (
          <>
            <p className={styles.description}>
              Enter your new password below.
            </p>
            
            <form onSubmit={onSubmit} className={styles.card}>
              <label className={styles.label}>
                New Password
                <input 
                  className={styles.input}
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  type="password" 
                  placeholder="Minimum 8 characters"
                  required 
                  minLength={8}
                />
              </label>
              
              <label className={styles.label}>
                Confirm Password
                <input 
                  className={styles.input}
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                  type="password" 
                  placeholder="Re-enter your password"
                  required 
                  minLength={8}
                />
              </label>
              
              {error && (
                <div className={styles.error}>
                  {error}
                </div>
              )}
              
              <button 
                disabled={loading} 
                type="submit"
                style={{ width: '100%' }}
              >
                {loading ? 'Resetting Password...' : 'Reset Password'}
              </button>
            </form>
          </>
        ) : (
          <div className={styles.card}>
            <div className={styles.success}>
              <strong>✓ Password Reset Successful!</strong><br />
              Your password has been updated. Redirecting to login...
            </div>
            
            <Link href="/login" className={styles.linkButton}>
              Go to Login Now
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className={styles.loading}>
        <div>Loading...</div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}
