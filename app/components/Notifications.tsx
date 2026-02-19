'use client'
import { useEffect, useState, useRef, memo } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, X } from 'lucide-react'
import { io, Socket } from 'socket.io-client'
import { useToast } from './Toast'

interface Notification {
  id: string
  type: string
  title: string
  message: string | null
  link: string | null
  read: boolean
  created_at: string
}

function Notifications() {
  const router = useRouter()
  const toast = useToast()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(true)
  const [socket, setSocket] = useState<Socket | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Only connect if we're in the browser
    if (typeof window === 'undefined') return

    // Connect to Socket.io for real-time notifications
    // Use NEXT_PUBLIC_API_URL from env or fall back to current origin
    let apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl && typeof window !== 'undefined') {
      const currentOrigin = window.location.origin;
      const port = window.location.port;
      if (port === '8080' || port === '8443') {
        apiUrl = currentOrigin;
      } else {
        apiUrl = currentOrigin.replace(/:\d+$/, ':3002');
        if (!apiUrl.includes(':')) apiUrl = `${currentOrigin}:3002`;
      }
    }
    if (!apiUrl) {
      apiUrl = 'http://localhost:3002'; // Final fallback
    }
    
    const newSocket = io(apiUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      path: '/socket.io',
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      timeout: 10000,
      autoConnect: true
    })

    newSocket.on('connect', () => {
      console.log('✅ [Notifications] Connected to Socket.io at', apiUrl)
    })

    newSocket.on('connect_error', (err) => {
      console.warn('⚠️  [Notifications] Connection error:', err.message, 'at', apiUrl)
      // Silently handle connection errors - polling will be used as fallback
    })

    newSocket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        // Server disconnected, reconnect manually
        newSocket.connect()
      }
      // Other disconnect reasons are handled automatically
    })

    // Listen for new notifications: show toast and add to bell dropdown
    newSocket.on('new_notification', (notification: Notification) => {
      console.log('🔔 [Notifications] Received new notification:', notification)
      setNotifications(prev => {
        if (prev.some(n => n.id === notification.id)) {
          console.log('⚠️  [Notifications] Duplicate notification ignored:', notification.id)
          return prev
        }
        return [notification, ...prev]
      })
      setUnreadCount(prev => prev + 1)
      // Visual toast: clicking it navigates to the notification link (e.g. chat message)
      toast.showNotificationToast(notification.title, {
        message: notification.message ?? undefined,
        link: notification.link ?? undefined
      })
    })

    setSocket(newSocket)

    return () => {
      // Remove all event listeners before closing
      newSocket.removeAllListeners()
      newSocket.close()
    }
  }, [])

  useEffect(() => {
    loadNotifications()
    loadUnreadCount()
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(() => {
      loadUnreadCount()
      if (showDropdown) {
        loadNotifications()
      }
    }, 30000)
    
    return () => clearInterval(interval)
  }, [showDropdown])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  async function loadNotifications() {
    try {
      const res = await fetch('/api/notifications?limit=20', { credentials: 'include' })
      if (res.ok) {
        const response = await res.json()
        setNotifications(response.data?.notifications || response.notifications || [])
      }
    } catch (err) {
      console.error('Error loading notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadUnreadCount() {
    try {
      const res = await fetch('/api/notifications/unread-count', { credentials: 'include' })
      if (res.ok) {
        const response = await res.json()
        setUnreadCount(response.data?.count || response.count || 0)
      }
    } catch (err) {
      console.error('Error loading unread count:', err)
    }
  }

  async function markAsRead(notificationId: string) {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
        credentials: 'include'
      })
      setNotifications(prev => prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      ))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Error marking notification as read:', err)
    }
  }

  async function markAllAsRead() {
    try {
      await fetch('/api/notifications/read-all', {
        method: 'POST',
        credentials: 'include'
      })
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error('Error marking all as read:', err)
    }
  }

  async function deleteNotification(notificationId: string) {
    try {
      await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      const deleted = notifications.find(n => n.id === notificationId)
      if (deleted && !deleted.read) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (err) {
      console.error('Error deleting notification:', err)
    }
  }

  function handleNotificationClick(notification: Notification) {
    if (!notification.read) {
      markAsRead(notification.id)
    }
    
    if (notification.link) {
      setShowDropdown(false)
      router.push(notification.link)
    }
  }

  function formatTimeAgo(dateString: string) {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  function getNotificationIcon(type: string) {
    switch (type) {
      case 'mention':
        return '💬'
      case 'message':
        return '📩'
      case 'system':
        return '🔔'
      default:
        return '🔔'
    }
  }

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        onClick={() => {
          setShowDropdown(!showDropdown)
          if (!showDropdown) {
            loadNotifications()
          }
        }}
        style={{
          position: 'relative',
          padding: '8px',
          background: 'transparent',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-tertiary)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: 0,
            right: 0,
            background: 'var(--error)',
            color: 'white',
            borderRadius: '50%',
            width: 18,
            height: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 600,
            border: '2px solid var(--bg)'
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 8,
          width: 380,
          maxHeight: 500,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          zIndex: 9500,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: 16,
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  padding: '4px 12px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-secondary)'
                  e.currentTarget.style.color = 'var(--text-primary)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🔔</div>
                <div>No notifications</div>
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  style={{
                    padding: 12,
                    borderBottom: '1px solid var(--border)',
                    background: notification.read ? 'transparent' : 'var(--accent-primary-light)',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = notification.read 
                      ? 'var(--bg-secondary)' 
                      : 'var(--accent-primary-light)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = notification.read 
                      ? 'transparent' 
                      : 'var(--accent-primary-light)'
                  }}
                >
                  {!notification.read && (
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 3,
                      background: 'var(--accent-primary)'
                    }} />
                  )}
                  <div style={{ display: 'flex', gap: 12, paddingLeft: notification.read ? 0 : 8 }}>
                    <div style={{
                      fontSize: 24,
                      flexShrink: 0,
                      lineHeight: 1
                    }}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: notification.read ? 500 : 600,
                        fontSize: 14,
                        marginBottom: 4,
                        color: 'var(--text-primary)'
                      }}>
                        {notification.title}
                      </div>
                      {notification.message && (
                        <div style={{
                          fontSize: 13,
                          color: 'var(--text-secondary)',
                          marginBottom: 4,
                          wordBreak: 'break-word'
                        }}>
                          {notification.message}
                        </div>
                      )}
                      <div style={{
                        fontSize: 11,
                        color: 'var(--text-tertiary)'
                      }}>
                        {formatTimeAgo(notification.created_at)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteNotification(notification.id)
                      }}
                      style={{
                        padding: 4,
                        background: 'transparent',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        color: 'var(--text-tertiary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0.6,
                        transition: 'opacity 0.2s',
                        flexShrink: 0
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '1'
                        e.currentTarget.style.color = 'var(--error)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '0.6'
                        e.currentTarget.style.color = 'var(--text-tertiary)'
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Export memoized component to prevent unnecessary re-renders
export default memo(Notifications)
