'use client'

import { useRouter } from 'next/navigation'
import { DEFAULT_DASHBOARD_ROUTE } from './lib/constants/routes'
import { useEffect, useState } from 'react'

// SVG Icons
const CalendarIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 2V6M16 2V6M3 10H21M5 4H19C20.1046 4 21 4.89543 21 6V20C21 21.1046 20.1046 22 19 22H5C3.89543 22 3 21.1046 3 20V6C3 4.89543 3.89543 4 5 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const DragDropIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const ResourceIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9 11C11.2091 11 13 9.20914 13 7C13 4.79086 11.2091 3 9 3C6.79086 3 5 4.79086 5 7C5 9.20914 6.79086 11 9 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const ProjectIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 16V8C20.9996 7.64928 20.9071 7.30481 20.7315 7.00116C20.556 6.69751 20.3037 6.44536 20 6.27L13 2.27C12.696 2.09446 12.3511 2.00205 12 2.00205C11.6489 2.00205 11.304 2.09446 11 2.27L4 6.27C3.69626 6.44536 3.44798 6.69751 3.27246 7.00116C3.09694 7.30481 3.00452 7.64928 3.00452 8V16C3.00452 16.3507 3.09694 16.6952 3.27246 16.9988C3.44798 17.3025 3.69626 17.5546 4 17.73L11 21.73C11.304 21.9055 11.6489 21.9979 12 21.9979C12.3511 21.9979 12.696 21.9055 13 21.73L20 17.73C20.3037 17.5546 20.556 17.3025 20.7315 16.9988C20.9071 16.6952 20.9996 16.3507 21 16Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3.27 6.96L12 12.01L20.73 6.96" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 22.08V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const PriorityIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const DuplicateIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 8V5C8 4.46957 8.21071 3.96086 8.58579 3.58579C8.96086 3.21071 9.46957 3 10 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V14C21 14.5304 20.7893 15.0391 20.4142 15.4142C20.0391 15.7893 19.5304 16 19 16H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 8H5C3.89543 8 3 8.89543 3 10V19C3 20.1046 3.89543 21 5 21H14C15.1046 21 16 20.1046 16 19V8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export default function LandingPage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/user', { credentials: 'include' })
        if (res.ok) {
          setIsAuthenticated(true)
        }
      } catch {
        // Not authenticated
      } finally {
        setIsLoading(false)
      }
    }
    checkAuth()
  }, [])

  const handleGetStarted = () => {
    if (isAuthenticated) {
      router.push(DEFAULT_DASHBOARD_ROUTE)
    }
    // If not authenticated, login dialog will be shown
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    try {
      const r = await fetch('/api/login', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ email, password }), 
        credentials: 'include' 
      })
      if (!r.ok) {
        const data = await r.json().catch(() => ({ message: 'Invalid credentials' }))
        throw new Error(data.message || 'Invalid credentials')
      }
      setIsAuthenticated(true)
      router.replace(DEFAULT_DASHBOARD_ROUTE)
    } catch (e: any) { 
      const message = e.message || 'Invalid credentials'
      setLoginError(message)
    } finally { 
      setLoginLoading(false) 
    }
  }

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        minHeight: '100vh',
        background: 'var(--bg-primary)'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid var(--bg-tertiary)',
          borderTop: '4px solid var(--accent-primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <div style={{ 
          color: 'var(--text-secondary)', 
          fontSize: '16px',
          fontWeight: '500'
        }}>
          Loading...
        </div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  return (
    <>
      {/* Login Dialog - shown when not authenticated */}
      {!isAuthenticated && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--modal-backdrop)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 12,
              padding: 32,
              maxWidth: '400px',
              width: '90vw',
              boxShadow: '0 10px 25px var(--shadow-lg)',
              border: '1px solid var(--border)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ 
              margin: '0 0 24px 0', 
              fontSize: 24, 
              fontWeight: 600,
              color: 'var(--text-primary)',
              textAlign: 'center'
            }}>
              Login
            </h2>
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: 6, 
                  fontSize: 13, 
                  fontWeight: 500,
                  color: 'var(--text-secondary)'
                }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 14,
                    background: 'var(--input-bg)',
                    color: 'var(--input-text)',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: 6, 
                  fontSize: 13, 
                  fontWeight: 500,
                  color: 'var(--text-secondary)'
                }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 14,
                    background: 'var(--input-bg)',
                    color: 'var(--input-text)',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              {loginError && (
                <div style={{ 
                  color: 'var(--error)', 
                  fontSize: 13, 
                  marginBottom: 16,
                  textAlign: 'center'
                }}>
                  {loginError}
                </div>
              )}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: 16
              }}>
                <a 
                  href="/forgot-password" 
                  style={{ 
                    fontSize: 13, 
                    color: 'var(--accent-primary)', 
                    textDecoration: 'none'
                  }}
                >
                  Forgot password?
                </a>
                <button
                  type="submit"
                  disabled={loginLoading}
                  style={{
                    padding: '10px 24px',
                    background: loginLoading ? 'var(--text-tertiary)' : 'var(--accent-primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: loginLoading ? 'not-allowed' : 'pointer',
                    transition: 'background 0.2s'
                  }}
                >
                  {loginLoading ? 'Signing in…' : 'Sign in'}
                </button>
              </div>
            </form>
            <div style={{ 
              textAlign: 'center', 
              marginTop: 16,
              paddingTop: 16,
              borderTop: '1px solid var(--border)'
            }}>
              <p style={{ 
                margin: 0, 
                fontSize: 13, 
                color: 'var(--text-secondary)' 
              }}>
                Don't have an account?{' '}
                <a 
                  href="/register" 
                  style={{ 
                    color: 'var(--accent-primary)', 
                    textDecoration: 'none',
                    fontWeight: 500
                  }}
                >
                  Sign up
                </a>
              </p>
            </div>
          </div>
        </div>
      )}

    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Animated Background Elements */}
      <div style={{
        position: 'absolute',
        top: '-50%',
        right: '-10%',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(37, 99, 235, 0.1) 0%, transparent 70%)',
        borderRadius: '50%',
        animation: 'float 20s ease-in-out infinite',
        zIndex: 0
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-30%',
        left: '-10%',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(14, 165, 233, 0.08) 0%, transparent 70%)',
        borderRadius: '50%',
        animation: 'float 15s ease-in-out infinite reverse',
        zIndex: 0
      }} />

      {/* Hero Section */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        padding: '80px 20px 60px',
        textAlign: 'center',
        background: 'linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-tertiary) 100%)'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          animation: 'fadeInUp 0.8s ease-out'
      }}>
        {/* Logo/Title */}
          <div style={{ marginBottom: '32px', position: 'relative' }}>
            <div style={{
              display: 'inline-block',
              padding: '12px 24px',
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              borderRadius: '12px',
              marginBottom: '24px',
              boxShadow: '0 8px 24px rgba(37, 99, 235, 0.25)',
              animation: 'pulse 3s ease-in-out infinite'
            }}>
              <span style={{
                color: 'white',
                fontSize: '0.9rem',
                fontWeight: '600',
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}>
                Visual Scheduling Platform
              </span>
            </div>
        <h1 style={{
              fontSize: 'clamp(3rem, 10vw, 5.5rem)',
              fontWeight: '800',
          marginBottom: '24px',
              background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--accent-primary) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.03em',
              lineHeight: '1.1'
            }}>
              Amalgam Hub
        </h1>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              marginBottom: '16px'
            }}>
              <div style={{
                width: '60px',
                height: '4px',
                background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                borderRadius: '2px',
                animation: 'expand 1s ease-out 0.5s both'
              }} />
              <div style={{
                width: '8px',
                height: '8px',
                background: 'var(--accent-primary)',
                borderRadius: '50%',
                animation: 'pulse 2s ease-in-out infinite'
              }} />
              <div style={{
                width: '60px',
                height: '4px',
                background: 'linear-gradient(90deg, var(--accent-secondary), var(--accent-primary))',
                borderRadius: '2px',
                animation: 'expand 1s ease-out 0.5s both'
              }} />
            </div>
          </div>

        {/* Tagline */}
        <p style={{
            fontSize: 'clamp(1.3rem, 4vw, 2rem)',
            marginBottom: '20px',
            color: 'var(--text-primary)',
            fontWeight: '700',
            lineHeight: '1.3'
          }}>
            Visual resource scheduling made simple
        </p>

        <p style={{
            fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
          marginBottom: '48px',
            color: 'var(--text-secondary)',
            fontWeight: '400',
            maxWidth: '700px',
            margin: '0 auto 48px',
            lineHeight: '1.7'
          }}>
            Schedule people, equipment, and rooms with intuitive drag-and-drop. 
            Manage projects, track priorities, and optimize resource allocation across your team.
        </p>

        {/* CTA Buttons */}
        <div style={{
          display: 'flex',
          gap: '16px',
          justifyContent: 'center',
          flexWrap: 'wrap',
            marginBottom: '40px'
        }}>
          <button
            onClick={handleGetStarted}
            style={{
                padding: '18px 48px',
                fontSize: '1.15rem',
              fontWeight: '600',
                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                color: 'white',
              border: 'none',
                borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
                boxShadow: '0 8px 24px rgba(37, 99, 235, 0.35)',
                minWidth: '220px',
                position: 'relative',
                overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)'
                e.currentTarget.style.boxShadow = '0 12px 32px rgba(37, 99, 235, 0.45)'
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)'
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(37, 99, 235, 0.35)'
            }}
          >
              {isAuthenticated ? 'Go to Timesheet' : 'Get Started Free'}
          </button>

          {!isAuthenticated && (
            <button
              onClick={() => router.push('/register')}
              style={{
                  padding: '18px 48px',
                  fontSize: '1.15rem',
                fontWeight: '600',
                  background: 'var(--surface)',
                  color: 'var(--accent-primary)',
                  border: '2px solid var(--accent-primary)',
                  borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                  minWidth: '220px',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.15)'
              }}
              onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-tertiary)'
                  e.currentTarget.style.transform = 'translateY(-3px)'
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(37, 99, 235, 0.25)'
              }}
              onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--surface)'
                e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.15)'
              }}
            >
              Sign Up
            </button>
          )}
        </div>
        </div>
        </div>

      {/* Features Section */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        padding: '80px 20px',
        background: 'var(--bg-primary)'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          <div style={{
            textAlign: 'center',
            marginBottom: '64px'
          }}>
            <h2 style={{
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: '700',
              color: 'var(--text-primary)',
              marginBottom: '16px',
              letterSpacing: '-0.02em'
            }}>
              Powerful Features
            </h2>
            <p style={{
              fontSize: '1.1rem',
              color: 'var(--text-secondary)',
              maxWidth: '600px',
              margin: '0 auto'
            }}>
              Everything you need to manage resources efficiently
            </p>
        </div>

          {/* Features Grid */}
        <div style={{
          display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '32px'
        }}>
          <div style={{
              background: 'var(--surface)',
              padding: '40px 32px',
              borderRadius: '16px',
              border: '1px solid var(--border)',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)'
              e.currentTarget.style.boxShadow = '0 16px 40px rgba(37, 99, 235, 0.15)'
              e.currentTarget.style.borderColor = 'var(--accent-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
            >
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                transform: 'scaleX(0)',
                transition: 'transform 0.4s ease',
                transformOrigin: 'left'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scaleX(1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scaleX(0)'
              }}
              />
              <div style={{ 
                color: 'var(--accent-primary)', 
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'center',
                transition: 'transform 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1) rotate(5deg)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1) rotate(0)'
              }}
              >
                <CalendarIcon />
              </div>
              <h3 style={{ 
                fontSize: '1.4rem', 
                fontWeight: '700', 
                marginBottom: '12px',
                color: 'var(--text-primary)'
              }}>
                Visual Calendar
              </h3>
              <p style={{ 
                color: 'var(--text-secondary)', 
                lineHeight: '1.7',
                fontSize: '1rem'
              }}>
                Multi-month calendar view with drag-and-drop booking management. 
                See your entire schedule at a glance.
              </p>
            </div>

            <div style={{
              background: 'var(--surface)',
              padding: '40px 32px',
              borderRadius: '16px',
              border: '1px solid var(--border)',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)'
              e.currentTarget.style.boxShadow = '0 16px 40px rgba(37, 99, 235, 0.15)'
              e.currentTarget.style.borderColor = 'var(--accent-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
            >
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                transform: 'scaleX(0)',
                transition: 'transform 0.4s ease',
                transformOrigin: 'left'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scaleX(1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scaleX(0)'
              }}
              />
              <div style={{ 
                color: 'var(--accent-primary)', 
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'center',
                transition: 'transform 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1) rotate(-5deg)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1) rotate(0)'
              }}
              >
                <DragDropIcon />
              </div>
              <h3 style={{ 
                fontSize: '1.4rem', 
                fontWeight: '700', 
                marginBottom: '12px',
                color: 'var(--text-primary)'
              }}>
                Drag & Drop
              </h3>
              <p style={{ 
                color: 'var(--text-secondary)', 
                lineHeight: '1.7',
                fontSize: '1rem'
              }}>
                Create, move, resize, and duplicate bookings with intuitive drag-and-drop. 
                Move bookings between resources seamlessly.
              </p>
            </div>

            <div style={{
              background: 'var(--surface)',
              padding: '40px 32px',
              borderRadius: '16px',
              border: '1px solid var(--border)',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)'
              e.currentTarget.style.boxShadow = '0 16px 40px rgba(37, 99, 235, 0.15)'
              e.currentTarget.style.borderColor = 'var(--accent-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
            >
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                transform: 'scaleX(0)',
                transition: 'transform 0.4s ease',
                transformOrigin: 'left'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scaleX(1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scaleX(0)'
              }}
              />
              <div style={{ 
                color: 'var(--accent-primary)', 
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'center',
                transition: 'transform 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1) rotate(5deg)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1) rotate(0)'
              }}
              >
                <ResourceIcon />
              </div>
              <h3 style={{ 
                fontSize: '1.4rem', 
                fontWeight: '700', 
                marginBottom: '12px',
                color: 'var(--text-primary)'
              }}>
                Resource Management
              </h3>
              <p style={{ 
                color: 'var(--text-secondary)', 
                lineHeight: '1.7',
                fontSize: '1rem'
              }}>
                Manage people, equipment, and rooms. Organize by department, 
                set capacity, and track availability.
              </p>
            </div>

            <div style={{
              background: 'var(--surface)',
              padding: '40px 32px',
            borderRadius: '16px',
              border: '1px solid var(--border)',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)'
              e.currentTarget.style.boxShadow = '0 16px 40px rgba(37, 99, 235, 0.15)'
              e.currentTarget.style.borderColor = 'var(--accent-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
            >
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                transform: 'scaleX(0)',
                transition: 'transform 0.4s ease',
                transformOrigin: 'left'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scaleX(1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scaleX(0)'
              }}
              />
              <div style={{ 
                color: 'var(--accent-primary)', 
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'center',
            transition: 'transform 0.3s ease'
          }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1) rotate(-5deg)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1) rotate(0)'
              }}
              >
                <ProjectIcon />
              </div>
              <h3 style={{ 
                fontSize: '1.4rem', 
                fontWeight: '700', 
                marginBottom: '12px',
                color: 'var(--text-primary)'
              }}>
                Project Tracking
              </h3>
              <p style={{ 
                color: 'var(--text-secondary)', 
                lineHeight: '1.7',
                fontSize: '1rem'
              }}>
                Organize bookings by project with color coding. Track project status, 
                budgets, and client information.
            </p>
          </div>

          <div style={{
              background: 'var(--surface)',
              padding: '40px 32px',
            borderRadius: '16px',
              border: '1px solid var(--border)',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)'
              e.currentTarget.style.boxShadow = '0 16px 40px rgba(37, 99, 235, 0.15)'
              e.currentTarget.style.borderColor = 'var(--accent-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
            >
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                transform: 'scaleX(0)',
                transition: 'transform 0.4s ease',
                transformOrigin: 'left'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scaleX(1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scaleX(0)'
              }}
              />
              <div style={{ 
                color: 'var(--accent-primary)', 
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'center',
            transition: 'transform 0.3s ease'
          }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1) rotate(5deg)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1) rotate(0)'
              }}
              >
                <PriorityIcon />
              </div>
              <h3 style={{ 
                fontSize: '1.4rem', 
                fontWeight: '700', 
                marginBottom: '12px',
                color: 'var(--text-primary)'
              }}>
                Priority System
              </h3>
              <p style={{ 
                color: 'var(--text-secondary)', 
                lineHeight: '1.7',
                fontSize: '1rem'
              }}>
                Color-coded priority levels (low, normal, high, urgent) help you 
                quickly identify critical bookings and time-off requests.
            </p>
          </div>

          <div style={{
              background: 'var(--surface)',
              padding: '40px 32px',
            borderRadius: '16px',
              border: '1px solid var(--border)',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)'
              e.currentTarget.style.boxShadow = '0 16px 40px rgba(37, 99, 235, 0.15)'
              e.currentTarget.style.borderColor = 'var(--accent-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
            >
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                transform: 'scaleX(0)',
                transition: 'transform 0.4s ease',
                transformOrigin: 'left'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scaleX(1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scaleX(0)'
              }}
              />
              <div style={{ 
                color: 'var(--accent-primary)', 
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'center',
            transition: 'transform 0.3s ease'
          }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1) rotate(-5deg)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1) rotate(0)'
              }}
              >
                <DuplicateIcon />
              </div>
              <h3 style={{ 
                fontSize: '1.4rem', 
                fontWeight: '700', 
                marginBottom: '12px',
                color: 'var(--text-primary)'
              }}>
                Quick Actions
              </h3>
              <p style={{ 
                color: 'var(--text-secondary)', 
                lineHeight: '1.7',
                fontSize: '1rem'
              }}>
                Duplicate bookings with Shift+drag, resize by dragging edges, 
                and create repeat bookings for recurring schedules.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        padding: '60px 20px',
        background: 'var(--bg-tertiary)',
        borderTop: '1px solid var(--border)',
        textAlign: 'center'
      }}>
        <p style={{
          color: 'var(--text-tertiary)',
          fontSize: '0.95rem'
        }}>
          © 2025 Resource Scheduler. Visual scheduling for modern teams.
        </p>
      </div>

      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes float {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
          }
          33% {
            transform: translate(30px, -30px) rotate(120deg);
          }
          66% {
            transform: translate(-20px, 20px) rotate(240deg);
          }
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.05);
          }
        }
        
        @keyframes expand {
          from {
            width: 0;
            opacity: 0;
          }
          to {
            width: 60px;
            opacity: 1;
          }
        }
      `}</style>
    </div>
    </>
  )
}
