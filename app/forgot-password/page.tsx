'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '../components/Toast'
import styles from './page.module.css'

export default function ForgotPasswordPage() {
  const router = useRouter()
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
      const response = await fetch('/api/forgot-password', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ email }),
        credentials: 'include' 
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to process request')
      }
      
      setSuccess(true)
      toast.success('Password reset instructions sent!')
      
      // In development, show the reset link
      if (data.resetLink) {
        setResetLink(data.resetLink)
      }
    } catch (e: any) {
      const message = e.message || 'Failed to process request'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <h2 className={styles.title}>Reset Your Password</h2>
        
        {!success ? (
          <>
            <p className={styles.description}>
              Enter your email address and we'll send you a link to reset your password.
            </p>
            
            <form onSubmit={onSubmit} className={styles.card}>
              <label className={styles.label}>
                Email Address
                <input 
                  className={styles.input}
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  type="email" 
                  placeholder="your@email.com"
                  required 
                />
              </label>
              
              {error && (
                <div className={styles.error}>
                  {error}
                </div>
              )}
              
              <div className={styles.actions}>
                <Link href="/login" className={styles.linkButton}>
                  Back to Login
                </Link>
                <button 
                  disabled={loading} 
                  type="submit"
                  style={{ flex: 1 }}
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className={styles.card}>
            <div className={styles.success}>
              <strong>Check your email!</strong><br />
              If an account exists with <strong>{email}</strong>, you will receive a password reset link shortly.
            </div>
            
            {resetLink && (
              <div className={styles.devMode}>
                <strong className={styles.devModeLabel}>Development Mode:</strong>
                <br />
                <a 
                  href={resetLink.replace('http://localhost:3002', '')} 
                  className={styles.devModeLink}
                >
                  Click here to reset password
                </a>
              </div>
            )}
            
            <Link href="/login" className={styles.linkButton} style={{ width: '100%', display: 'block' }}>
              Return to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
