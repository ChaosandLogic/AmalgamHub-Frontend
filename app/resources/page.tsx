'use client'
import { useEffect, useState } from 'react'
import Header from '../components/Header'
import { useToast } from '../components/Toast'
import { getResourceIcon, getResourceDefaultColor } from '../lib/utils/resourceUtils'
import ConfirmDialog from '../components/ConfirmDialog'
import { useUser } from '../lib/hooks/useUser'
import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api/client'

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
const DEFAULT_AVAILABILITY = { sun: 0, mon: 8, tue: 8, wed: 8, thu: 8, fri: 8, sat: 0 }

export default function ResourcesPage() {
  const toast = useToast()
  const { user } = useUser()
  const [resources, setResources] = useState<any[]>([])
  const [showDialog, setShowDialog] = useState(false)
  const [editingResource, setEditingResource] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    type: 'person',
    capacity: 1,
    color: getResourceDefaultColor('person'),
    department: '',
    job_role: '',
    availability: { ...DEFAULT_AVAILABILITY }
  })
  const colorSwatches: string[] = [
    'rgb(250,222,77)',
    'rgb(252,142,137)',
    'rgb(166,250,133)',
    'rgb(177,234,255)',
    'rgb(59,85,172)',    // matches --resource-person
    'rgb(53,148,196)',   // matches --resource-team
    'rgb(213,141,58)',   // matches --resource-vehicle
    'rgb(39,147,113)'    // matches --resource-equipment
  ]
  const [departments, setDepartments] = useState<string[]>([])
  const [jobRoles, setJobRoles] = useState<string[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<any>(null)

  useEffect(() => {
    loadResources()
    loadValueLists()
  }, [])

  async function loadValueLists() {
    try {
      const data = await apiGet<{ settings: any }>('/api/global-settings')
      const settings = data.settings
      const deptList = Array.isArray(settings?.department_list) 
        ? settings.department_list 
        : (settings?.department_list ? JSON.parse(settings.department_list) : [])
      const roleList = Array.isArray(settings?.job_role_list) 
        ? settings.job_role_list 
        : (settings?.job_role_list ? JSON.parse(settings.job_role_list) : [])
      setDepartments(deptList)
      setJobRoles(roleList)
    } catch (error) {
      console.error('Error loading value lists:', error)
    }
  }

  async function loadResources() {
    try {
      const data = await apiGet<{ resources: any[] }>('/api/resources')
      setResources(data.resources || [])
    } catch (error) {
      console.error('Error loading resources:', error)
    }
  }

  async function saveResource() {
    const body = {
      name: formData.name,
      email: formData.email || null,
      type: formData.type,
      capacity: formData.capacity,
      color: formData.color,
      department: formData.department || null,
      job_role: formData.job_role || null,
      availabilityTemplate: formData.availability
    }
    try {
      if (editingResource) {
        await apiPut(`/api/resources/${editingResource.id}`, body)
      } else {
        await apiPost('/api/resources', body)
      }
      await loadResources()
      setShowDialog(false)
      setEditingResource(null)
      setFormData({
        name: '',
        email: '',
        type: 'person',
        capacity: 1,
        color: getResourceDefaultColor('person'),
        department: '',
        job_role: '',
        availability: { ...DEFAULT_AVAILABILITY }
      })
      toast.success(editingResource ? 'Resource updated' : 'Resource created')
    } catch (error) {
      console.error('Error saving resource:', error)
      toast.error('Failed to save resource')
    }
  }

  function deleteResource(resource: any) {
    setShowDeleteConfirm(resource)
  }

  async function confirmDeleteResource() {
    if (!showDeleteConfirm) return
    try {
      await apiDelete(`/api/resources/${showDeleteConfirm.id}`)
      toast.success('Resource deleted successfully')
      setShowDeleteConfirm(null)
      loadResources()
    } catch (error: unknown) {
      toast.error((error instanceof Error ? error.message : String(error)) || 'Failed to delete resource')
    }
  }


  function openEditDialog(resource: any) {
    setEditingResource(resource)
    const avail = resource.availabilityTemplate
    const availability = avail && typeof avail === 'object'
      ? { ...DEFAULT_AVAILABILITY, ...avail }
      : { ...DEFAULT_AVAILABILITY }
    setFormData({
      name: resource.name,
      email: resource.email || '',
      type: resource.type,
      capacity: resource.capacity || 1,
      color: resource.color || getResourceDefaultColor(resource.type || 'person'),
      department: resource.department || '',
      job_role: resource.job_role || '',
      availability
    })
    setShowDialog(true)
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
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>Resources</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {(user?.role === 'admin' || user?.role === 'booker') && (
            <button
              onClick={() => {
                setEditingResource(null)
                setFormData({
                  name: '',
                  email: '',
                  type: 'person',
                  capacity: 1,
                  color: getResourceDefaultColor('person'),
                  department: '',
                  job_role: '',
                  availability: { ...DEFAULT_AVAILABILITY }
                })
                setShowDialog(true)
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
              + Add Resource
            </button>
          )}
        </div>
      </div>
      
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>

        {resources.length === 0 ? (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: 60,
            gap: 16
          }}>
            <div style={{ 
              fontSize: 64,
              lineHeight: 1,
              marginBottom: 8,
              opacity: 0.3
            }}>
              👥
            </div>
            <div style={{ 
              fontSize: 18, 
              fontWeight: 600,
              color: 'var(--text-primary)'
            }}>
              No resources yet
            </div>
            <div style={{ 
              fontSize: 14, 
              color: 'var(--text-secondary)',
              textAlign: 'center',
              maxWidth: 300
            }}>
              Add your first resource to get started
            </div>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 16
          }}>
            {resources.map(resource => (
            <div
              key={resource.id}
              className="resource-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer'
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: resource.color || getResourceDefaultColor(resource.type || 'person', true),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  flexShrink: 0
                }}
              >
                {getResourceIcon(resource.type || 'person', 32)}
              </div>
              <div style={{ textAlign: 'center', width: '100%' }}>
                <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>
                  {resource.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  {resource.type.charAt(0).toUpperCase() + resource.type.slice(1)}
                </div>
                {resource.department && (
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    {resource.department}
                  </div>
                )}
                {resource.job_role && (
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {resource.job_role}
                  </div>
                )}
              </div>
              {(user?.role === 'admin' || user?.role === 'booker') && (
                <div style={{ 
                  display: 'flex', 
                  gap: 8, 
                  width: '100%',
                  marginTop: 'auto',
                  paddingTop: 12,
                  borderTop: '1px solid var(--border)'
                }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      openEditDialog(resource)
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      background: 'var(--surface)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 500,
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--accent-primary)'
                      e.currentTarget.style.color = 'white'
                      e.currentTarget.style.borderColor = 'var(--accent-primary)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--surface)'
                      e.currentTarget.style.color = 'var(--text-primary)'
                      e.currentTarget.style.borderColor = 'var(--border)'
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteResource(resource)
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      border: '1px solid var(--error)',
                      borderRadius: 6,
                      background: 'var(--surface)',
                      color: 'var(--error)',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 500,
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--error)'
                      e.currentTarget.style.color = 'white'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--surface)'
                      e.currentTarget.style.color = 'var(--error)'
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
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
              overflowY: 'auto',
              border: '1px solid var(--border)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 20px 0' }}>
              {editingResource ? 'Edit Resource' : 'Add Resource'}
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
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="user@example.com"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 14
                  }}
                />
                <small style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, display: 'block' }}>
                  When a user registers with this email, their account will be linked to this resource
                </small>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
                  Type *
                </label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  {['person', 'vehicle', 'equipment', 'room'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData({ ...formData, type, color: getResourceDefaultColor(type) })}
                      style={{
                        flex: 1,
                        padding: '10px',
                        border: formData.type === type ? `2px solid ${formData.color}` : '2px solid var(--border)',
                        borderRadius: 8,
                        background: formData.type === type ? `${formData.color}15` : 'var(--surface)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 11,
                        fontWeight: formData.type === type ? 600 : 400,
                        color: formData.type === type ? formData.color : 'var(--text-secondary)',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span style={{ display: 'flex' }}>
                        {getResourceIcon(type, 24)}
                      </span>
                      <span>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
                  Capacity
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.capacity}
                  onChange={e => setFormData({ ...formData, capacity: parseInt(e.target.value) || 1 })}
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
                  Color
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  {colorSwatches.map(color => {
                    const isActive = formData.color === color
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData({ ...formData, color })}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '999px',
                          border: isActive ? '2px solid var(--text-primary)' : '2px solid transparent',
                          padding: 0,
                          cursor: 'pointer',
                          background: color,
                          boxShadow: isActive ? '0 0 0 2px var(--surface)' : '0 0 0 1px var(--border)'
                        }}
                        aria-label={`Set color ${color}`}
                      />
                    )
                  })}
                </div>
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
              
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
                  Department
                </label>
                <select
                  value={formData.department}
                  onChange={e => setFormData({ ...formData, department: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 14,
                    background: 'var(--surface)'
                  }}
                >
                  <option value="">Select department...</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
                  Job Role
                </label>
                <select
                  value={formData.job_role}
                  onChange={e => setFormData({ ...formData, job_role: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 14,
                    background: 'var(--surface)'
                  }}
                >
                  <option value="">Select job role...</option>
                  {jobRoles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
                  Availability (hours per day)
                </label>
                <small style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8, display: 'block' }}>
                  Set 0 for days they don&apos;t work. Unavailable days will be greyed out on the schedule.
                </small>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                  {DAY_KEYS.map(day => (
                    <div key={day} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                        {day === 'sun' ? 'Sun' : day === 'mon' ? 'Mon' : day === 'tue' ? 'Tue' : day === 'wed' ? 'Wed' : day === 'thu' ? 'Thu' : day === 'fri' ? 'Fri' : 'Sat'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={formData.availability[day] ?? 0}
                        onChange={e => setFormData({
                          ...formData,
                          availability: {
                            ...formData.availability,
                            [day]: Math.max(0, parseFloat(e.target.value) || 0)
                          }
                        })}
                        style={{
                          width: '100%',
                          padding: '6px 4px',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          fontSize: 13,
                          textAlign: 'center'
                        }}
                      />
                    </div>
                  ))}
                </div>
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
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveResource}
                disabled={!formData.name}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: 6,
                  background: formData.name ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                  color: 'white',
                  cursor: formData.name ? 'pointer' : 'not-allowed'
                }}
              >
                {editingResource ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={!!showDeleteConfirm}
        title="Delete Resource"
        message={`Are you sure you want to delete "${showDeleteConfirm?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        onConfirm={confirmDeleteResource}
        onCancel={() => setShowDeleteConfirm(null)}
      />
    </div>
  )
}
