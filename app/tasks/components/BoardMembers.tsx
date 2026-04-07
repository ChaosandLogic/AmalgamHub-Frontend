'use client'
import { useState, useEffect } from 'react'
import { useToast } from '../../components/Toast'
import { Users, X, Plus } from 'lucide-react'
import { apiGet, apiPost, apiDelete } from '../../lib/api/client'

interface User {
  id: string
  name: string
  email: string
  role?: string
}

interface BoardPermission {
  id: string
  board_id: string
  user_id: string
  permission_level: string
  user_name: string
  user_email: string
}

interface BoardMembersProps {
  boardId: string
  canEdit: boolean
  onUpdate?: () => void
  showDialog?: boolean
  onDialogClose?: () => void
}

export default function BoardMembers({ boardId, canEdit, onUpdate, showDialog: externalShowDialog, onDialogClose }: BoardMembersProps) {
  const toast = useToast()
  const [internalShowDialog, setInternalShowDialog] = useState(false)
  const showDialog = externalShowDialog !== undefined ? externalShowDialog : internalShowDialog
  const setShowDialog = externalShowDialog !== undefined 
    ? (value: boolean) => { if (!value && onDialogClose) onDialogClose() }
    : setInternalShowDialog
  const [members, setMembers] = useState<BoardPermission[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')

  // Load members count on mount and when boardId changes
  useEffect(() => {
    loadMembers()
  }, [boardId])

  // Load full member list and users when dialog opens
  useEffect(() => {
    if (showDialog) {
      loadMembers()
      loadUsers()
    }
  }, [showDialog, boardId])

  async function loadMembers() {
    try {
      const data = await apiGet<{ permissions: any[] }>(`/api/tasks/boards/${boardId}/permissions`)
      setMembers(data.permissions || [])
    } catch (error) {
      console.error('Error loading board members:', error)
      toast.error('Failed to load board members')
    }
  }

  async function loadUsers() {
    try {
      const data = await apiGet<{ users: User[] }>('/api/users')
      setAllUsers(data.users || [])
    } catch (error) {
      console.error('Error loading users:', error)
      toast.error('Failed to load users')
    }
  }

  async function addMember() {
    if (!boardId) { toast.error('Board not found'); return }
    if (!selectedUserId) { toast.error('Please select a user'); return }
    if (members.some(m => m.user_id === selectedUserId)) {
      toast.error('User is already a member of this board')
      return
    }
    setLoading(true)
    try {
      await apiPost(`/api/tasks/boards/${encodeURIComponent(boardId)}/permissions`, {
        user_id: selectedUserId,
        permission_level: 'viewer'
      }, { defaultErrorMessage: 'Failed to add member' })
      await loadMembers()
      setSelectedUserId('')
      toast.success('Member added')
      onUpdate?.()
    } catch (error) {
      console.error('Error adding member:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add member')
    } finally {
      setLoading(false)
    }
  }

  async function removeMember(userId: string) {
    setLoading(true)
    try {
      await apiDelete(`/api/tasks/boards/${boardId}/permissions/${userId}`, { defaultErrorMessage: 'Failed to remove member' })
      await loadMembers()
      toast.success('Member removed')
      onUpdate?.()
    } catch (error) {
      console.error('Error removing member:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to remove member')
    } finally {
      setLoading(false)
    }
  }

  // Get users not yet added as members
  const availableUsers = allUsers.filter(
    user => !members.some(m => m.user_id === user.id)
  )

  return (
    <>
      {/* Only show button if not in controlled mode */}
      {externalShowDialog === undefined && (
        <button
          onClick={() => setShowDialog(true)}
          style={{
            padding: '6px 12px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 6,
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'background 0.2s'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--bg-tertiary)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <Users size={14} />
          Members ({members.length})
        </button>
      )}

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
          onClick={() => {
            setShowDialog(false)
            if (onDialogClose) onDialogClose()
          }}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0 }}>Board Members</h2>
              <button
                onClick={() => {
                  setShowDialog(false)
                  if (onDialogClose) onDialogClose()
                }}
                style={{
                  padding: 4,
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Add Member */}
            {canEdit && (
              <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 500 }}>
                  Add Member
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={selectedUserId}
                    onChange={e => setSelectedUserId(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      fontSize: 14,
                      background: 'var(--surface)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <option value="">Select a user...</option>
                    {availableUsers.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={addMember}
                    disabled={!selectedUserId || loading}
                    style={{
                      padding: '8px 16px',
                      background: selectedUserId && !loading ? 'var(--success)' : 'var(--text-tertiary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      cursor: selectedUserId && !loading ? 'pointer' : 'not-allowed',
                      fontSize: 14,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <Plus size={16} />
                    Add
                  </button>
                </div>
              </div>
            )}

            {/* Members List */}
            <div>
              <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                Members ({members.length})
              </div>
              {members.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No members yet. {canEdit && 'Add members to control who can see this board.'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {members.map(member => (
                    <div
                      key={member.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 12px',
                        background: 'var(--bg-secondary)',
                        borderRadius: 6
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>
                          {member.user_name}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {member.user_email} • {member.permission_level}
                        </div>
                      </div>
                      {canEdit && (
                        <button
                          onClick={() => removeMember(member.user_id)}
                          disabled={loading}
                          style={{
                            padding: 4,
                            background: 'transparent',
                            border: 'none',
                            borderRadius: 4,
                            cursor: loading ? 'not-allowed' : 'pointer',
                            color: 'var(--error)',
                            display: 'flex',
                            alignItems: 'center',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={e => {
                            if (!loading) {
                              e.currentTarget.style.background = 'var(--bg-tertiary)'
                            }
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'transparent'
                          }}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: 24, padding: 12, background: 'var(--bg-secondary)', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
              <strong>Note:</strong> Only members with access to this board can see it. Admins and bookers can see all boards.
            </div>
          </div>
        </div>
      )}
    </>
  )
}
