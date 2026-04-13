'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import type { ReadonlyURLSearchParams } from 'next/navigation'
import type { ChatChannel, ChatMessage, ChatUser } from '../../lib/types/chat'
import type { Project, Resource } from '../../lib/types/schedule'
import { TYPING_TIMEOUT_MS } from '../../lib/constants/ui'
import { getSocketApiUrl } from '../../lib/utils/socketUrl'
import { getDefaultSocketIoOptions } from '../../lib/utils/socketIoOptions'
import { apiGet, apiPost } from '../../lib/api/client'

interface UseChatSocketOptions {
  currentUser: { id: string; role?: string } | null
  userLoading: boolean
  searchParams: ReadonlyURLSearchParams
  activeChannelRef: React.MutableRefObject<string | null>
}

export interface UseChatSocketReturn {
  socket: Socket | null
  channels: ChatChannel[]
  setChannels: React.Dispatch<React.SetStateAction<ChatChannel[]>>
  messages: ChatMessage[]
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  typingUsers: Set<string>
  loading: boolean
  error: string
  setError: React.Dispatch<React.SetStateAction<string>>
  users: ChatUser[]
  projects: Project[]
  departments: string[]
  loadMessages: (channelId: string, before: string | null, isInitial: boolean) => Promise<void>
  loadingOlder: boolean
  hasMoreMessages: boolean
  setHasMoreMessages: React.Dispatch<React.SetStateAction<boolean>>
}

export function useChatSocket({ currentUser, userLoading, searchParams, activeChannelRef }: UseChatSocketOptions): UseChatSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [channels, setChannels] = useState<ChatChannel[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [error, setError] = useState('')
  const [users, setUsers] = useState<ChatUser[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const loadMessages = useCallback(async (channelId: string, before: string | null = null, isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true)
      } else {
        setLoadingOlder(true)
      }

      const url = `/api/chat/channels/${channelId}/messages?limit=50${before ? `&before=${before}` : ''}`
      const data = await apiGet<{ messages: ChatMessage[] }>(url, { defaultErrorMessage: 'Failed to load messages' })
      const newMessages = data.messages || []

      if (isInitial) {
        const uniqueMessages = Array.from(
          new Map(newMessages.map((m: ChatMessage) => [m.id, m])).values()
        ) as ChatMessage[]
        setMessages(uniqueMessages)
        apiPost(`/api/chat/channels/${channelId}/read`).catch(() => {})
        setChannels(prev => prev.map(c =>
          c.id === channelId ? { ...c, unread_count: 0 } : c
        ))
        setLoading(false)
      } else {
        if (newMessages.length > 0) {
          setMessages(prev => {
            const messageMap = new Map(prev.map(m => [m.id, m]))
            newMessages.forEach(m => messageMap.set(m.id, m))
            return Array.from(messageMap.values()).sort((a, b) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            )
          })
        } else {
          setHasMoreMessages(false)
        }
        setLoadingOlder(false)
      }

      if (newMessages.length < 50) {
        setHasMoreMessages(false)
      }
    } catch (err) {
      console.error('Error loading messages:', err)
      if (isInitial) {
        setLoading(false)
      } else {
        setLoadingOlder(false)
      }
    }
  }, [])

  useEffect(() => {
    if (userLoading) return
    if (!currentUser) {
      setError('Not authenticated. Please log in.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    let currentSocket: Socket | null = null

    const loadUsers = async () => {
      try {
        const data = await apiGet<{ users: ChatUser[] }>('/api/chat/users')
        setUsers(data.users || [])
      } catch (err) {
        console.error('Error loading users:', err)
      }
    }

    const loadProjectsAndDepartments = async () => {
      try {
        const projectsData = await apiGet<{ projects: Project[] }>('/api/projects')
        setProjects(projectsData.projects || [])
        const resourcesData = await apiGet<{ resources: Resource[] }>('/api/resources')
        const deptSet = new Set<string>()
        ;(resourcesData.resources || []).forEach((r) => {
          if (r.department && r.department.trim()) deptSet.add(r.department.trim())
        })
        setDepartments(Array.from(deptSet).sort())
      } catch (err) {
        console.error('Error loading projects/departments:', err)
      }
    }

    const connectSocket = async () => {
      await loadUsers()
      await loadProjectsAndDepartments()

      const apiUrl = getSocketApiUrl()
      const newSocket = io(apiUrl, {
        ...getDefaultSocketIoOptions(),
      })

      currentSocket = newSocket

      newSocket.on('connect', () => {
        setError('')
        newSocket.emit('join_channels')
      })

      newSocket.on('connect_error', (err) => {
        console.error('❌ [Chat] Socket connection error:', err.message)
        if (err.message === 'Authentication error') {
          setError('Authentication failed. Please log in again.')
        } else if (err.message?.includes('CORS')) {
          setError(`Connection blocked by CORS. Server needs to allow origin: ${window.location.origin}`)
        } else if (err.message?.includes('timeout')) {
          setError('Connection timeout. Check if the server is accessible.')
        } else if (err.message?.includes('xhr poll')) {
          setError('Chat connection failed (socket proxy). Restart the dev server and ensure the API is running.')
        } else if (err.message?.includes('ECONNREFUSED')) {
          setError('Cannot connect to server. Please check if the backend is running.')
        } else {
          setError(`Failed to connect to chat server: ${err.message}`)
        }
        setLoading(false)
      })

      newSocket.on('disconnect', (reason) => {
        if (reason === 'io server disconnect') {
          newSocket.connect()
        }
      })

      newSocket.on('channels_joined', async () => {
        try {
          const channelsData = await apiGet<{ channels: ChatChannel[] }>('/api/chat/channels')
          const loaded = channelsData.channels || []
          setChannels(loaded)
          if (loaded.length === 0) {
            setLoading(false)
          }
          // Initial channel selection is handled by the page via a useEffect on channels
        } catch {
          setError('Failed to load channels')
          setLoading(false)
        }
      })

      newSocket.on('new_message', (message: ChatMessage) => {
        if (message.channel_id === activeChannelRef.current) {
          setMessages(prev => {
            const exists = prev.some(m => m.id === message.id)
            if (exists) return prev
            return [...prev, message]
          })
        }
        if (message.channel_id !== activeChannelRef.current) {
          setChannels(prev => prev.map(c =>
            c.id === message.channel_id
              ? { ...c, unread_count: (c.unread_count || 0) + 1 }
              : c
          ))
        }
      })

      newSocket.on('user_typing', (data: { userId: string; userName: string }) => {
        setTypingUsers(prev => new Set([...prev, data.userName]))
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(() => {
          setTypingUsers(prev => {
            const next = new Set(prev)
            next.delete(data.userName)
            return next
          })
        }, TYPING_TIMEOUT_MS)
      })

      newSocket.on('user_stopped_typing', (data: { userName: string }) => {
        setTypingUsers(prev => {
          const next = new Set(prev)
          next.delete(data.userName)
          return next
        })
      })

      newSocket.on('error', (data: { message: string }) => {
        setError(data.message)
      })

      newSocket.on('mention', (data: { channelId: string; messageId: string; mentionedBy: string }) => {
        if (data.channelId !== activeChannelRef.current) {
          setChannels(prev => prev.map(c =>
            c.id === data.channelId
              ? { ...c, unread_count: (c.unread_count || 0) + 1 }
              : c
          ))
        }
      })

      newSocket.on('channel_cleared', (data: { channelId: string }) => {
        if (data.channelId === activeChannelRef.current) {
          setMessages([])
        }
      })

      newSocket.on('reaction_added', (data: { messageId: string; userId: string; userName: string; emoji: string; reactionId: string }) => {
        setMessages(prev => prev.map(msg => {
          if (msg.id === data.messageId) {
            const reactions = msg.reactions || []
            if (!reactions.some(r => r.id === data.reactionId)) {
              return {
                ...msg,
                reactions: [...reactions, {
                  id: data.reactionId,
                  emoji: data.emoji,
                  user_id: data.userId,
                  user_name: data.userName,
                  created_at: new Date().toISOString()
                }]
              }
            }
          }
          return msg
        }))
      })

      newSocket.on('reaction_removed', (data: { messageId: string; userId: string; emoji: string }) => {
        setMessages(prev => prev.map(msg => {
          if (msg.id === data.messageId) {
            return {
              ...msg,
              reactions: (msg.reactions || []).filter(r =>
                !(r.user_id === data.userId && r.emoji === data.emoji)
              )
            }
          }
          return msg
        }))
      })

      newSocket.on('message_edited', (updatedMessage: ChatMessage) => {
        setMessages(prev => prev.map(msg =>
          msg.id === updatedMessage.id ? { ...msg, ...updatedMessage } : msg
        ))
      })

      setSocket(newSocket)
      setLoading(false)
    }

    connectSocket()

    return () => {
      if (currentSocket) {
        currentSocket.removeAllListeners()
        currentSocket.close()
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
      }
    }
  }, [currentUser, userLoading])

  return {
    socket,
    channels, setChannels,
    messages, setMessages,
    typingUsers,
    loading, error, setError,
    users,
    projects,
    departments,
    loadMessages,
    loadingOlder,
    hasMoreMessages, setHasMoreMessages,
  }
}
