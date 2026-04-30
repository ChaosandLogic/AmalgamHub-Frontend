'use client'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import Header from '../components/Header'
import LoadingSpinner from '../components/LoadingSpinner'
import { useUser } from '../lib/hooks/useUser'
import GanttChart from './components/GanttChart'
import { useToast } from '../components/Toast'
import { getLocalDateString, normalizeToMidnight, parseLocalDateString } from '../lib/utils/dateUtils'
import { useApiData } from '../lib/hooks/useApiData'
import SearchableProjectDropdown from '../timesheet/components/SearchableProjectDropdown'
import { apiGet } from '../lib/api/client'
import { DAY_COLUMN_WIDTH, MONTHS_TO_DISPLAY } from '../lib/constants/gantt'
import type { GanttTask } from '../lib/types/gantt'

const GANTT_EXPORT_CAPTURE_SCALE = 2

function ganttExportTotalDays(monthStart: Date): number {
  const endDate = new Date(monthStart)
  endDate.setMonth(endDate.getMonth() + MONTHS_TO_DISPLAY)
  return Math.ceil((endDate.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24))
}

/** Latest task end day index relative to chart monthStart (inclusive). */
function lastTaskDayIndex(monthStart: Date, tasks: GanttTask[], totalDays: number): number | null {
  if (!tasks.length) return null
  const ms = normalizeToMidnight(new Date(monthStart))
  let maxD = 0
  for (const t of tasks) {
    const e = normalizeToMidnight(parseLocalDateString(t.end_date))
    const ei = Math.floor((e.getTime() - ms.getTime()) / (1000 * 60 * 60 * 24))
    maxD = Math.max(maxD, ei)
  }
  return Math.max(0, Math.min(maxD, totalDays - 1))
}

function cropCanvasToCssWidth(source: HTMLCanvasElement, cropWidthCss: number, scale: number): HTMLCanvasElement {
  const cropW = Math.min(source.width, Math.max(1, Math.round(cropWidthCss * scale)))
  if (cropW >= source.width) return source
  const out = document.createElement('canvas')
  out.width = cropW
  out.height = source.height
  const ctx = out.getContext('2d')
  if (!ctx) return source
  ctx.drawImage(source, 0, 0, cropW, source.height, 0, 0, cropW, source.height)
  return out
}

function GanttPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const toast = useToast()
  
  // Get last visited project from localStorage or URL param
  const getInitialProjectId = (): string | null => {
    // Priority: URL param > localStorage > null
    const urlProjectId = searchParams.get('projectId')
    if (urlProjectId) return urlProjectId
    
    if (typeof window === 'undefined') return null
    
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
  const projects = useMemo(() => projectsData ?? [], [projectsData])

  const { data: usersData } = useApiData<any[]>('/api/users', {
    transform: (raw: any) => raw?.users ?? [],
  })
  const users = useMemo(() => usersData ?? [], [usersData])
  
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
    
    if (typeof window === 'undefined') {
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
    
    if (typeof window === 'undefined') return null

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

  // Sync selectedProject and URL when projects load or projectId changes.
  // Guard with pathname so navigating away from /gantt doesn't trigger a
  // router.replace back here while the component is still mounted.
  useEffect(() => {
    if (pathname !== '/gantt') return
    if (!projects.length) return
    if (projectId) {
      const project = projects.find((p: any) => p.id === projectId)
      if (project) {
        setSelectedProject(project)
        if (!searchParams.get('projectId')) router.replace(`/gantt?projectId=${projectId}`)
      } else {
        setProjectId(null)
        storeLastProjectId(null)
      }
    }
  }, [pathname, projects, projectId, searchParams, router])

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

  // Export Gantt chart to PDF (capture full grid, then trim timeline after last task end date)
  const handleExportPDF = async () => {
    if (!projectId) {
      toast.error('Please select a project first')
      return
    }

    const restoreFns: (() => void)[] = []
    const stash = (restore: () => void) => {
      restoreFns.push(restore)
    }

    const setProp = (el: HTMLElement | null, prop: string, val: string) => {
      if (!el) return
      const prev = el.style.getPropertyValue(prop)
      el.style.setProperty(prop, val)
      stash(() => {
        if (prev) el.style.setProperty(prop, prev)
        else el.style.removeProperty(prop)
      })
    }

    try {
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')

      const chartRoot = document.querySelector('[data-gantt-chart]') as HTMLElement | null
      const layoutRoot = document.querySelector('[data-gantt-export-layout-root]') as HTMLElement | null
      const outer = document.querySelector('[data-gantt-export-outer]') as HTMLElement | null
      const shell = document.querySelector('[data-gantt-export-shell]') as HTMLElement | null
      const chartBody = chartRoot?.querySelector('[data-gantt-chart-body]') as HTMLElement | null
      const taskColumn = chartRoot?.querySelector('[data-gantt-task-column]') as HTMLElement | null
      const taskScroll = chartRoot?.querySelector('[data-gantt-task-scroll]') as HTMLElement | null
      const timelineScroll = chartRoot?.querySelector('[data-gantt-timeline-scroll]') as HTMLElement | null

      if (!chartRoot || !chartBody || !taskScroll || !timelineScroll || !taskColumn) {
        toast.error('Could not find Gantt chart to export')
        return
      }

      const exportTotalDays = ganttExportTotalDays(monthStart)
      const exportTasksPayload = await apiGet<{ tasks: GanttTask[] }>(
        `/api/gantt/tasks?${new URLSearchParams({ projectId }).toString()}`,
        { defaultErrorMessage: 'Failed to load tasks for export' }
      )
      const exportTasks = exportTasksPayload.tasks ?? []
      const lastDayIdx = lastTaskDayIndex(monthStart, exportTasks, exportTotalDays)

      const savedTaskTop = taskScroll.scrollTop
      const savedTimelineTop = timelineScroll.scrollTop
      const savedTimelineLeft = timelineScroll.scrollLeft
      stash(() => {
        taskScroll.scrollTop = savedTaskTop
        timelineScroll.scrollTop = savedTimelineTop
        timelineScroll.scrollLeft = savedTimelineLeft
      })

      taskScroll.scrollTop = 0
      timelineScroll.scrollTop = 0
      timelineScroll.scrollLeft = 0

      // Page column uses 100vh + overflow:hidden — content taller/wider than viewport is clipped for
      // layout *and* html2canvas's clone iframe defaults to innerWidth×innerHeight unless overridden.
      if (layoutRoot) {
        setProp(layoutRoot, 'overflow', 'visible')
        setProp(layoutRoot, 'height', 'auto')
        setProp(layoutRoot, 'min-height', '100vh')
      }

      for (const w of [outer, shell]) {
        if (!w) continue
        setProp(w, 'overflow', 'visible')
        setProp(w, 'height', 'auto')
        setProp(w, 'max-height', 'none')
        setProp(w, 'flex', '0 0 auto')
      }

      setProp(chartRoot, 'overflow', 'visible')
      setProp(chartRoot, 'flex', 'none')
      setProp(chartRoot, 'height', 'auto')
      setProp(chartRoot, 'min-height', '0')

      setProp(chartBody, 'overflow', 'visible')
      setProp(chartBody, 'flex', 'none')
      setProp(chartBody, 'height', 'auto')
      setProp(chartBody, 'min-height', '0')

      setProp(taskColumn, 'overflow', 'visible')
      setProp(taskColumn, 'height', 'auto')

      setProp(taskScroll, 'overflow', 'visible')
      setProp(taskScroll, 'flex', 'none')

      setProp(timelineScroll, 'overflow', 'visible')
      setProp(timelineScroll, 'flex', 'none')

      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )

      const taskH = taskScroll.scrollHeight
      const tw = timelineScroll.scrollWidth
      const th = timelineScroll.scrollHeight

      setProp(taskScroll, 'height', `${taskH}px`)
      setProp(timelineScroll, 'width', `${tw}px`)
      setProp(timelineScroll, 'height', `${th}px`)

      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )

      // html2canvas clones into an iframe sized to windowWidth×windowHeight (defaults: viewport).
      // Without explicit dimensions, wide timelines / tall task lists are cropped.
      const captureW = Math.ceil(
        Math.max(
          chartRoot.scrollWidth,
          chartBody.scrollWidth,
          (taskColumn?.offsetWidth ?? 0) + timelineScroll.scrollWidth,
          1
        )
      )
      const captureH = Math.ceil(
        Math.max(
          chartRoot.scrollHeight,
          chartBody.scrollHeight,
          taskColumn?.scrollHeight ?? 0,
          timelineScroll.scrollHeight ?? 0,
          1
        )
      )

      let cropWidthCss = captureW
      if (lastDayIdx !== null && exportTasks.length > 0) {
        const rootRect = chartRoot.getBoundingClientRect()
        const tcRect = taskColumn.getBoundingClientRect()
        const timelineLeftInRoot = Math.max(0, tcRect.right - rootRect.left)
        cropWidthCss = Math.min(
          captureW,
          Math.ceil(timelineLeftInRoot + (lastDayIdx + 1) * DAY_COLUMN_WIDTH)
        )
      }

      toast.success('Generating PDF...')

      let canvas = await html2canvas(chartRoot, {
        scale: GANTT_EXPORT_CAPTURE_SCALE,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: captureW,
        height: captureH,
        windowWidth: captureW,
        windowHeight: captureH,
      })

      restoreFns.reverse().forEach((fn) => fn())

      if (lastDayIdx !== null && exportTasks.length > 0) {
        canvas = cropCanvasToCssWidth(canvas, cropWidthCss, GANTT_EXPORT_CAPTURE_SCALE)
      }

      const imgData = canvas.toDataURL('image/png')

      const pdf = new jsPDF('landscape', 'mm', 'a4')
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const margin = 8
      const maxW = pageW - margin * 2
      const maxH = pageH - margin * 2
      const imgRatio = canvas.width / canvas.height
      let drawW = maxW
      let drawH = drawW / imgRatio
      if (drawH > maxH) {
        drawH = maxH
        drawW = drawH * imgRatio
      }
      const offsetX = margin + (maxW - drawW) / 2
      const offsetY = margin + (maxH - drawH) / 2

      pdf.addImage(imgData, 'PNG', offsetX, offsetY, drawW, drawH)

      const projectName = selectedProject?.name || 'Gantt'
      const dateStr = new Date().toISOString().split('T')[0]
      pdf.save(`Gantt_${projectName}_${dateStr}.pdf`)

      toast.success('PDF exported successfully!')
    } catch (error: unknown) {
      restoreFns.reverse().forEach((fn) => fn())
      console.error('Error exporting PDF:', error)
      toast.error((error instanceof Error ? error.message : String(error)) || 'Failed to export PDF. Please ensure html2canvas and jspdf are installed.')
    }
  }


  return (
    <div
      data-gantt-export-layout-root
      style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}
    >
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <label style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500, flexShrink: 0 }}>
              Project:
            </label>
            <SearchableProjectDropdown
              value={projectId || ''}
              onChange={(id) => handleProjectChange(id || null)}
              projects={projects}
              placeholder="Search projects..."
              valueMode="id"
              requireJobCode={false}
              allowClear
              style={{ flex: '0 1 auto', minWidth: 220, maxWidth: 360 }}
            />
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
        <div
          data-gantt-export-outer
          style={{ 
          flex: 1, 
          overflow: 'hidden',
          background: 'var(--bg-secondary)',
          padding: 16
        }}
        >
          <div
            data-gantt-export-shell
            style={{
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            background: 'var(--surface)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
            height: '100%'
          }}
          >
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

