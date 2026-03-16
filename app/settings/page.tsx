'use client'

import { useState } from 'react'
import Header from '../components/Header'
import LoadingSpinner from '../components/LoadingSpinner'
import { useUser } from '../lib/hooks/useUser'
import SettingsAccount from './components/SettingsAccount'
import SettingsAdmin from './components/SettingsAdmin'
import SettingsHistory from './components/SettingsHistory'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'account' | 'history' | 'admin'>('account')
  const { user, loading } = useUser()

  const isAdmin = user?.role === 'admin'
  const isBooker = user?.role === 'booker'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Header />
      <div style={{
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)'
      }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>Settings</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {/* Tab selector */}
          <div
            style={{
              display: 'inline-flex',
              borderRadius: 999,
              border: '1px solid var(--border)',
              padding: 4,
              background: 'var(--surface)',
              gap: 4
            }}
          >
            <button
              onClick={() => setActiveTab('account')}
              style={{
                border: 'none',
                borderRadius: 999,
                padding: '6px 14px',
                fontSize: 13,
                cursor: 'pointer',
                background: activeTab === 'account' ? 'var(--surface)' : 'transparent',
                color: activeTab === 'account' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'account' ? 600 : 500
              }}
            >
              Account
            </button>
            <button
              onClick={() => setActiveTab('history')}
              style={{
                border: 'none',
                borderRadius: 999,
                padding: '6px 14px',
                fontSize: 13,
                cursor: 'pointer',
                background: activeTab === 'history' ? 'var(--surface)' : 'transparent',
                color: activeTab === 'history' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'history' ? 600 : 500
              }}
            >
              History
            </button>
            {isAdmin && !isBooker && (
              <button
                onClick={() => setActiveTab('admin')}
                style={{
                  border: 'none',
                  borderRadius: 999,
                  padding: '6px 14px',
                  fontSize: 13,
                  cursor: 'pointer',
                  background: activeTab === 'admin' ? 'var(--surface)' : 'transparent',
                  color: activeTab === 'admin' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontWeight: activeTab === 'admin' ? 600 : 500
                }}
              >
                Admin
              </button>
            )}
          </div>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16, background: 'var(--bg-secondary)' }}>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 24,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                <LoadingSpinner />
              </div>
            ) : activeTab === 'account' ? <SettingsAccount /> : activeTab === 'history' ? <SettingsHistory /> : (isAdmin && !isBooker) ? <SettingsAdmin /> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
