'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '../components/Toast'
import styles from './page.module.css'

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
      const r = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }), credentials: 'include' })
      if (!r.ok) {
        const data = await r.json().catch(() => ({ message: 'Registration failed' }))
        throw new Error(data.message || 'Registration failed')
      }
      toast.success('Account created successfully! Please login.')
      router.replace('/login')
    } catch (e: any) { 
      const message = e.message || 'Registration failed'
      setError(message)
      toast.error(message)
    } finally { setLoading(false) }
  }

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <h2 className={styles.title}>Create account</h2>
        <form onSubmit={onSubmit} className={styles.card}>
          <label className={styles.label}>
            Name
            <input className={styles.input} value={name} onChange={e => setName(e.target.value)} required />
          </label>
          <label className={styles.label}>
            Email
            <input className={styles.input} type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </label>
          <label className={styles.label}>
            Password
            <input className={styles.input} type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </label>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.actionsCenter}>
            <button disabled={loading} type="submit">{loading ? 'Creating…' : 'Create account'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
