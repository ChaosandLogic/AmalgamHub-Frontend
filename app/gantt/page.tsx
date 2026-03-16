'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Header from '../components/Header'
import LoadingSpinner from '../components/LoadingSpinner'
import { useUser } from '../lib/hooks/useUser'
import GanttChart from './components/GanttChart'
import { useToast } from '../components/Toast'
import { getLocalDateString } from '../lib/utils/dateUtils'
import { useApiData } from '../lib/hooks/useApiData'

function GanttPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const toast = useToast()
  
  // Get last visited project from localStorage or URL param
  const getInitialProjectId = (): string | null => {
    // Priority: URL param > localStorage > null
    const urlProjectId = searchParams.get('projectId')
    if (urlProjectId) return urlProjectId
    
    try {
      return localStorage.getItem('gantt_lastProjectId')
    } catch (e) {
      console.error('Error reading from localStorage:', e)
      return null
    }
  }
  
  const [projectId, setProjectId] = useState<string | null>(getInitialProjectId())
  const [selectedProject, setSelectedProject] = useState<any | null>(null)
  const { user } = useUser()

  const { data: projectsData } = useApiData<any[]>('/api/projects', {
    transform: (raw: any) => raw?.projects ?? [],
  })
  const projects = projectsData ?? []

  const { data: usersData } = useApiData<any[]>('/api/users', {
    transform: (raw: any) => raw?.users ?? [],
  })
  const users = usersData ?? []
  
  // Store last visited project in localStorage
  const storeLastProjectId = (projId: string | null) => {
    try {
      if (projId) {
        localStorage.setItem('gantt_lastProjectId', projId)
      } else {
        localStorage.removeItem('gantt_lastProjectId')
      }
    } catch (e) {
      console.error('Error writing to localStorage:', e)
    }
  }
  
  // Get stored start date for a project from localStorage
  const getStoredStartDate = (projId: string | null): Date => {
    if (!projId) {
      const date = new Date()
      date.setDate(1)
      return date
    }
    
    try {
      const stored = localStorage.getItem(`gantt_startDate_${projId}`)
      if (stored) {
        const date = new Date(stored)
        if (!isNaN(date.getTime())) {
          return date
        }
      }
    } catch (e) {
      console.error('Error reading from localStorage:', e)
    }
    
    // Default to first of current month
    const date = new Date()
    date.setDate(1)
    return date
  }
  
  // Store start date for a project in localStorage
  const storeStartDate = (projId: string | null, date: Date) => {
    if (!projId) return
    
    try {
      localStorage.setItem(`gantt_startDate_${projId}`, date.toISOString())
    } catch (e) {
      console.error('Error writing to localStorage:', e)
    }
  }

  // Get stored created by for a project from localStorage
  const getStoredCreatedBy = (projId: string | null): string | null => {
    if (!projId) return null
    
    try {
      return localStorage.getItem(`gantt_createdBy_${projId}`)
    } catch (e) {
      console.error('Error reading from localStorage:', e)
      return null
    }
  }
  
  // Store created by for a project in localStorage
  const storeCreatedBy = (projId: string | null, userId: string | null) => {
    if (!projId) return
    
    try {
      if (userId) {
        localStorage.setItem(`gantt_createdBy_${projId}`, userId)
      } else {
        localStorage.removeItem(`gantt_createdBy_${projId}`)
      }
    } catch (e) {
      console.error('Error writing to localStorage:', e)
    }
  }
  
  const [createdBy, setCreatedBy] = useState<string | null>(() => {
    return getStoredCreatedBy(projectId)
  })
  
  const [monthStart, setMonthStart] = useState(() => {
    return getStoredStartDate(projectId)
  })

  // Update start date and created by when project changes
  useEffect(() => {
    setMonthStart(getStoredStartDate(projectId))
    setCreatedBy(getStoredCreatedBy(projectId))
  }, [projectId])

  // Handle start date change
  const handleStartDateChange = (dateString: string) => {
    const newDate = new Date(dateString)
    if (!isNaN(newDate.getTime())) {
      setMonthStart(newDate)
      storeStartDate(projectId, newDate)
    }
  }

  // Sync selectedProject and URL when projects load or projectId changes
  useEffect(() => {
    if (!projects.length) return
    if (projectId) {
      const project = projects.find((p: any) => p.id === projectId)
      if (project) {
        setSelectedProject(project)
        if (!searchParams.get('projectId')) router.push(`/gantt?projectId=${projectId}`)
      } else {
        setProjectId(null)
        storeLastProjectId(null)
      }
    }
  }, [projects, projectId, searchParams, router])

  // Update URL when project changes
  const handleProjectChange = (newProjectId: string | null) => {
    setProjectId(newProjectId)
    storeLastProjectId(newProjectId) // Save to localStorage
    if (newProjectId) {
      router.push(`/gantt?projectId=${newProjectId}`)
      const project = projects.find(p => p.id === newProjectId)
      setSelectedProject(project || null)
    } else {
      router.push('/gantt')
      setSelectedProject(null)
    }
  }
  
  // Save projectId to localStorage whenever it changes (including from URL)
  useEffect(() => {
    if (projectId) {
      storeLastProjectId(projectId)
    }
  }, [projectId])

  // Export Gantt chart to PDF
  const handleExportPDF = async () => {
    if (!projectId) {
      toast.error('Please select a project first')
      return
    }

    try {
      // Dynamically import html2canvas and jsPDF
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')

      // Find the Gantt chart container
      const ganttContainer = document.querySelector('[data-gantt-chart]') as HTMLElement
      if (!ganttContainer) {
        toast.error('Could not find Gantt chart to export')
        return
      }

      toast.success('Generating PDF...')

      // Capture the Gantt chart as canvas
      const canvas = await html2canvas(ganttContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      })

      const imgData = canvas.toDataURL('image/png')
      
      // Calculate PDF dimensions
      const imgWidth = canvas.width
      const imgHeight = canvas.height
      const pdfWidth = 210 // A4 width in mm
      const pdfHeight = (imgHeight * pdfWidth) / imgWidth
      
      // Create PDF
      const pdf = new jsPDF('landscape', 'mm', 'a4')
      
      // Add image to PDF
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
      
      // Generate filename
      const projectName = selectedProject?.name || 'Gantt'
      const dateStr = new Date().toISOString().split('T')[0]
      const filename = `Gantt_${projectName}_${dateStr}.pdf`
      
      // Save PDF
      pdf.save(filename)
      toast.success('PDF exported successfully!')
    } catch (error: unknown) {
      console.error('Error exporting PDF:', error)
      toast.error((error instanceof Error ? error.message : String(error)) || 'Failed to export PDF. Please ensure html2canvas and jspdf are installed.')
    }
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
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>
          Gantt Chart
        </h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {(() => {
            const canEditGantt = user?.role === 'admin' || user?.role === 'booker'
            return (
              <>
                {canEditGantt && projectId && (
                  <>
                    <button
                      onClick={() => {
                        const event = new CustomEvent('gantt:new-task')
                        window.dispatchEvent(event)
                      }}
                      style={{
                        padding: '8px 16px',
                        background: 'var(--accent-primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 14,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
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
                      <span>+</span> New Task
                    </button>
                    <button
                      onClick={handleExportPDF}
                      style={{
                        padding: '8px 16px',
                        background: 'var(--surface)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 14,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg-secondary)'
                        e.currentTarget.style.borderColor = 'var(--border-strong)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--surface)'
                        e.currentTarget.style.borderColor = 'var(--border)'
                      }}
                    >
                      <span>📄</span> Export PDF
                    </button>
                  </>
                )}
                {canEditGantt && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>
                      Start Date:
                    </label>
                    <input
                      type="date"
                      value={getLocalDateString(monthStart)}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        fontSize: 14,
                        background: 'var(--surface)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer'
                      }}
                    />
                  </div>
                )}
              </>
            )
          })()}

          {/* Project selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>
              Project:
            </label>
            <select
              value={projectId || ''}
              onChange={(e) => handleProjectChange(e.target.value || null)}
              style={{
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: 14,
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                minWidth: 200
              }}
            >
              <option value="">Select a project...</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.code ? `${project.code} - ${project.name}` : project.name}
                </option>
              ))}
            </select>
          </div>

          {/* Created By reference field */}
          {projectId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>
                Created By:
              </label>
              <select
                value={createdBy || ''}
                onChange={(e) => {
                  const newValue = e.target.value || null
                  setCreatedBy(newValue)
                  storeCreatedBy(projectId, newValue)
                }}
                style={{
                  padding: '8px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  fontSize: 14,
                  background: 'var(--surface)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  minWidth: 150
                }}
              >
                <option value="">Not set</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
      
      {/* Gantt chart */}
      {projectId ? (
        <div style={{ 
          flex: 1, 
          overflow: 'hidden',
          background: 'var(--bg-secondary)',
          padding: 16
        }}>
          <div style={{
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            background: 'var(--surface)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
            height: '100%'
          }}>
            <GanttChart
              monthStart={monthStart}
              projectId={projectId}
              onTaskCreated={() => {
                // Refresh if needed
              }}
            />
          </div>
        </div>
      ) : (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          fontSize: 14,
          background: 'var(--bg-secondary)',
          padding: 16
        }}>
          <div style={{
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 48,
            background: 'var(--surface)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
            textAlign: 'center'
          }}>
            Please select a project to view the Gantt chart
          </div>
        </div>
      )}
    </div>
  )
}

export default function GanttPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <Header />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'var(--bg-secondary)' }}>
          <LoadingSpinner size={32} />
          <span style={{ color: 'var(--text-secondary)' }}>Loading...</span>
        </div>
      </div>
    }>
      <GanttPageContent />
    </Suspense>
  )
}

