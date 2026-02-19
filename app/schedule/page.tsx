'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '../components/Header'
import ResourceSchedule from './ResourceSchedule'
import { normalizeToMidnight } from '../lib/utils/dateUtils'

export default function SchedulePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [resources, setResources] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [monthStart, setMonthStart] = useState(() => {
    const date = new Date()
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
    return normalizeToMidnight(firstDay)
  })

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/user', { credentials: 'include' })
      if (r.status === 401) {
        router.replace('/login')
        return
      }
      const response = await r.json()
      setUser(response.data?.user || response.user)
    })()
  }, [router])

  useEffect(() => {
    loadResources()
    loadProjects()
  }, [])

  const sampleResources = [
    {
      id: 'resource-sample-1',
      name: 'Alice Johnson',
      type: 'person',
      color: '#ec4899'
    },
    {
      id: 'resource-sample-2',
      name: 'Ben Carter',
      type: 'person',
      color: '#22c55e'
    },
    {
      id: 'resource-sample-3',
      name: 'Design Team',
      type: 'team',
      color: '#6366f1'
    },
    {
      id: 'resource-sample-4',
      name: 'Company Van',
      type: 'vehicle',
      color: '#f59e0b'
    },
    {
      id: 'resource-sample-5',
      name: 'Camera Equipment',
      type: 'equipment',
      color: '#8b5cf6'
    },
    {
      id: 'resource-sample-6',
      name: 'Conference Room A',
      type: 'room',
      color: '#14b8a6'
    }
  ]

  async function loadResources() {
    try {
      const res = await fetch('/api/resources', { credentials: 'include' })
      if (res.ok) {
        const response = await res.json()
        const apiResources = response.data?.resources || response.resources || []
        // If no resources exist yet, fall back to some sample resources
        setResources(apiResources.length > 0 ? apiResources : sampleResources)
      } else {
        // On error, still show sample resources so the schedule is usable
        setResources(sampleResources)
      }
    } catch (error) {
      console.error('Error loading resources:', error)
      setResources(sampleResources)
    }
  }

  async function loadProjects() {
    try {
      const res = await fetch('/api/projects', { credentials: 'include' })
      if (res.ok) {
        const response = await res.json()
        const data = response.data || response
        setProjects(data.projects || [])
      }
    } catch (error) {
      console.error('Error loading projects:', error)
    }
  }

  function formatDateInput(d: Date) {
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  }

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
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Resource Schedule</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            type="month"
            value={`${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`}
            onChange={e => {
              const [year, month] = e.target.value.split('-').map(Number)
              const firstDay = new Date(year, month - 1, 1)
              setMonthStart(normalizeToMidnight(firstDay))
            }}
            style={{
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 14
            }}
          />
          {(user?.role === 'admin' || user?.role === 'booker') && (
            <>
              <button
                onClick={() => router.push('/resources')}
                style={{
                  padding: '8px 16px',
                  background: 'var(--accent-primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--accent-primary-hover)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(var(--accent-primary-rgb), 0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--accent-primary)'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                Manage Resources
              </button>
              <button
                onClick={() => router.push('/projects')}
                style={{
                  padding: '8px 16px',
                  background: 'var(--success)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--success-hover)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(5, 150, 105, 0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--success)'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                Manage Projects
              </button>
            </>
          )}
        </div>
      </div>

      {resources.length === 0 ? (
        <div style={{ 
          padding: 48, 
          textAlign: 'center', 
          background: 'var(--bg-secondary)', 
          margin: 16,
          borderRadius: 12,
          border: '1px dashed var(--border)'
        }}>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 16 }}>
            No resources found.
            {(user?.role === 'admin' || user?.role === 'booker') ? (
              <> <a href="/resources" style={{ color: 'var(--accent-primary)' }}>Add your first resource</a> to get started.</>
            ) : (
              <> Contact an administrator or booker to add resources.</>
            )}
          </p>
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <ResourceSchedule
            monthStart={monthStart}
            resources={resources}
            projects={projects}
          />
        </div>
      )}
    </div>
  )
}
