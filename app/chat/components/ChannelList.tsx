'use client'
import { useEffect, useState } from 'react'
import type { ChatChannel } from '../../lib/types/chat'

interface ChannelListProps {
  channels: ChatChannel[]
  activeChannel: string | null
  currentUserId: string | null
  userRole: string | null
  onSelectChannel: (id: string) => void
  onOpenAddMember: (channel: ChatChannel) => void
  onClearChannel: (channelId: string) => void
  onDeleteChannel: (channelId: string) => void
}

export default function ChannelList({
  channels,
  activeChannel,
  currentUserId,
  userRole,
  onSelectChannel,
  onOpenAddMember,
  onClearChannel,
  onDeleteChannel,
}: ChannelListProps) {
  const [hoveredChannelId, setHoveredChannelId] = useState<string | null>(null)
  const [openMenuChannelId, setOpenMenuChannelId] = useState<string | null>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element
      if (openMenuChannelId && !target.closest('[data-channel-menu]')) {
        setOpenMenuChannelId(null)
      }
    }
    if (openMenuChannelId) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openMenuChannelId])

  const channelTypeLabel = (type: string) => {
    switch (type) {
      case 'company': return 'Company-wide'
      case 'team': return 'Team'
      case 'project': return 'Project'
      default: return 'Custom Group'
    }
  }

  return (
    <div style={{
      width: 280,
      borderRight: '1px solid var(--border)',
      background: 'var(--surface)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      borderRadius: '8px 0 0 8px'
    }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {channels.map(channel => {
          const isAdminMaintained = channel.type === 'company' || channel.type === 'team'
          const isCreator = channel.created_by && channel.created_by !== 'system' && String(channel.created_by) === String(currentUserId)
          const canManage = isCreator || (userRole === 'admin' && isAdminMaintained)
          const showMenu = canManage
          const isMenuOpen = openMenuChannelId === channel.id

          return (
            <div
              key={channel.id}
              onClick={() => {
                onSelectChannel(channel.id)
                setOpenMenuChannelId(null)
              }}
              onMouseEnter={() => setHoveredChannelId(channel.id)}
              onMouseLeave={() => setHoveredChannelId(null)}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                background: activeChannel === channel.id ? 'var(--bg-secondary)' : 'transparent',
                borderLeft: activeChannel === channel.id ? '3px solid var(--accent-primary)' : '3px solid transparent',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'background 0.2s',
                position: 'relative',
                gap: 8
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                  {channel.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3, lineHeight: 1.3 }}>
                  {channelTypeLabel(channel.type)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {channel.unread_count > 0 && (
                  <span style={{
                    background: 'var(--accent-primary)',
                    color: 'white',
                    borderRadius: '50%',
                    minWidth: 20,
                    height: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '0 6px'
                  }}>
                    {channel.unread_count > 99 ? '99+' : channel.unread_count}
                  </span>
                )}
                {showMenu && (
                  <div style={{ position: 'relative' }} data-channel-menu>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenMenuChannelId(isMenuOpen ? null : channel.id)
                      }}
                      style={{
                        padding: 0,
                        background: 'transparent',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        fontSize: 18,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 28,
                        height: 28,
                        transition: 'background 0.2s',
                        lineHeight: 1
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg-tertiary)'
                        e.currentTarget.style.color = 'var(--text-primary)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = 'var(--text-secondary)'
                      }}
                    >
                      ⋮
                    </button>
                    {isMenuOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          right: 0,
                          marginTop: 4,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          boxShadow: '0 4px 12px var(--shadow-lg)',
                          zIndex: 1000,
                          minWidth: 160,
                          overflow: 'hidden'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpenAddMember(channel)
                            setOpenMenuChannelId(null)
                          }}
                          style={{
                            width: '100%', padding: '10px 16px', background: 'transparent', border: 'none',
                            textAlign: 'left', cursor: 'pointer', fontSize: 14, color: 'var(--text-primary)',
                            transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: 8
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                        >
                          <span>👥</span>
                          <span>Manage Members</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onClearChannel(channel.id)
                            setOpenMenuChannelId(null)
                          }}
                          style={{
                            width: '100%', padding: '10px 16px', background: 'transparent', border: 'none',
                            textAlign: 'left', cursor: 'pointer', fontSize: 14, color: 'var(--warning)',
                            transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: 8
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                        >
                          <span>🗑️</span>
                          <span>Clear Messages</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteChannel(channel.id)
                            setOpenMenuChannelId(null)
                          }}
                          style={{
                            width: '100%', padding: '10px 16px', background: 'transparent',
                            border: 'none', borderTop: '1px solid var(--border)',
                            textAlign: 'left', cursor: 'pointer', fontSize: 14, color: 'var(--error)',
                            transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: 8
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                        >
                          Delete Channel
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {channels.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-secondary)' }}>
            No channels available
          </div>
        )}
      </div>
    </div>
  )
}
