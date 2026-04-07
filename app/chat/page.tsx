'use client'
import { useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Header from '../components/Header'
import { useToast } from '../components/Toast'
import LoadingSpinner from '../components/LoadingSpinner'
import { useUser } from '../lib/hooks/useUser'
import { apiGet, apiPost, apiDelete } from '../lib/api/client'
import { useChatSocket } from './hooks/useChatSocket'
import ChannelList from './components/ChannelList'
import MessageList from './components/MessageList'
import MessageInput from './components/MessageInput'
import type { ChatChannel } from '../lib/types/chat'

function ChatPageContent() {
  const searchParams = useSearchParams()
  const toast = useToast()
  const { user: currentUser, loading: userLoading } = useUser()

  const [activeChannel, setActiveChannel] = useState<string | null>(null)
  const activeChannelRef = useRef<string | null>(null)
  const scrolledToMessageIdRef = useRef<string | null>(null)

  // Dialog state
  const [showCreateChannelDialog, setShowCreateChannelDialog] = useState(false)
  const [showDeleteChannelDialog, setShowDeleteChannelDialog] = useState(false)
  const [showClearChannelDialog, setShowClearChannelDialog] = useState(false)
  const [channelToDelete, setChannelToDelete] = useState<string | null>(null)
  const [channelToClear, setChannelToClear] = useState<string | null>(null)
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false)
  const [channelForMember, setChannelForMember] = useState<ChatChannel | null>(null)
  const [channelMembers, setChannelMembers] = useState<{ user_id: string; name: string; email: string }[]>([])
  const [loadingChannelMembers, setLoadingChannelMembers] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const [newChannelData, setNewChannelData] = useState({
    name: '',
    type: 'team' as 'project' | 'team' | 'company' | 'group',
    projectId: '',
    department: '',
    selectedUserIds: [] as string[]
  })

  const {
    socket,
    channels, setChannels,
    messages, setMessages,
    typingUsers,
    loading, error,
    users,
    projects,
    departments,
    loadMessages,
    loadingOlder,
    hasMoreMessages, setHasMoreMessages,
  } = useChatSocket({ currentUser, userLoading, searchParams, activeChannelRef })

  const currentUserId = currentUser?.id ?? null
  const userRole = (currentUser as any)?.role ?? null

  // Keep ref in sync with state for socket event handlers
  useEffect(() => {
    activeChannelRef.current = activeChannel
  }, [activeChannel])

  // Set initial channel when channels first load, or navigate to URL param
  useEffect(() => {
    if (channels.length === 0) return
    const channelParam = searchParams.get('channel')
    const paramIsValid = channelParam && channels.some(c => c.id === channelParam)
    if (paramIsValid && activeChannel !== channelParam) {
      setActiveChannel(channelParam)
    } else if (!activeChannel) {
      setActiveChannel(channels[0].id)
    }
  }, [searchParams, channels, activeChannel])

  // Join channel via socket and load messages when active channel changes
  useEffect(() => {
    if (activeChannel && socket) {
      setHasMoreMessages(true)
      setMessages([])
      loadMessages(activeChannel, null, true)
      socket.emit('join_channel', activeChannel)
    }
  }, [activeChannel, socket])

  // Scroll to a specific message when opened from a notification link
  useEffect(() => {
    const messageId = searchParams.get('message')
    if (!messageId || activeChannel !== searchParams.get('channel')) {
      if (!searchParams.get('message')) scrolledToMessageIdRef.current = null
      return
    }
    if (scrolledToMessageIdRef.current === messageId) return
    if (!messages.some(m => m.id === messageId)) return
    const el = document.querySelector(`[data-message-id="${messageId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      scrolledToMessageIdRef.current = messageId
    }
  }, [searchParams, activeChannel, messages])

  // ─── Channel management ───────────────────────────────────────────────────

  const deleteChannel = (channelId: string) => {
    const channelData = channels.find(c => c.id === channelId)
    if (!channelData) return
    if (channelData.type === 'company' && userRole !== 'admin') {
      toast.warning('Only admins can delete the company-wide channel')
      return
    }
    setChannelToDelete(channelId)
    setShowDeleteChannelDialog(true)
  }

  const clearChannel = (channelId: string) => {
    setChannelToClear(channelId)
    setShowClearChannelDialog(true)
  }

  const confirmDeleteChannel = async () => {
    if (!channelToDelete) return
    try {
      await apiDelete(`/api/chat/channels/${channelToDelete}`, { defaultErrorMessage: 'Failed to delete channel' })
      const channelsData = await apiGet<{ channels: ChatChannel[] }>('/api/chat/channels')
      const updated = channelsData.channels || []
      setChannels(updated)
      if (activeChannel === channelToDelete) {
        setActiveChannel(updated.length > 0 ? updated[0].id : null)
        setMessages([])
      }
      setShowDeleteChannelDialog(false)
      setChannelToDelete(null)
      if (socket) socket.emit('join_channels')
    } catch (err: unknown) {
      toast.error((err instanceof Error ? err.message : String(err)) || 'Failed to delete channel')
    }
  }

  const confirmClearChannel = async () => {
    const targetChannelId = channelToClear || activeChannel
    if (!targetChannelId) return
    try {
      await apiDelete(`/api/chat/channels/${targetChannelId}/messages`, { defaultErrorMessage: 'Failed to clear channel' })
      if (targetChannelId === activeChannel) setMessages([])
      setShowClearChannelDialog(false)
      setChannelToClear(null)
    } catch (err: unknown) {
      toast.error((err instanceof Error ? err.message : String(err)) || 'Failed to clear channel')
    }
  }

  const openAddMemberDialog = async (channel: ChatChannel) => {
    setChannelForMember(channel)
    setSelectedMemberId('')
    setChannelMembers([])
    setShowAddMemberDialog(true)
    setLoadingChannelMembers(true)
    try {
      const data = await apiGet<{ members: any[] }>(`/api/chat/channels/${channel.id}`)
      const members = data.members ?? []
      setChannelMembers(members.map((m: any) => ({
        user_id: String(m.user_id),
        name: m.name ?? '',
        email: m.email ?? ''
      })))
    } catch {
      // keep members empty on error
    } finally {
      setLoadingChannelMembers(false)
    }
  }

  const addMemberToChannel = async () => {
    if (!channelForMember || !selectedMemberId) {
      toast.error('Please select a user to add')
      return
    }
    try {
      await apiPost(`/api/chat/channels/${channelForMember.id}/members`, { userId: selectedMemberId }, { defaultErrorMessage: 'Failed to add member' })
      toast.success('Member added to channel')
      setShowAddMemberDialog(false)
      setChannelForMember(null)
      setSelectedMemberId('')
      const channelsData = await apiGet<{ channels: ChatChannel[] }>('/api/chat/channels')
      setChannels(channelsData.channels || [])
    } catch (err: unknown) {
      toast.error((err instanceof Error ? err.message : String(err)) || 'Failed to add member')
    }
  }

  const createChannel = async () => {
    if (!newChannelData.name.trim()) { toast.error('Channel name is required'); return }
    if (newChannelData.type === 'project' && !newChannelData.projectId) { toast.error('Project is required for project channels'); return }
    if (newChannelData.type === 'team' && !newChannelData.department) { toast.error('Department is required for team channels'); return }
    if (newChannelData.type === 'group' && newChannelData.selectedUserIds.length === 0) { toast.error('Please select at least one user for the custom group'); return }

    try {
      const data = await apiPost<{ channel: ChatChannel }>('/api/chat/channels', {
        name: newChannelData.name.trim(),
        type: newChannelData.type,
        projectId: newChannelData.type === 'project' ? newChannelData.projectId : null,
        department: newChannelData.type === 'team' ? newChannelData.department : null,
        userIds: newChannelData.type === 'group' ? newChannelData.selectedUserIds : null
      }, { defaultErrorMessage: 'Failed to create channel' })
      const channelsData = await apiGet<{ channels: ChatChannel[] }>('/api/chat/channels')
      setChannels(channelsData.channels || [])
      if (data.channel) {
        setActiveChannel(data.channel.id)
        if (socket) socket.emit('join_channels')
      }
      setNewChannelData({ name: '', type: 'team', projectId: '', department: '', selectedUserIds: [] })
      setShowCreateChannelDialog(false)
      toast.success('Channel created successfully')
    } catch (err: unknown) {
      toast.error((err instanceof Error ? err.message : String(err)) || 'Failed to create channel')
    }
  }

  const toggleUserSelection = (userId: string) => {
    setNewChannelData(prev => ({
      ...prev,
      selectedUserIds: prev.selectedUserIds.includes(userId)
        ? prev.selectedUserIds.filter(id => id !== userId)
        : [...prev.selectedUserIds, userId]
    }))
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <Header />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
          <LoadingSpinner size={32} />
          <div style={{ color: 'var(--text-secondary)' }}>Loading chat...</div>
        </div>
      </div>
    )
  }

  if (error && !socket) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <Header />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--error)' }}>
          {error}
        </div>
      </div>
    )
  }

  const activeChannelName = channels.find(c => c.id === activeChannel)?.name || 'Chat'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Header />

      {/* Page header */}
      <div style={{
        padding: '16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>Channels</h1>
          {activeChannel && (
            <>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 18 }}>•</span>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 500, color: 'var(--text-primary)' }}>
                {activeChannelName}
              </h2>
            </>
          )}
        </div>
        <button
          className="btn-lift"
          onClick={() => setShowCreateChannelDialog(true)}
          style={{
            padding: '8px 16px', background: 'var(--accent-primary)', color: 'white',
            border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s ease'
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
          <span>+</span> New
        </button>
      </div>

      {/* Main layout */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16, background: 'var(--bg-secondary)', position: 'relative' }}>
        <div style={{
          display: 'flex', flex: 1, height: '100%', overflow: 'hidden',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <ChannelList
            channels={channels}
            activeChannel={activeChannel}
            currentUserId={currentUserId}
            userRole={userRole}
            onSelectChannel={setActiveChannel}
            onOpenAddMember={openAddMemberDialog}
            onClearChannel={clearChannel}
            onDeleteChannel={deleteChannel}
          />

          {/* Chat area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '0 8px 8px 0' }}>
            {activeChannel ? (
              <>
                <MessageList
                  messages={messages}
                  currentUserId={currentUserId}
                  users={users}
                  loadingOlder={loadingOlder}
                  hasMoreMessages={hasMoreMessages}
                  typingUsers={typingUsers}
                  activeChannel={activeChannel}
                  socket={socket}
                  loadMessages={loadMessages}
                />
                <MessageInput
                  activeChannel={activeChannel}
                  socket={socket}
                  users={users}
                  currentUserId={currentUserId}
                  focusTrigger={activeChannel}
                />
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                Select a channel to start chatting
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Member Dialog */}
      {showAddMemberDialog && channelForMember && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}
          onClick={() => { setShowAddMemberDialog(false); setChannelMembers([]) }}
        >
          <div
            style={{ background: 'var(--surface)', borderRadius: 12, padding: 24, minWidth: 320, maxWidth: 400, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', border: '1px solid var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, marginBottom: 12, fontSize: 18 }}>
              Add member to <span style={{ color: 'var(--accent-primary)' }}>{channelForMember.name}</span>
            </h3>
            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: 0, marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Current members</p>
              {loadingChannelMembers ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <LoadingSpinner size={20} />
                  <span style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>Loading...</span>
                </div>
              ) : channelMembers.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>No members yet</p>
              ) : (
                <ul style={{ margin: 0, padding: '8px 0 0 0', listStyle: 'none', maxHeight: 120, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-secondary)' }}>
                  {channelMembers.map((m, idx) => (
                    <li key={m.user_id} style={{ padding: '6px 12px', fontSize: 13, color: 'var(--text-primary)', borderBottom: idx < channelMembers.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      {m.name || m.email || m.user_id}{m.email && m.name ? ` (${m.email})` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p style={{ marginTop: 0, marginBottom: 8, fontSize: 13, color: 'var(--text-secondary)' }}>Select a user to add to this channel.</p>
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', marginBottom: 16, fontSize: 14, background: 'var(--surface)' }}
            >
              <option value="">Select a user...</option>
              {users.filter(u => !channelMembers.some(m => String(m.user_id) === String(u.id))).map(u => (
                <option key={u.id} value={u.id}>{u.name || u.email}</option>
              ))}
            </select>
            {users.filter(u => !channelMembers.some(m => String(m.user_id) === String(u.id))).length === 0 && !loadingChannelMembers && (
              <p style={{ margin: '-8px 0 16px 0', fontSize: 12, color: 'var(--text-tertiary)' }}>All users are already in this channel.</p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => { setShowAddMemberDialog(false); setChannelMembers([]) }}
                style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 14 }}
              >Cancel</button>
              <button
                onClick={addMemberToChannel}
                style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: 'var(--accent-primary)', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
              >Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Channel Dialog */}
      {showCreateChannelDialog && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--modal-backdrop)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowCreateChannelDialog(false)}
        >
          <div
            style={{ background: 'var(--surface)', borderRadius: 12, padding: 24, width: '90%', maxWidth: 500, boxShadow: '0 8px 32px var(--shadow-2xl)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 20px 0', fontSize: 20, fontWeight: 600 }}>Create New Channel</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>Channel Name *</label>
                <input
                  type="text"
                  value={newChannelData.name}
                  onChange={(e) => setNewChannelData({ ...newChannelData, name: e.target.value })}
                  placeholder="Enter channel name"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>Channel Type *</label>
                <select
                  value={newChannelData.type}
                  onChange={(e) => setNewChannelData({ ...newChannelData, type: e.target.value as 'project' | 'team' | 'company' | 'group', projectId: '', department: '', selectedUserIds: [] })}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer' }}
                >
                  <option value="company">Company-wide</option>
                  <option value="team">Team/Department</option>
                  <option value="project">Project</option>
                  <option value="group">Custom Group</option>
                </select>
              </div>

              {newChannelData.type === 'project' && (
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>Project *</label>
                  <select
                    value={newChannelData.projectId}
                    onChange={(e) => setNewChannelData({ ...newChannelData, projectId: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer' }}
                  >
                    <option value="">Select a project...</option>
                    {projects.map(project => (
                      <option key={project.id} value={project.id}>
                        {project.code ? `${project.code} - ` : ''}{project.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {newChannelData.type === 'team' && (
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>Department *</label>
                  <select
                    value={newChannelData.department}
                    onChange={(e) => setNewChannelData({ ...newChannelData, department: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer' }}
                  >
                    <option value="">Select a department...</option>
                    {departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                  </select>
                </div>
              )}

              {newChannelData.type === 'group' && (
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
                    Select Users * ({newChannelData.selectedUserIds.length} selected)
                  </label>
                  <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, padding: 8, background: 'var(--bg-primary)' }}>
                    {users.length === 0 ? (
                      <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading users...</div>
                    ) : (
                      users.map(user => {
                        const isSelected = newChannelData.selectedUserIds.includes(user.id)
                        return (
                          <div
                            key={user.id}
                            onClick={() => toggleUserSelection(user.id)}
                            style={{
                              padding: '8px 12px', marginBottom: 4, borderRadius: 4, cursor: 'pointer',
                              background: isSelected ? 'var(--accent-primary)' : 'transparent',
                              color: isSelected ? 'white' : 'var(--text-primary)',
                              display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-secondary)' }}
                            onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                          >
                            <input type="checkbox" checked={isSelected} onChange={() => toggleUserSelection(user.id)} style={{ cursor: 'pointer' }} />
                            <div>
                              <div style={{ fontWeight: 500, fontSize: 14 }}>{user.name}</div>
                              {user.email && <div style={{ fontSize: 12, opacity: 0.8 }}>{user.email}</div>}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  onClick={() => { setShowCreateChannelDialog(false); setNewChannelData({ name: '', type: 'team', projectId: '', department: '', selectedUserIds: [] }) }}
                  style={{ padding: '10px 20px', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
                >Cancel</button>
                <button
                  onClick={createChannel}
                  style={{ padding: '10px 20px', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 500, transition: 'background 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-primary-hover)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent-primary)' }}
                >Create Channel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Channel Dialog */}
      {showDeleteChannelDialog && channelToDelete && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--modal-backdrop)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => { setShowDeleteChannelDialog(false); setChannelToDelete(null) }}
        >
          <div
            style={{ background: 'var(--surface)', borderRadius: 12, padding: 24, width: '90%', maxWidth: 400, boxShadow: '0 8px 32px var(--shadow-2xl)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 16px 0', fontSize: 20, fontWeight: 600, color: 'var(--error)' }}>Delete Channel</h2>
            <p style={{ margin: '0 0 24px 0', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Are you sure you want to delete this channel? This will permanently delete the channel and all its messages. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowDeleteChannelDialog(false); setChannelToDelete(null) }}
                style={{ padding: '10px 20px', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
              >Cancel</button>
              <button
                onClick={confirmDeleteChannel}
                style={{ padding: '10px 20px', background: 'var(--error)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
              >Delete Channel</button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Channel Dialog */}
      {showClearChannelDialog && channelToClear && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--modal-backdrop)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => { setShowClearChannelDialog(false); setChannelToClear(null) }}
        >
          <div
            style={{ background: 'var(--surface)', borderRadius: 12, padding: 24, width: '90%', maxWidth: 400, boxShadow: '0 8px 32px var(--shadow-2xl)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 16px 0', fontSize: 20, fontWeight: 600, color: 'var(--warning)' }}>Clear Channel Messages</h2>
            <p style={{ margin: '0 0 24px 0', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Are you sure you want to clear all messages from this channel? This will permanently delete all messages. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowClearChannelDialog(false); setChannelToClear(null) }}
                style={{ padding: '10px 20px', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
              >Cancel</button>
              <button
                onClick={confirmClearChannel}
                style={{ padding: '10px 20px', background: 'var(--warning)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
              >Clear Messages</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <Header />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div>Loading chat...</div>
        </div>
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  )
}
