'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Header from '../components/Header'
import { useToast } from '../components/Toast'
import { Search, RefreshCw } from 'lucide-react'
import ConfirmDialog from '../components/ConfirmDialog'

export default function ProjectsPage() {
  const router = useRouter()
  const toast = useToast()
  const [projects, setProjects] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [editingProject, setEditingProject] = useState<any>(null)
  const [user, setUser] = useState<{ role: string } | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [dataSource, setDataSource] = useState<string>('')
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    clientName: '',
    status: 'active',
    startDate: '',
    endDate: '',
    budget: '',
    budgetType: 'hours',
    color: '#059669' // Default to success color hex value (matches --success CSS variable)
  })

  useEffect(() => {
    loadUser()
    loadProjects()
  }, [])

  async function loadUser() {
    try {
      const res = await fetch('/api/user', { credentials: 'include' })
      if (res.ok) {
        const response = await res.json()
        setUser(response.data?.user || response.user)
      }
    } catch (error) {
      console.error('Error loading user:', error)
    }
  }

  async function loadProjects(forceRefresh = false) {
    setIsLoading(true)
    try {
      const url = forceRefresh ? '/api/projects?refresh=true' : '/api/projects'
      const res = await fetch(url, { credentials: 'include' })
      if (res.ok) {
        const response = await res.json()
        const data = response.data || response
        console.log('Projects loaded:', data.projects?.length || 0, 'projects from', data.source || 'unknown')
        setProjects(data.projects || [])
        setDataSource(data.source || '')
        if (forceRefresh) {
          const source = data.source === 'filemaker' ? 'FileMaker' : 'SQLite'
          toast.success(`Loaded ${data.projects?.length || 0} projects from ${source}`)
        }
      } else {
        const errorData = await res.json().catch(() => ({}))
        console.error('Error loading projects:', res.status, errorData)
        toast.error('Failed to load projects')
      }
    } catch (error) {
      console.error('Error loading projects:', error)
      toast.error('Failed to load projects')
    } finally {
      setIsLoading(false)
    }
  }

  async function saveProject() {
    try {
      const url = editingProject 
        ? `/api/projects/${editingProject.id}`
        : '/api/projects'
      const method = editingProject ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name,
          code: formData.code,
          clientName: formData.clientName,
          status: formData.status,
          startDate: formData.startDate || null,
          endDate: formData.endDate || null,
          budget: formData.budget ? parseFloat(formData.budget) : null,
          budgetType: formData.budgetType,
          color: formData.color
        })
      })
      
      if (response.ok) {
        await loadProjects()
        setShowDialog(false)
        setEditingProject(null)
        setFormData({
          name: '',
          code: '',
          clientName: '',
          status: 'active',
          startDate: '',
          endDate: '',
          budget: '',
          budgetType: 'hours',
          color: '#059669' // Default to success color hex value
        })
        toast.success(editingProject ? 'Project updated' : 'Project created')
      } else {
        throw new Error('Failed to save project')
      }
    } catch (error) {
      console.error('Error saving project:', error)
      toast.error('Failed to save project')
    }
  }

  function handleDeleteClick(project: any) {
    setProjectToDelete(project)
    setShowDeleteConfirm(true)
  }

  async function deleteProject() {
    if (!projectToDelete) return
    
    try {
      const response = await fetch(`/api/projects/${projectToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      
      if (response.ok) {
        await loadProjects()
        toast.success('Project deleted')
        setShowDeleteConfirm(false)
        setProjectToDelete(null)
      } else {
        throw new Error('Failed to delete project')
      }
    } catch (error) {
      console.error('Error deleting project:', error)
      toast.error('Failed to delete project')
    }
  }

  function openEditDialog(project: any) {
    setEditingProject(project)
    setFormData({
      name: project.name,
      code: project.code || '',
      clientName: project.client_name || '',
      status: project.status || 'active',
      startDate: project.start_date ? project.start_date.substring(0, 10) : '',
      endDate: project.end_date ? project.end_date.substring(0, 10) : '',
      budget: project.budget ? String(project.budget) : '',
      budgetType: project.budget_type || 'hours',
      color: project.color || '#10b981'
    })
    setShowDialog(true)
  }

  // Unique department / prefix values (Job Header::Dept)
  const deptOptions = useMemo(() => {
    const set = new Set<string>()
    projects.forEach(p => {
      const dept = (p.dept || '').toString().trim()
      if (dept) set.add(dept)
    })
    return Array.from(set).sort()
  }, [projects])

  // Filter projects based on dept and search term
  const filteredProjects = useMemo(() => {
    let result = projects

    if (deptFilter) {
      const target = deptFilter.toLowerCase()
      result = result.filter(p =>
        ((p.dept || '').toString().trim().toLowerCase()) === target
      )
    }

    if (!searchTerm.trim()) return result

    const term = searchTerm.toLowerCase()
    return result.filter(p => {
      const name = (p.name || '').toString().toLowerCase()
      const code = (p.code || '').toString().toLowerCase()
      const client = (p.client_name || '').toString().toLowerCase()
      return name.includes(term) || code.includes(term) || client.includes(term)
    })
  }, [projects, deptFilter, searchTerm])

  // Group filtered projects by status
  const projectsByStatus = useMemo(() => {
    const grouped: { [key: string]: any[] } = {}
    
    filteredProjects.forEach(project => {
      const status = (project.status || 'active').toLowerCase()
      if (!grouped[status]) {
        grouped[status] = []
      }
      grouped[status].push(project)
    })
    
    // Sort projects within each status group by name
    Object.keys(grouped).forEach(status => {
      grouped[status].sort((a, b) => {
        const nameA = (a.name || '').toLowerCase()
        const nameB = (b.name || '').toLowerCase()
        return nameA.localeCompare(nameB)
      })
    })
    
    return grouped
  }, [filteredProjects])

  // Define status order: hunted, enquiry, inprogress, then the rest alphabetically
  const statusOrder = useMemo(() => {
    const statuses = Object.keys(projectsByStatus)
    const priorityStatuses = ['hunted', 'enquiry', 'inprogress']
    const sorted = statuses.sort((a, b) => {
      const aIndex = priorityStatuses.indexOf(a)
      const bIndex = priorityStatuses.indexOf(b)
      
      // If both are in priority list, sort by priority order
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
      // If only one is in priority list, it comes first
      if (aIndex !== -1) return -1
      if (bIndex !== -1) return 1
      // Otherwise sort alphabetically
      return a.localeCompare(b)
    })
    return sorted
  }, [projectsByStatus])

  // Get background color for status header
  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase()
    if (statusLower === 'hunted') return '#3b82f6' // Blue
    if (statusLower === 'enquiry') return '#eab308' // Yellow
    if (statusLower === 'inprogress' || statusLower === 'in progress') return '#f97316' // Orange
    return '#f97316' // Orange for all other statuses
  }

  // Helper function to format dates
  function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return ''
    try {
      // Handle different date formats (ISO string, DD/MM/YYYY, etc.)
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) {
        // If Date parsing fails, try to parse DD/MM/YYYY format
        if (typeof dateStr === 'string' && dateStr.includes('/')) {
          const [day, month, year] = dateStr.split('/')
          if (day && month && year) {
            const parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
            if (!isNaN(parsedDate.getTime())) {
              return parsedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
            }
          }
        }
        return dateStr // Return original if can't parse
      }
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch {
      return dateStr || ''
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
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>Projects</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>
            {filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'}
            {filteredProjects.length !== projects.length && ` of ${projects.length} total`}
            {dataSource && (
              <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>
                ({dataSource === 'filemaker' ? 'FileMaker' : 'SQLite'})
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', maxWidth: 520 }}>
            <div style={{ minWidth: 120 }}>
              <select
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 14,
                  background: 'var(--surface)',
                  color: 'var(--text-primary)'
                }}
              >
                <option value="">All depts</option>
                {deptOptions.map(dept => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search projects..."
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 40px',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 14,
                  background: 'var(--surface)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
            <button
              onClick={() => loadProjects(true)}
              disabled={isLoading}
              style={{
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 14,
                opacity: isLoading ? 0.6 : 1
              }}
              title="Refresh from FileMaker"
            >
              <RefreshCw 
                size={16} 
                style={{ 
                  animation: isLoading ? 'spin 1s linear infinite' : 'none',
                  transform: isLoading ? 'rotate(0deg)' : 'none'
                }} 
              />
              Refresh
            </button>
          </div>
          {(user?.role === 'admin' || user?.role === 'booker') && (
            <button
              onClick={() => {
                setEditingProject(null)
                setFormData({
                  name: '',
                  code: '',
                  clientName: '',
                  status: 'active',
                  startDate: '',
                  endDate: '',
                  budget: '',
                  budgetType: 'hours',
                  color: '#059669' // Default to success color hex value
                })
                setShowDialog(true)
              }}
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
              + Add Project
            </button>
          )}
        </div>
      </div>
      
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {statusOrder.map(status => {
            const statusProjects = projectsByStatus[status]
            if (statusProjects.length === 0) return null
            
            // Capitalize status for display
            const statusDisplay = status.charAt(0).toUpperCase() + status.slice(1)
            
            return (
              <div key={status} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 12,
                  padding: '12px 16px',
                  background: getStatusColor(status),
                  borderRadius: 8
                }}>
                  <h2 style={{ 
                    margin: 0, 
                    fontSize: 18, 
                    fontWeight: 600,
                    color: 'white'
                  }}>
                    {statusDisplay}
                  </h2>
                  <span style={{ 
                    fontSize: 14, 
                    color: 'white',
                    padding: '2px 8px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: 12,
                    fontWeight: 500
                  }}>
                    {statusProjects.length}
                  </span>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {statusProjects.map(project => (
                    <div
                      key={project.id}
                      style={{
                        padding: '10px 12px',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'var(--surface)'
                      }}
                    >
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: project.color || '#10b981'
                          }}
                        />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{project.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            {project.code && `${project.code} • `}
                            {project.client_name && `${project.client_name} • `}
                            {project.status}
                          </div>
                          {(project.startDate || project.deadline) && (
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                              {project.startDate && (
                                <span>Start: {formatDate(project.startDate)}</span>
                              )}
                              {project.startDate && project.deadline && <span> • </span>}
                              {project.deadline && (
                                <span>Deadline: {formatDate(project.deadline)}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      {(user?.role === 'admin' || user?.role === 'booker') && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => openEditDialog(project)}
                            style={{
                              padding: '4px 10px',
                              border: '1px solid var(--border)',
                              borderRadius: 6,
                              background: 'var(--surface)',
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                              fontSize: 12
                            }}
                          >
                            Edit
                          </button>
                          {/* Only show delete button for projects created in the app (not from FileMaker) */}
                          {project.id && String(project.id).startsWith('project-') && (
                            <button
                              onClick={() => handleDeleteClick(project)}
                              style={{
                                padding: '4px 10px',
                                border: '1px solid var(--error)',
                                borderRadius: 6,
                                background: 'var(--surface)',
                                color: 'var(--error)',
                                cursor: 'pointer',
                                fontSize: 12
                              }}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {projects.length === 0 && (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
            No projects yet. Click "Add Project" to get started.
          </div>
        )}
        {projects.length > 0 && filteredProjects.length === 0 && (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
            No projects match your search.
          </div>
        )}
      </div>

      {showDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--modal-backdrop)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50
          }}
          onClick={() => setShowDialog(false)}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 12,
              padding: 24,
              maxWidth: '500px',
              width: '90vw',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 20px 0' }}>
              {editingProject ? 'Edit Project' : 'Add Project'}
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 14
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
                  Code
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={e => setFormData({ ...formData, code: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 14
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
                  Client Name
                </label>
                <input
                  type="text"
                  value={formData.clientName}
                  onChange={e => setFormData({ ...formData, clientName: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 14
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 14
                  }}
                >
                  <option value="active">Active</option>
                  <option value="on-hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      fontSize: 14
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
                    End Date
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      fontSize: 14
                    }}
                  />
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
                    Budget
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.budget}
                    onChange={e => setFormData({ ...formData, budget: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      fontSize: 14
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
                    Type
                  </label>
                  <select
                    value={formData.budgetType}
                    onChange={e => setFormData({ ...formData, budgetType: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      fontSize: 14
                    }}
                  >
                    <option value="hours">Hours</option>
                    <option value="money">Money</option>
                    <option value="unlimited">Unlimited</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
                  Color
                </label>
                <input
                  type="color"
                  value={formData.color}
                  onChange={e => setFormData({ ...formData, color: e.target.value })}
                  style={{
                    width: '100%',
                    padding: 4,
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    height: 40
                  }}
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
              <button
                onClick={() => setShowDialog(false)}
                style={{
                  padding: '10px 20px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--surface)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveProject}
                disabled={!formData.name}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: 6,
                  background: formData.name ? 'var(--success)' : 'var(--text-tertiary)',
                  color: 'white',
                  cursor: formData.name ? 'pointer' : 'not-allowed'
                }}
              >
                {editingProject ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Project"
        message={`Are you sure you want to delete "${projectToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        onConfirm={deleteProject}
        onCancel={() => {
          setShowDeleteConfirm(false)
          setProjectToDelete(null)
        }}
      />
    </div>
  )
}
