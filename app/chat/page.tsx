'use client'
import React, { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import { MessageCircle } from 'lucide-react'
import Header from '../components/Header'
import { useToast } from '../components/Toast'
import LoadingSpinner from '../components/LoadingSpinner'

interface Reaction {
  id: string
  emoji: string
  user_id: string
  user_name: string
  created_at: string
}

interface Attachment {
  id: string
  message_id: string
  filename: string
  original_filename: string
  mime_type: string
  size: number
  path: string
  uploaded_by: string
  created_at: string
}

interface Message {
  id: string
  content: string
  user_name: string
  user_email: string
  user_role: string
  created_at: string
  edited_at?: string
  reply_to_id?: string
  channel_id?: string
  reactions?: Reaction[]
  attachments?: Attachment[]
}

interface Channel {
  id: string
  name: string
  type: 'project' | 'team' | 'company' | 'group'
  project_id?: string
  department?: string
  created_by?: string // user id (hex) or 'system' for auto-created channels
  unread_count: number
}

interface User {
  id: string
  name: string
  email: string
}

function ChatPageContent() {
  const searchParams = useSearchParams()
  const toast = useToast()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
  const [activeChannel, setActiveChannel] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(true)
  const [error, setError] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [users, setUsers] = useState<User[]>([])
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [mentionQuery, setMentionQuery] = useState('')
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false)
  const [mentionPosition, setMentionPosition] = useState({ start: 0, end: 0 })
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [showCreateChannelDialog, setShowCreateChannelDialog] = useState(false)
  const [showDeleteChannelDialog, setShowDeleteChannelDialog] = useState(false)
  const [showClearChannelDialog, setShowClearChannelDialog] = useState(false)
  const [channelToDelete, setChannelToDelete] = useState<string | null>(null)
  const [channelToClear, setChannelToClear] = useState<string | null>(null)
  const [hoveredChannelId, setHoveredChannelId] = useState<string | null>(null)
  const [openMenuChannelId, setOpenMenuChannelId] = useState<string | null>(null)
  const [projects, setProjects] = useState<any[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [messageMenuOpen, setMessageMenuOpen] = useState<string | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState<string | null>(null)
  const scrolledToMessageIdRef = useRef<string | null>(null)
  const [newChannelData, setNewChannelData] = useState({
    name: '',
    type: 'team' as 'project' | 'team' | 'company' | 'group',
    projectId: '',
    department: '',
    selectedUserIds: [] as string[]
  })
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false)
  const [channelForMember, setChannelForMember] = useState<Channel | null>(null)
  const [channelMembers, setChannelMembers] = useState<{ user_id: string; name: string; email: string }[]>([])
  const [loadingChannelMembers, setLoadingChannelMembers] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const messagesEndRef = useRef<HTMLDivElement>(null)  
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)    
  const activeChannelRef = useRef<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let currentSocket: Socket | null = null

    // First check if user is authenticated
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/user', { credentials: 'include' })
        if (!res.ok) {
          setError('Not authenticated. Please log in.')
          setLoading(false)
          return null
        }
        const response = await res.json()
        const user = response.data?.user || response.user
        setCurrentUserId(user?.id || null)
        setUserRole(user?.role || null)
        return true
      } catch (err) {
        setError('Failed to verify authentication')
        setLoading(false)
        return null
      }
    }

    // Load users for mentions
    const loadUsers = async () => {
      try {
        const res = await fetch('/api/chat/users', { credentials: 'include' })
        if (res.ok) {
          const response = await res.json()
          setUsers(response.data?.users || response.users || [])
        }
      } catch (err) {
        console.error('Error loading users:', err)
      }
    }

    // Load projects and departments for channel creation
    const loadProjectsAndDepartments = async () => {
      try {
        // Load projects
        const projectsRes = await fetch('/api/projects', { credentials: 'include' })
        if (projectsRes.ok) {
          const projectsResponse = await projectsRes.json()
          const projectsData = projectsResponse.data || projectsResponse
          setProjects(projectsData.projects || [])
        }

        // Load resources to get departments
        const resourcesRes = await fetch('/api/resources', { credentials: 'include' })
        if (resourcesRes.ok) {
          const resourcesResponse = await resourcesRes.json()
          const resourcesData = resourcesResponse.data || resourcesResponse
          const deptSet = new Set<string>()
          ;(resourcesData.resources || []).forEach((r: any) => {
            if (r.department && r.department.trim()) {
              deptSet.add(r.department.trim())
            }
          })
          setDepartments(Array.from(deptSet).sort())
        }
      } catch (err) {
        console.error('Error loading projects/departments:', err)
      }
    }

    // Connect to Socket.io
    const connectSocket = async () => {
      const isAuth = await checkAuth()
      if (!isAuth) return
      
      // Load users for mentions
      await loadUsers()
      // Load projects and departments for channel creation
      await loadProjectsAndDepartments()

      // Use NEXT_PUBLIC_API_URL from env or infer from current origin
      let apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl && typeof window !== 'undefined') {
        const currentOrigin = window.location.origin;
        const port = window.location.port;
        // When accessed via nginx (8080/8443), API and socket.io are proxied – use same origin
        if (port === '8080' || port === '8443') {
          apiUrl = currentOrigin;
        } else {
          // Direct access (e.g. :3003): use same host, backend port 3002
          apiUrl = currentOrigin.replace(/:\d+$/, ':3002');
          if (!apiUrl.includes(':')) apiUrl = `${apiUrl}:3002`;
        }
      }
      if (!apiUrl) {
        apiUrl = 'http://localhost:3002'; // Final fallback
      }
      
      console.log('🔌 [Chat] Connecting to Socket.io at:', apiUrl);
      console.log('   Current origin:', typeof window !== 'undefined' ? window.location.origin : 'SSR');
      
      const newSocket = io(apiUrl, {
        withCredentials: true,
        transports: ['websocket', 'polling'],
        path: '/socket.io',
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        timeout: 10000
      })

      currentSocket = newSocket

      newSocket.on('connect', () => {
        console.log('✅ Connected to chat server')
        setError('')
        newSocket.emit('join_channels')
      })

      newSocket.on('connect_error', (err) => {
        console.error('❌ [Chat] Socket connection error:', err.message)
        console.error('   Using API URL:', apiUrl)
        console.error('   Error type:', err.constructor.name)
        
        // Provide specific error messages based on the error type
        if (err.message === 'Authentication error') {
          setError('Authentication failed. Please log in again.')
        } else if (err.message?.includes('CORS')) {
          setError(`Connection blocked by CORS. Server needs to allow origin: ${window.location.origin}`)
        } else if (err.message?.includes('timeout')) {
          setError('Connection timeout. Check if the server is accessible.')
        } else if (err.message?.includes('ECONNREFUSED')) {
          setError('Cannot connect to server. Please check if the backend is running.')
        } else {
          setError(`Failed to connect to chat server: ${err.message}`)
        }
        setLoading(false)
      })

      newSocket.on('disconnect', (reason) => {
        if (reason === 'io server disconnect') {
          // Server disconnected, reconnect manually
          newSocket.connect()
        }
      })

      newSocket.on('channels_joined', async () => {
        // Load channels
        try {
          const res = await fetch('/api/chat/channels', { credentials: 'include' })
          if (res.ok) {
            const response = await res.json()
            const channels = response.data?.channels || response.channels || []
            setChannels(channels)
            if (channels.length > 0) {
              // Check if channel is specified in URL (from notification link)
              const channelParam = searchParams.get('channel')
              const targetChannelId = channelParam && channels.find((c: Channel) => c.id === channelParam)
                ? channelParam
                : channels[0].id
              setActiveChannel(targetChannelId)
              
              // Load messages immediately for the first channel
              try {
                const messagesRes = await fetch(`/api/chat/channels/${targetChannelId}/messages`, { credentials: 'include' })
                if (messagesRes.ok) {
                  const messagesResponse = await messagesRes.json()
                  const messagesData = messagesResponse.data || messagesResponse
                  // Use Set to ensure unique messages by ID
                  const uniqueMessages = Array.from(
                    new Map((messagesData.messages || []).map((m: Message) => [m.id, m])).values()
                  ) as Message[]
                  setMessages(uniqueMessages)

                  // Mark as read
                  fetch(`/api/chat/channels/${targetChannelId}/read`, {
                    method: 'POST',
                    credentials: 'include'
                  })
                  
                  // Update unread count
                  setChannels(prev => prev.map(c => 
                    c.id === targetChannelId ? { ...c, unread_count: 0 } : c
                  ))
                }
              } catch (err) {
                console.error('Error loading messages:', err)
              }
              
              // Join the channel
              newSocket.emit('join_channel', targetChannelId)
            }
            setLoading(false)
          } else {
            setError('Failed to load channels')
            setLoading(false)
          }
        } catch (err) {
          setError('Failed to load channels')
          setLoading(false)
        }
      })

      newSocket.on('new_message', (message: Message) => {
        // Check if message is for currently active channel using ref
        if (message.channel_id === activeChannelRef.current) {
          setMessages(prev => {
            // Check if message already exists to prevent duplicates
            const exists = prev.some(m => m.id === message.id)
            if (exists) return prev
            return [...prev, message]
          })
        }
        
        // Update unread count (only if not for active channel)
        if (message.channel_id !== activeChannelRef.current) {
          setChannels(prev => prev.map(c => 
            c.id === message.channel_id 
              ? { ...c, unread_count: (c.unread_count || 0) + 1 }
              : c
          ))
        }
      })

      newSocket.on('user_typing', (data: { userId: string, userName: string }) => {
        setTypingUsers(prev => new Set([...prev, data.userName]))
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current)
        }
        typingTimeoutRef.current = setTimeout(() => {
          setTypingUsers(prev => {
            const next = new Set(prev)
            next.delete(data.userName)
            return next
          })
        }, 3000)
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

      // Handle mention notifications
      newSocket.on('mention', (data: { channelId: string, messageId: string, mentionedBy: string }) => {
        // Show notification or highlight
        if (data.channelId === activeChannelRef.current) {
          // User is mentioned in current channel - could show a toast or highlight
          console.log(`You were mentioned by ${data.mentionedBy}`)
        } else {
          // User is mentioned in another channel - update unread count
          setChannels(prev => prev.map(c => 
            c.id === data.channelId 
              ? { ...c, unread_count: (c.unread_count || 0) + 1 }
              : c
          ))
        }
      })

      // Handle channel cleared event
      newSocket.on('channel_cleared', (data: { channelId: string }) => {
        if (data.channelId === activeChannelRef.current) {
          setMessages([])
        }
      })

      // Handle reaction added event
      newSocket.on('reaction_added', (data: { messageId: string, userId: string, userName: string, emoji: string, reactionId: string }) => {
        setMessages(prev => prev.map(msg => {
          if (msg.id === data.messageId) {
            const reactions = msg.reactions || []
            // Check if this exact reaction already exists
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

      // Handle reaction removed event
      newSocket.on('reaction_removed', (data: { messageId: string, userId: string, emoji: string }) => {
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

      // Handle message edited event
      newSocket.on('message_edited', (updatedMessage: Message) => {
        setMessages(prev => prev.map(msg => 
          msg.id === updatedMessage.id ? { ...msg, ...updatedMessage } : msg
        ))
      })

      setSocket(newSocket)
      setLoading(false)
    }

    connectSocket()

    // Cleanup function
    return () => {
      if (currentSocket) {
        // Remove all event listeners before closing
        currentSocket.removeAllListeners()
        currentSocket.close()
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
      }
    }
  }, [])

  // Close menu when clicking outside
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

  // Update ref when activeChannel changes
  useEffect(() => {
    activeChannelRef.current = activeChannel
  }, [activeChannel])

  // When navigating to /chat?channel=id&message=id (e.g. from notification), switch channel if needed
  useEffect(() => {
    const channelParam = searchParams.get('channel')
    if (!channelParam || channels.length === 0) return
    const valid = channels.some((c: Channel) => c.id === channelParam)
    if (valid && activeChannel !== channelParam) {
      setActiveChannel(channelParam)
    }
  }, [searchParams, channels, activeChannel])

  useEffect(() => {
    if (activeChannel && socket) {
      // Reset pagination state when channel changes
      setHasMoreMessages(true)
      setMessages([])
      
      // Load initial messages
      loadMessages(activeChannel, null, true)
      
      socket.emit('join_channel', activeChannel)
    }
  }, [activeChannel, socket])

  const loadMessages = useCallback(async (channelId: string, before: string | null = null, isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true)
      } else {
        setLoadingOlder(true)
      }
      
      const url = `/api/chat/channels/${channelId}/messages?limit=50${before ? `&before=${before}` : ''}`
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load messages')
      
      const response = await res.json()
      console.log('[Chat] Messages response:', { 
        response, 
        hasData: !!response.data, 
        hasMessages: !!response.data?.messages,
        messagesType: typeof response.data?.messages,
        messagesIsArray: Array.isArray(response.data?.messages),
        messagesLength: response.data?.messages?.length,
        messagesValue: response.data?.messages
      })
      const data = response.data || response
      const newMessages = (data.messages || []) as Message[]
      console.log('[Chat] Parsed messages:', { count: newMessages.length, firstMessage: newMessages[0] })
      
      if (isInitial) {
        // Use Map to ensure unique messages by ID
        const uniqueMessages = Array.from(
          new Map(newMessages.map((m: Message) => [m.id, m])).values()
        ) as Message[]
        console.log('[Chat] Setting messages:', { count: uniqueMessages.length })
        setMessages(uniqueMessages)
        
        // Mark as read
        fetch(`/api/chat/channels/${channelId}/read`, {
          method: 'POST',
          credentials: 'include'
        })
        
        // Update unread count
        setChannels(prev => prev.map(c => 
          c.id === channelId ? { ...c, unread_count: 0 } : c
        ))
        
        setLoading(false)
      } else {
        // Append older messages at the beginning
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
      
      // If we got fewer than 50 messages, there are no more
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

  // Handle scroll to load older messages and detect scroll position
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container || !activeChannel) return

    const handleScroll = () => {
      // Load more when scrolled near the top (within 200px)
      if (!loadingOlder && hasMoreMessages && container.scrollTop < 200) {
        const oldestMessage = messages[0]
        if (oldestMessage) {
          loadMessages(activeChannel, oldestMessage.created_at, false)
        }
      }
      
      // Show scroll-to-bottom button when scrolled up
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
      setShowScrollToBottom(!isNearBottom)
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [activeChannel, messages, hasMoreMessages, loadingOlder, loadMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Scroll to message when opened from notification link (?channel=...&message=...)
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

  // Auto-focus input when channel changes
  useEffect(() => {
    if (activeChannel && inputRef.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [activeChannel])

  // Format date for message separators
  const formatMessageDate = (date: string) => {
    const messageDate = new Date(date)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    if (messageDate.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      return messageDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    }
  }

  // Parse message content and highlight @mentions and URLs
  type MessagePart = 
    | { type: 'text', content: string }
    | { type: 'mention', content: string, user: User }
  
  const parseMessageContent = (content: string): MessagePart[] => {
    if (!content) return [{ type: 'text' as const, content: '' }]
    
    const parts: MessagePart[] = []
    // Updated regex to match usernames with spaces: @ followed by one or more words (letters, spaces, hyphens, apostrophes)
    // Stops at: end of string, newline, another @, or punctuation
    const mentionRegex = /@([^\s@\n][^@\n]*?)(?=\s|$|@|\n|[,.;:!?])/g
    // URL regex to match http/https links
    const urlRegex = /(https?:\/\/[^\s]+)/g
    
    // Combine all matches (mentions and URLs) with their positions
    const allMatches: Array<{ type: 'mention' | 'url', match: RegExpMatchArray, index: number }> = []
    
    // Find all mentions
    let match
    mentionRegex.lastIndex = 0
    while ((match = mentionRegex.exec(content)) !== null) {
      allMatches.push({ type: 'mention', match, index: match.index })
    }
    
    // Find all URLs
    urlRegex.lastIndex = 0
    while ((match = urlRegex.exec(content)) !== null) {
      allMatches.push({ type: 'url', match, index: match.index })
    }
    
    // Sort by position
    allMatches.sort((a, b) => a.index - b.index)
    
    let lastIndex = 0
    
    for (const { type, match, index } of allMatches) {
      // Add text before this match
      if (index > lastIndex) {
        parts.push({ type: 'text', content: content.substring(lastIndex, index) })
      }
      
      if (type === 'mention') {
        // Find user for mention (only if users are loaded)
        const mentionedName = match[1].trim()
        const user = users.length > 0 
          ? users.find(u => (u?.name ?? '').toLowerCase() === (mentionedName ?? '').toLowerCase())
          : null
        
        if (user) {
          parts.push({ type: 'mention', content: match[0], user })
        } else {
          // Still highlight as mention even if user not found (for visual consistency)
          parts.push({ 
            type: 'mention', 
            content: match[0],
            user: { id: '', name: mentionedName, email: '' }
          })
        }
      } else if (type === 'url') {
        // Add URL as text part (will be rendered as link in JSX)
        parts.push({ type: 'text', content: match[0] })
      }
      
      lastIndex = index + match[0].length
    }
    
    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({ type: 'text', content: content.substring(lastIndex) })
    }
    
    return parts.length > 0 ? parts : [{ type: 'text', content }]
  }

  // Handle input change with @mention detection
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setMessageInput(value)
    
    // Check for @mention
    const cursorPos = e.target.selectionStart || 0
    const textBeforeCursor = value.substring(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1)
      
      // Check for end of mention: newline, another @, or punctuation
      const endMatch = textAfterAt.match(/[\n@,.;:!?]/)
      if (endMatch && endMatch.index !== undefined) {
        // Mention ended at punctuation/newline/@
        setShowMentionSuggestions(false)
        handleTyping()
        return
      }
      
      // Check if mention ends with a space followed by text
      // This means the mention is likely complete
      const spaceMatch = textAfterAt.match(/\s+(\S)/)
      if (spaceMatch && spaceMatch.index !== undefined) {
        const textBeforeSpace = textAfterAt.substring(0, spaceMatch.index).trim()
        const textAfterSpace = textAfterAt.substring(spaceMatch.index + spaceMatch[0].length)
        
        // If there's text after the space, check if the text before space matches a user
        if (textBeforeSpace && textAfterSpace) {
          // Check if any user name starts with or equals the text before the space
          const matchingUser = users.find(u => {
            const lowerName = (u?.name ?? '').toLowerCase()
            const lowerBeforeSpace = (textBeforeSpace ?? '').toLowerCase()
            return lowerName === lowerBeforeSpace || lowerName.startsWith(lowerBeforeSpace + ' ')
          })
          
          if (matchingUser) {
            // Still might be typing the full name, show suggestions
            setMentionQuery(textBeforeSpace.toLowerCase())
            setShowMentionSuggestions(true)
            setMentionPosition({ start: lastAtIndex, end: lastAtIndex + 1 + spaceMatch.index })
            handleTyping()
            return
          } else {
            // No match, mention is complete
            setShowMentionSuggestions(false)
            handleTyping()
            return
          }
        }
      }
      
      // Still in mention - show suggestions
      const mentionText = textAfterAt.trim()
      setMentionQuery(mentionText.toLowerCase())
      setShowMentionSuggestions(true)
      setMentionPosition({ start: lastAtIndex, end: cursorPos })
      handleTyping()
      return
    }
    
    // Not in a mention
    setShowMentionSuggestions(false)
    handleTyping()
  }

  // Insert mention into input
  const insertMention = (user: User) => {
    if (!inputRef.current) return
    
    const input = inputRef.current
    const value = messageInput
    const beforeMention = value.substring(0, mentionPosition.start)
    const afterMention = value.substring(mentionPosition.end)
    const newValue = `${beforeMention}@${user.name} ${afterMention}`
    
    setMessageInput(newValue)
    setShowMentionSuggestions(false)
    setMentionQuery('')
    
    // Focus input and set cursor position after the mention
    setTimeout(() => {
      input.focus()
      const newCursorPos = beforeMention.length + user.name.length + 2 // +2 for @ and space
      input.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  // Filter users for mention suggestions
  const mentionSuggestions = users.filter(user => 
    (user?.name ?? '').toLowerCase().includes(mentionQuery) &&
    user.id !== currentUserId
  ).slice(0, 5)

  const sendMessage = async () => {
    if (!socket || !activeChannel) return
    
    // Don't send if no message and no file
    if (!messageInput.trim() && !selectedFile) return

    try {
      let messageContent = messageInput.trim()
      
      // If there's a file, upload it first
      if (selectedFile) {
        setUploadingFile(true)
        const formData = new FormData()
        formData.append('file', selectedFile)
        
        // Create a temporary message ID to attach file to
        const tempMessageId = `temp-${Date.now()}`
        formData.append('message_id', tempMessageId)
        
        const uploadRes = await fetch('/api/chat/attachments', {
          method: 'POST',
          credentials: 'include',
          body: formData
        })
        
        if (!uploadRes.ok) {
          throw new Error('Failed to upload file')
        }
        
        const response = await uploadRes.json()
        const attachment = response.data || response
        
        // Send message with attachment reference
        socket.emit('send_message', {
          channelId: activeChannel,
          content: messageContent || `📎 ${selectedFile.name}`,
          attachment: attachment
        })
        
        setSelectedFile(null)
        setUploadingFile(false)
      } else {
        // Send text-only message
        socket.emit('send_message', {
          channelId: activeChannel,
          content: messageContent
        })
      }

      setMessageInput('')
      setShowMentionSuggestions(false)
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
      setUploadingFile(false)
    }
  }
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error('File size must be less than 10MB')
      return
    }
    
    setSelectedFile(file)
  }
  
  const removeSelectedFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }
  
  const isImageFile = (mimeType: string) => {
    return mimeType.startsWith('image/')
  }

  const handleTyping = () => {
    if (!socket || !activeChannel) return
    socket.emit('typing', { channelId: activeChannel })
  }

  const handleStopTyping = () => {
    if (!socket || !activeChannel) return
    socket.emit('stop_typing', { channelId: activeChannel })
  }

  const confirmClearChannel = async () => {
    const targetChannelId = channelToClear || activeChannel
    if (!targetChannelId) return
    
    try {
      const res = await fetch(`/api/chat/channels/${targetChannelId}/messages`, {
        method: 'DELETE',
        credentials: 'include'
      })
      
      if (res.ok) {
        // Only clear messages if this is the active channel
        if (targetChannelId === activeChannel) {
          setMessages([])
        }
        setShowClearChannelDialog(false)
        setChannelToClear(null)
      } else {
        const data = await res.json()
        toast.error(data.message || 'Failed to clear channel')
      }
    } catch (err) {
      console.error('Error clearing channel:', err)
      toast.error('Failed to clear channel')
    }
  }

  // Reaction handlers
  const toggleReaction = async (messageId: string, emoji: string) => {
    try {
      // Check if user already reacted with this emoji
      const message = messages.find(m => m.id === messageId)
      const userReaction = message?.reactions?.find(r => r.user_id === currentUserId && r.emoji === emoji)
      
      if (userReaction) {
        // Remove reaction
        const res = await fetch(`/api/chat/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, {
          method: 'DELETE',
          credentials: 'include'
        })
        
        if (!res.ok) {
          toast.error('Failed to remove reaction')
        }
      } else {
        // Add reaction
        const res = await fetch(`/api/chat/messages/${messageId}/reactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ emoji })
        })
        
        if (!res.ok) {
          toast.error('Failed to add reaction')
        }
      }
    } catch (err) {
      console.error('Error toggling reaction:', err)
      toast.error('Failed to update reaction')
    }
  }

  // Message editing handlers
  const startEditing = (message: Message) => {
    setEditingMessageId(message.id)
    setEditingContent(message.content)
  }

  const cancelEditing = () => {
    setEditingMessageId(null)
    setEditingContent('')
  }

  const saveEdit = async (messageId: string) => {
    if (!editingContent.trim()) return
    
    try {
      const res = await fetch(`/api/chat/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: editingContent })
      })
      
      if (res.ok) {
        cancelEditing()
      } else {
        const data = await res.json()
        toast.error(data.message || 'Failed to edit message')
      }
    } catch (err) {
      console.error('Error editing message:', err)
      toast.error('Failed to edit message')
    }
  }

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, messageId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveEdit(messageId)
    } else if (e.key === 'Escape') {
      cancelEditing()
    }
  }

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const deleteChannel = (channelId?: string) => {
    const targetChannelId = channelId || activeChannel
    if (!targetChannelId) return
    
    const channelData = channels.find(c => c.id === targetChannelId)
    if (!channelData) return
    
    // Only admins can delete the company-wide channel
    if (channelData.type === 'company' && userRole !== 'admin') {
      toast.warning('Only admins can delete the company-wide channel')
      return
    }
    
    setChannelToDelete(targetChannelId)
    setShowDeleteChannelDialog(true)
  }

  const clearChannel = (channelId?: string) => {
    const targetChannelId = channelId || activeChannel
    if (!targetChannelId) return
    
    const channelData = channels.find(c => c.id === targetChannelId)
    if (!channelData) return
    
    setChannelToClear(targetChannelId)
    setShowClearChannelDialog(true)
  }

  const openAddMemberDialog = async (channel: Channel) => {
    setChannelForMember(channel)
    setSelectedMemberId('')
    setChannelMembers([])
    setShowAddMemberDialog(true)
    setLoadingChannelMembers(true)
    try {
      const res = await fetch(`/api/chat/channels/${channel.id}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        const members = data.data?.members ?? data.members ?? []
        setChannelMembers(members.map((m: { user_id: string; name?: string; email?: string }) => ({
          user_id: String(m.user_id),
          name: m.name ?? '',
          email: m.email ?? ''
        })))
      }
    } catch {
      // keep members empty on error
    } finally {
      setLoadingChannelMembers(false)
    }
  }

  const addMemberToChannel = async () => {
    if (!channelForMember) return
    if (!selectedMemberId) {
      toast.error('Please select a user to add')
      return
    }

    try {
      const res = await fetch(`/api/chat/channels/${channelForMember.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: selectedMemberId })
      })

      if (res.ok) {
        toast.success('Member added to channel')
        setShowAddMemberDialog(false)
        setChannelForMember(null)
        setSelectedMemberId('')
        // Refresh channels so the new member sees it next time they load
        // (current user’s channel list doesn’t change)
        const channelsRes = await fetch('/api/chat/channels', { credentials: 'include' })
        if (channelsRes.ok) {
          const channelsResponse = await channelsRes.json()
          const channelsData = channelsResponse.data?.channels || channelsResponse.channels || []
          setChannels(channelsData)
        }
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.message || 'Failed to add member')
      }
    } catch (err) {
      console.error('Error adding member to channel:', err)
      toast.error('Failed to add member')
    }
  }

  const confirmDeleteChannel = async () => {
    if (!channelToDelete) return
    
    try {
      const res = await fetch(`/api/chat/channels/${channelToDelete}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      
      if (res.ok) {
        // Reload channels
        const channelsRes = await fetch('/api/chat/channels', { credentials: 'include' })
        if (channelsRes.ok) {
          const channelsResponse = await channelsRes.json()
          const channels = channelsResponse.data?.channels || channelsResponse.channels || []
          setChannels(channels)
          
          // If deleted channel was active, switch to first available channel or clear
          if (activeChannel === channelToDelete) {
            if (channels.length > 0) {
              setActiveChannel(channels[0].id)
            } else {
              setActiveChannel(null)
            }
            setMessages([])
          }
        }
        
        setShowDeleteChannelDialog(false)
        setChannelToDelete(null)
        
        // Notify socket to refresh channels
        if (socket) {
          socket.emit('join_channels')
        }
      } else {
        const data = await res.json()
        toast.error(data.message || 'Failed to delete channel')
      }
    } catch (err) {
      console.error('Error deleting channel:', err)
      toast.error('Failed to delete channel')
    }
  }

  const createChannel = async () => {
    if (!newChannelData.name.trim()) {
      toast.error('Channel name is required')
      return
    }

    if (newChannelData.type === 'project' && !newChannelData.projectId) {
      toast.error('Project is required for project channels')
      return
    }

    if (newChannelData.type === 'team' && !newChannelData.department) {
      toast.error('Department is required for team channels')
      return
    }

    if (newChannelData.type === 'group' && newChannelData.selectedUserIds.length === 0) {
      toast.error('Please select at least one user for the custom group')
      return
    }

    try {
      const res = await fetch('/api/chat/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newChannelData.name.trim(),
          type: newChannelData.type,
          projectId: newChannelData.type === 'project' ? newChannelData.projectId : null,
          department: newChannelData.type === 'team' ? newChannelData.department : null,
          userIds: newChannelData.type === 'group' ? newChannelData.selectedUserIds : null
        })
      })

      if (res.ok) {
        const response = await res.json()
        const channel = response.data?.channel || response.channel
        // Reload channels
        const channelsRes = await fetch('/api/chat/channels', { credentials: 'include' })
        if (channelsRes.ok) {
          const channelsResponse = await channelsRes.json()
          const channels = channelsResponse.data?.channels || channelsResponse.channels || []
          setChannels(channels)
          // Switch to the new channel
          if (channel) {
            setActiveChannel(channel.id)
            if (socket) {
              socket.emit('join_channels')
            }
          }
        }
        // Reset form and close dialog
        setNewChannelData({ name: '', type: 'team', projectId: '', department: '', selectedUserIds: [] })
        setShowCreateChannelDialog(false)
        toast.success('Channel created successfully')
      } else {
        const errorData = await res.json().catch(() => ({ message: 'Failed to create channel' }))
        toast.error(errorData.message || 'Failed to create channel')
      }
    } catch (err) {
      console.error('Error creating channel:', err)
      toast.error('Failed to create channel')
    }
  }

  const toggleUserSelection = (userId: string) => {
    setNewChannelData(prev => {
      const isSelected = prev.selectedUserIds.includes(userId)
      return {
        ...prev,
        selectedUserIds: isSelected
          ? prev.selectedUserIds.filter(id => id !== userId)
          : [...prev.selectedUserIds, userId]
      }
    })
  }

  // Handle keyboard for mention suggestions
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showMentionSuggestions && mentionSuggestions.length > 0) {
      // Handle arrow keys and enter for mention selection
      // This would require additional state for selected index
      // For now, just close on Escape
      if (e.key === 'Escape') {
        setShowMentionSuggestions(false)
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
      handleStopTyping()
    }
  }

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

  const activeChannelData = channels.find(c => c.id === activeChannel)
  const activeChannelName = activeChannelData?.name || 'Chat'

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
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            onClick={() => setShowCreateChannelDialog(true)}
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
            <span>+</span> New
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 16, background: 'var(--bg-secondary)', position: 'relative' }}>
        <div style={{
          display: 'flex',
          flex: 1,
          height: '100%',
          overflow: 'hidden',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          {/* Channels Sidebar */}
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
              const isCompanyChannel = channel.type === 'company'
              // Creator can manage (add members, clear, delete); company/team channels only admins can manage
              const isAdminMaintained = channel.type === 'company' || channel.type === 'team'
              const isCreator = channel.created_by && channel.created_by !== 'system' && String(channel.created_by) === String(currentUserId)
              const canManage = isCreator || (userRole === 'admin' && isAdminMaintained)
              const showClearButton = canManage
              const canManageMembers = canManage
              const showDeleteButton = canManage
              const showMenu = showClearButton || showDeleteButton || canManageMembers
              const isMenuOpen = openMenuChannelId === channel.id
              
              return (
                <div
                  key={channel.id}
                  onClick={() => {
                    setActiveChannel(channel.id)
                    setOpenMenuChannelId(null) // Close menu when clicking channel
                  }}
                  onMouseEnter={() => setHoveredChannelId(channel.id)}
                  onMouseLeave={() => {
                    setHoveredChannelId(null)
                    // Don't close menu on mouse leave - let user click outside
                  }}
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
                      {channel.type === 'company' ? 'Company-wide' : channel.type === 'team' ? 'Team' : channel.type === 'project' ? 'Project' : 'Custom Group'}
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
                              boxShadow: `0 4px 12px var(--shadow-lg)`,
                              zIndex: 1000,
                              minWidth: 160,
                              overflow: 'hidden'
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {canManageMembers && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openAddMemberDialog(channel)
                                  setOpenMenuChannelId(null)
                                }}
                                style={{
                                  width: '100%',
                                  padding: '10px 16px',
                                  background: 'transparent',
                                  border: 'none',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  fontSize: 14,
                                  color: 'var(--text-primary)',
                                  transition: 'background 0.2s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'var(--bg-secondary)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent'
                                }}
                              >
                                Add Member
                              </button>
                            )}
                            {showClearButton && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  clearChannel(channel.id)
                                  setOpenMenuChannelId(null)
                                }}
                                style={{
                                  width: '100%',
                                  padding: '10px 16px',
                                  background: 'transparent',
                                  border: 'none',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  fontSize: 14,
                                  color: 'var(--warning)',
                                  transition: 'background 0.2s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'var(--bg-secondary)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent'
                                }}
                              >
                                Clear Messages
                              </button>
                            )}
                            {showDeleteButton && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteChannel(channel.id)
                                  setOpenMenuChannelId(null)
                                }}
                                style={{
                                  width: '100%',
                                  padding: '10px 16px',
                                  background: 'transparent',
                                  border: 'none',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  fontSize: 14,
                                  color: 'var(--error)',
                                  transition: 'background 0.2s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  borderTop: showClearButton ? '1px solid var(--border)' : 'none'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'var(--bg-secondary)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent'
                                }}
                              >
                                Delete Channel
                              </button>
                            )}
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

        {/* Chat Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '0 8px 8px 0' }}>
          {activeChannel ? (
            <>
              {/* Messages */}
              <div 
                ref={messagesContainerRef}
                style={{ flex: 1, overflow: 'auto', background: 'var(--bg-primary)', position: 'relative' }}
              >
                {/* Scroll to bottom button */}
                {showScrollToBottom && (
                  <button
                    onClick={scrollToBottom}
                    style={{
                      position: 'absolute',
                      bottom: 20,
                      right: 20,
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: 'var(--accent-primary)',
                      color: 'white',
                      border: 'none',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      zIndex: 10,
                      transition: 'transform 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.1)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)'
                    }}
                    title="Scroll to bottom"
                  >
                    ↓
                  </button>
                )}
                <div style={{ padding: '20px 24px' }}>
                  {loadingOlder && (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: '12px',
                      color: 'var(--text-secondary)',
                      fontSize: 14
                    }}>
                      Loading older messages...
                    </div>
                  )}
                {messages.length === 0 ? (
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    height: '100%',
                    gap: 12,
                    padding: 40
                  }}>
                    <div style={{ 
                      marginBottom: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <MessageCircle 
                        size={64} 
                        strokeWidth={1.5}
                        style={{ 
                          color: 'var(--text-tertiary)',
                          opacity: 0.5
                        }}
                      />
                    </div>
                    <div style={{ 
                      fontSize: 18, 
                      fontWeight: 600,
                      color: 'var(--text-primary)'
                    }}>
                      No messages yet
                    </div>
                    <div style={{ 
                      fontSize: 14, 
                      color: 'var(--text-secondary)',
                      textAlign: 'center',
                      maxWidth: 300
                    }}>
                      Start the conversation by sending a message below
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((message, index) => {
                      // Check if current user is mentioned in this message
                      const isMentioned = currentUserId && message.content.includes('@') && 
                        parseMessageContent(message.content).some(part => 
                          part.type === 'mention' && part.user.id === currentUserId
                        )
                      
                      // Check if we need a date separator
                      const showDateSeparator = index === 0 || 
                        formatMessageDate(messages[index - 1].created_at) !== formatMessageDate(message.created_at)
                      
                      return (
                      <React.Fragment key={message.id}>
                        {showDateSeparator && (
                          <div style={{ 
                            textAlign: 'center', 
                            padding: '20px 24px 16px 24px',
                            margin: '-20px -24px 0 -24px',
                            position: 'sticky',
                            top: 0,
                            background: 'var(--bg-primary)',
                            zIndex: 10
                          }}>
                            <span style={{ 
                              padding: '6px 12px',
                              background: 'var(--bg-secondary)',
                              borderRadius: 12,
                              fontSize: 12,
                              fontWeight: 500,
                              color: 'var(--text-secondary)',
                              display: 'inline-block'
                            }}>
                              {formatMessageDate(message.created_at)}
                            </span>
                          </div>
                        )}
                        <div
                        data-message-id={message.id}
                        style={{ 
                          marginBottom: 20,
                          padding: isMentioned ? '12px 16px' : 0,
                          background: isMentioned ? 'var(--accent-primary-light)' : 'transparent',
                          borderRadius: isMentioned ? 8 : 0,
                          borderLeft: isMentioned ? '3px solid var(--accent-primary)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            background: 'var(--accent-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: 15,
                            flexShrink: 0
                          }}>
                            {((message.user_name ?? '') || '?').charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 6 }}>
                              <span style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.2 }}>{message.user_name}</span>
                              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.2 }}>
                                {new Date(message.created_at).toLocaleTimeString('en-GB', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                                {message.edited_at && <span style={{ marginLeft: 4 }}>(edited)</span>}
                              </span>
                              {/* 3-dot menu */}
                              <div style={{ marginLeft: 'auto', position: 'relative' }}>
                                <button
                                  onClick={() => setMessageMenuOpen(messageMenuOpen === message.id ? null : message.id)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '4px 8px',
                                    fontSize: 16,
                                    color: 'var(--text-secondary)',
                                    opacity: messageMenuOpen === message.id ? 1 : 0.6,
                                    transition: 'opacity 0.2s'
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
                                  onMouseLeave={(e) => { if (messageMenuOpen !== message.id) e.currentTarget.style.opacity = '0.6' }}
                                >
                                  ⋯
                                </button>
                                {messageMenuOpen === message.id && (
                                  <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    marginTop: 4,
                                    background: 'var(--surface)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 8,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                    zIndex: 1000,
                                    minWidth: 150,
                                    overflow: 'hidden'
                                  }}>
                                    <button
                                      onClick={() => {
                                        setShowEmojiPicker(showEmojiPicker === message.id ? null : message.id)
                                      }}
                                      style={{
                                        width: '100%',
                                        padding: '10px 16px',
                                        background: 'none',
                                        border: 'none',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        fontSize: 14,
                                        color: 'var(--text)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8
                                      }}
                                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)' }}
                                      onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                                    >
                                      <span>😊</span>
                                      <span>Add Reaction</span>
                                    </button>
                                    {message.user_email === users.find(u => u.id === currentUserId)?.email && (
                                      <button
                                        onClick={() => {
                                          startEditing(message)
                                          setMessageMenuOpen(null)
                                        }}
                                        style={{
                                          width: '100%',
                                          padding: '10px 16px',
                                          background: 'none',
                                          border: 'none',
                                          textAlign: 'left',
                                          cursor: 'pointer',
                                          fontSize: 14,
                                          color: 'var(--text)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 8
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)' }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                                      >
                                        <span>✏️</span>
                                        <span>Edit Message</span>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            {editingMessageId === message.id ? (
                              <div style={{ marginTop: 8 }}>
                                <input
                                  type="text"
                                  value={editingContent}
                                  onChange={(e) => setEditingContent(e.target.value)}
                                  onKeyDown={(e) => handleEditKeyDown(e, message.id)}
                                  autoFocus
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    border: '1px solid var(--accent-primary)',
                                    borderRadius: 6,
                                    fontSize: 14,
                                    background: 'var(--input-bg)',
                                    color: 'var(--input-text)'
                                  }}
                                />
                                <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                                  <button
                                    onClick={() => saveEdit(message.id)}
                                    style={{
                                      padding: '4px 12px',
                                      fontSize: 12,
                                      background: 'var(--accent-primary)',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: 4,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={cancelEditing}
                                    style={{
                                      padding: '4px 12px',
                                      fontSize: 12,
                                      background: 'var(--bg-secondary)',
                                      border: '1px solid var(--border)',
                                      borderRadius: 4,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Cancel
                                  </button>
                                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 8, alignSelf: 'center' }}>
                                    Press Enter to save, Esc to cancel
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div style={{ 
                                  fontSize: 14, 
                                  color: 'var(--text-primary)',
                                  wordBreak: 'break-word',
                                  lineHeight: 1.6
                                }}>
                              {parseMessageContent(message.content).map((part, idx) => {
                                if (part.type === 'mention') {
                                  return (
                                    <span
                                      key={idx}
                                      style={{
                                        background: 'var(--accent-primary-light)',
                                        color: 'var(--accent-primary)',
                                        padding: '2px 6px',
                                        borderRadius: 4,
                                        fontWeight: 600,
                                        margin: '0 2px'
                                      }}
                                      title={`@${part.user.name}`}
                                    >
                                      {part.content}
                                    </span>
                                  )
                                }
                                // Check if text part contains URLs and render them as links
                                const urlRegex = /(https?:\/\/[^\s]+)/g
                                const textContent = part.content
                                const urlMatches = textContent.match(urlRegex)
                                
                                if (urlMatches && urlMatches.length > 0) {
                                  // Split text by URLs and render links
                                  const elements: React.ReactElement[] = []
                                  let lastIndex = 0
                                  
                                  urlMatches.forEach((url, urlIdx) => {
                                    const urlIndex = textContent.indexOf(url, lastIndex)
                                    
                                    // Add text before URL
                                    if (urlIndex > lastIndex) {
                                      elements.push(
                                        <span key={`text-${idx}-${urlIdx}`}>
                                          {textContent.substring(lastIndex, urlIndex)}
                                        </span>
                                      )
                                    }
                                    
                                    // Add URL as clickable link
                                    elements.push(
                                      <a
                                        key={`url-${idx}-${urlIdx}`}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          color: 'var(--accent-primary)',
                                          textDecoration: 'underline',
                                          wordBreak: 'break-all'
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {url}
                                      </a>
                                    )
                                    
                                    lastIndex = urlIndex + url.length
                                  })
                                  
                                  // Add remaining text after last URL
                                  if (lastIndex < textContent.length) {
                                    elements.push(
                                      <span key={`text-end-${idx}`}>
                                        {textContent.substring(lastIndex)}
                                      </span>
                                    )
                                    
                                    return <>{elements}</>
                                  }
                                }
                                
                                return <span key={idx}>{part.content}</span>
                              })}
                                </div>
                                
                                {/* Attachments */}
                                {message.attachments && message.attachments.length > 0 && (
                                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {message.attachments.map(attachment => {
                                      const isImage = isImageFile(attachment.mime_type)
                                      return (
                                        <div key={attachment.id} style={{ 
                                          maxWidth: isImage ? 400 : '100%',
                                          display: 'inline-block'
                                        }}>
                                          {isImage ? (
                                            <div style={{ position: 'relative' }}>
                                              <img
                                                src={attachment.path}
                                                alt={attachment.original_filename}
                                                style={{
                                                  maxWidth: '100%',
                                                  maxHeight: 300,
                                                  borderRadius: 8,
                                                  cursor: 'pointer',
                                                  border: '1px solid var(--border)'
                                                }}
                                                onClick={() => window.open(attachment.path, '_blank')}
                                              />
                                              <div style={{
                                                fontSize: 12,
                                                color: 'var(--text-secondary)',
                                                marginTop: 4
                                              }}>
                                                {attachment.original_filename}
                                              </div>
                                            </div>
                                          ) : (
                                            <a
                                              href={`/api/chat/attachments/${attachment.id}/download`}
                                              download={attachment.original_filename}
                                              style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                padding: '12px 16px',
                                                background: 'var(--surface-secondary)',
                                                border: '1px solid var(--border)',
                                                borderRadius: 8,
                                                textDecoration: 'none',
                                                color: 'var(--text)',
                                                transition: 'background 0.2s'
                                              }}
                                              onMouseEnter={(e) => {
                                                e.currentTarget.style.background = 'var(--bg-secondary)'
                                              }}
                                              onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'var(--surface-secondary)'
                                              }}
                                            >
                                              <span style={{ fontSize: 24 }}>📎</span>
                                              <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ 
                                                  fontSize: 14,
                                                  fontWeight: 500,
                                                  overflow: 'hidden',
                                                  textOverflow: 'ellipsis',
                                                  whiteSpace: 'nowrap'
                                                }}>
                                                  {attachment.original_filename}
                                                </div>
                                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                                                  {(attachment.size / 1024).toFixed(1)} KB
                                                </div>
                                              </div>
                                              <span style={{ color: 'var(--accent-primary)', fontSize: 20 }}>↓</span>
                                            </a>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                                
                                {/* Reactions */}
                                <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                                  {message.reactions && message.reactions.length > 0 && (
                                    <>
                                      {/* Group reactions by emoji */}
                                      {Object.entries(
                                        message.reactions.reduce((acc, r) => {
                                          acc[r.emoji] = acc[r.emoji] || []
                                          acc[r.emoji].push(r)
                                          return acc
                                        }, {} as Record<string, Reaction[]>)
                                      ).map(([emoji, reactions]) => {
                                        const hasUserReacted = reactions.some(r => r.user_id === currentUserId)
                                        return (
                                          <button
                                            key={emoji}
                                            onClick={() => toggleReaction(message.id, emoji)}
                                            title={reactions.map(r => r.user_name).join(', ')}
                                            style={{
                                              padding: '4px 8px',
                                              fontSize: 14,
                                              background: hasUserReacted ? 'var(--accent-primary-light)' : 'var(--bg-secondary)',
                                              border: `1px solid ${hasUserReacted ? 'var(--accent-primary)' : 'var(--border)'}`,
                                              borderRadius: 12,
                                              cursor: 'pointer',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 4
                                            }}
                                          >
                                            <span>{emoji}</span>
                                            <span style={{ fontSize: 11, fontWeight: 600 }}>{reactions.length}</span>
                                          </button>
                                        )
                                      })}
                                    </>
                                  )}
                                  {/* Emoji picker (shown when triggered from menu) */}
                                  {showEmojiPicker === message.id && (
                                    <div style={{
                                      position: 'relative',
                                      display: 'inline-block'
                                    }}>
                                      <div style={{
                                        position: 'absolute',
                                        bottom: '100%',
                                        left: 0,
                                        marginBottom: 4,
                                        background: 'var(--surface)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 8,
                                        padding: 8,
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                        zIndex: 100,
                                        display: 'flex',
                                        gap: 4
                                      }}>
                                        {['👍', '❤️', '😂', '🎉', '😮', '😢', '🔥', '✅'].map(emoji => (
                                          <button
                                            key={emoji}
                                            onClick={() => {
                                              toggleReaction(message.id, emoji)
                                              setShowEmojiPicker(null)
                                              setMessageMenuOpen(null)
                                            }}
                                            style={{
                                              padding: '4px 8px',
                                              fontSize: 20,
                                              background: 'transparent',
                                              border: 'none',
                                              cursor: 'pointer',
                                              borderRadius: 4
                                            }}
                                            onMouseEnter={(e) => {
                                              e.currentTarget.style.background = 'var(--bg-secondary)'
                                            }}
                                            onMouseLeave={(e) => {
                                              e.currentTarget.style.background = 'transparent'
                                            }}
                                          >
                                            {emoji}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      </React.Fragment>
                      )
                    })}
                    {typingUsers.size > 0 && (
                      <div style={{ 
                        fontSize: 12, 
                        color: 'var(--text-tertiary)', 
                        fontStyle: 'italic',
                        marginTop: 12,
                        paddingLeft: 52
                      }}>
                        {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
                </div>
              </div>

              {/* Input */}
              <div style={{ 
                padding: '16px 20px', 
                borderTop: '1px solid var(--border)',
                background: 'var(--surface)',
                position: 'relative'
              }}>
                {/* Selected File Preview */}
                {selectedFile && (
                  <div style={{
                    marginBottom: 12,
                    padding: '8px 12px',
                    background: 'var(--surface-secondary)',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    <span style={{ fontSize: 14, color: 'var(--text)' }}>📎 {selectedFile.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                    <button
                      onClick={removeSelectedFile}
                      style={{
                        marginLeft: 'auto',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 4,
                        color: 'var(--text-secondary)',
                        fontSize: 18,
                        lineHeight: 1
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
                
                <div style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center'
                }}>
                  {/* File Upload Button */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                    accept="image/*,.pdf,.doc,.docx,.txt"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    style={{
                      background: 'none',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '8px 12px',
                      cursor: uploadingFile ? 'not-allowed' : 'pointer',
                      color: 'var(--text)',
                      fontSize: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      height: '44px'
                    }}
                    title="Attach file"
                  >
                    📎
                  </button>
                  
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      ref={inputRef}
                      type="text"
                      value={messageInput}
                      onChange={handleInputChange}
                      onBlur={() => {
                        handleStopTyping()
                        // Delay hiding suggestions to allow click
                        setTimeout(() => setShowMentionSuggestions(false), 200)
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message... Use @ to mention someone"
                      disabled={uploadingFile}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontSize: 14,
                        background: 'var(--input-bg)',
                        color: 'var(--input-text)',
                        outline: 'none'
                      }}
                    />
                  {/* Mention Suggestions Dropdown */}
                  {showMentionSuggestions && mentionSuggestions.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: 0,
                      right: 0,
                      marginBottom: 8,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      maxHeight: 200,
                      overflow: 'auto',
                      zIndex: 1000
                    }}>
                      {mentionSuggestions.map(user => (
                        <div
                          key={user.id}
                          onClick={() => insertMention(user)}
                          style={{
                            padding: '10px 16px',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--bg-secondary)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent'
                          }}
                        >
                          <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: 'var(--accent-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: 13,
                            flexShrink: 0
                          }}>
                            {((user?.name ?? '') || '?').charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3 }}>{user.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.3 }}>{user.email}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  </div>
                  <button
                    onClick={() => {
                      sendMessage()
                      handleStopTyping()
                    }}
                    disabled={(!messageInput.trim() && !selectedFile) || uploadingFile}
                    style={{
                      padding: '12px 24px',
                      background: (messageInput.trim() || selectedFile) && !uploadingFile ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      cursor: (messageInput.trim() || selectedFile) && !uploadingFile ? 'pointer' : 'not-allowed',
                      fontWeight: 600,
                      fontSize: 14,
                      transition: 'background 0.2s',
                      flexShrink: 0,
                      height: '44px',
                      minWidth: 80
                    }}
                    onMouseEnter={(e) => {
                      if ((messageInput.trim() || selectedFile) && !uploadingFile) {
                        e.currentTarget.style.background = 'var(--accent-primary-hover)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = (messageInput.trim() || selectedFile) && !uploadingFile ? 'var(--accent-primary)' : 'var(--text-tertiary)'
                    }}
                  >
                    {uploadingFile ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'var(--text-secondary)'
            }}>
              Select a channel to start chatting
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Add Member Dialog */}
      {showAddMemberDialog && channelForMember && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}
          onClick={() => {
            setShowAddMemberDialog(false)
            setChannelMembers([])
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 12,
              padding: 24,
              minWidth: 320,
              maxWidth: 400,
              boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
              border: '1px solid var(--border)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, marginBottom: 12, fontSize: 18 }}>
              Add member to <span style={{ color: 'var(--accent-primary)' }}>{channelForMember.name}</span>
            </h3>

            {/* Current channel members */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: 0, marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Current members
              </p>
              {loadingChannelMembers ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>Loading...</p>
              ) : channelMembers.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>No members yet</p>
              ) : (
                <ul style={{
                  margin: 0,
                  padding: '8px 0 0 0',
                  listStyle: 'none',
                  maxHeight: 120,
                  overflowY: 'auto',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--bg-secondary)'
                }}>
                  {channelMembers.map((m, idx) => (
                    <li
                      key={m.user_id}
                      style={{
                        padding: '6px 12px',
                        fontSize: 13,
                        color: 'var(--text-primary)',
                        borderBottom: idx < channelMembers.length - 1 ? '1px solid var(--border)' : 'none'
                      }}
                    >
                      {m.name || m.email || m.user_id}
                      {m.email && m.name ? ` (${m.email})` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p style={{ marginTop: 0, marginBottom: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
              Select a user to add to this channel.
            </p>
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                marginBottom: 16,
                fontSize: 14,
                background: 'var(--surface)'
              }}
            >
              <option value="">Select a user...</option>
              {users
                .filter((u) => !channelMembers.some((m) => String(m.user_id) === String(u.id)))
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email}
                  </option>
                ))}
            </select>
            {users.filter((u) => !channelMembers.some((m) => String(m.user_id) === String(u.id))).length === 0 && !loadingChannelMembers && (
              <p style={{ margin: '-8px 0 16px 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
                All users are already in this channel.
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => {
                  setShowAddMemberDialog(false)
                  setChannelMembers([])
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  cursor: 'pointer',
                  fontSize: 14
                }}
              >
                Cancel
              </button>
              <button
                onClick={addMemberToChannel}
                style={{
                  padding: '8px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'var(--accent-primary)',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500
                }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Channel Dialog */}
      {showCreateChannelDialog && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--modal-backdrop)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowCreateChannelDialog(false)}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 12,
              padding: 24,
              width: '90%',
              maxWidth: 500,
              boxShadow: `0 8px 32px var(--shadow-2xl)`
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 20px 0', fontSize: 20, fontWeight: 600 }}>
              Create New Channel
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
                  Channel Name *
                </label>
                <input
                  type="text"
                  value={newChannelData.name}
                  onChange={(e) => setNewChannelData({ ...newChannelData, name: e.target.value })}
                  placeholder="Enter channel name"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 14,
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
                  Channel Type *
                </label>
                <select
                  value={newChannelData.type}
                  onChange={(e) => setNewChannelData({ 
                    ...newChannelData, 
                    type: e.target.value as 'project' | 'team' | 'company' | 'group',
                    projectId: '',
                    department: '',
                    selectedUserIds: []
                  })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 14,
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer'
                  }}
                >
                  <option value="company">Company-wide</option>
                  <option value="team">Team/Department</option>
                  <option value="project">Project</option>
                  <option value="group">Custom Group</option>
                </select>
              </div>

              {newChannelData.type === 'project' && (
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
                    Project *
                  </label>
                  <select
                    value={newChannelData.projectId}
                    onChange={(e) => setNewChannelData({ ...newChannelData, projectId: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      fontSize: 14,
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer'
                    }}
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
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
                    Department *
                  </label>
                  <select
                    value={newChannelData.department}
                    onChange={(e) => setNewChannelData({ ...newChannelData, department: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      fontSize: 14,
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">Select a department...</option>
                    {departments.map(dept => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {newChannelData.type === 'group' && (
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
                    Select Users * ({newChannelData.selectedUserIds.length} selected)
                  </label>
                  <div style={{
                    maxHeight: 200,
                    overflowY: 'auto',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: 8,
                    background: 'var(--bg-primary)'
                  }}>
                    {users.length === 0 ? (
                      <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-secondary)' }}>
                        Loading users...
                      </div>
                    ) : (
                      users.map(user => {
                        const isSelected = newChannelData.selectedUserIds.includes(user.id)
                        return (
                          <div
                            key={user.id}
                            onClick={() => toggleUserSelection(user.id)}
                            style={{
                              padding: '8px 12px',
                              marginBottom: 4,
                              borderRadius: 4,
                              cursor: 'pointer',
                              background: isSelected ? 'var(--accent-primary)' : 'transparent',
                              color: isSelected ? 'white' : 'var(--text-primary)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.background = 'var(--bg-secondary)'
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.background = 'transparent'
                              }
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleUserSelection(user.id)}
                              style={{ cursor: 'pointer' }}
                            />
                            <div>
                              <div style={{ fontWeight: 500, fontSize: 14 }}>{user.name}</div>
                              {user.email && (
                                <div style={{ fontSize: 12, opacity: 0.8 }}>{user.email}</div>
                              )}
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
                  onClick={() => {
                    setShowCreateChannelDialog(false)
                    setNewChannelData({ name: '', type: 'team', projectId: '', department: '', selectedUserIds: [] })
                  }}
                  style={{
                    padding: '10px 20px',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 500
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={createChannel}
                  style={{
                    padding: '10px 20px',
                    background: 'var(--accent-primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 500,
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--accent-primary-hover)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--accent-primary)'
                  }}
                >
                  Create Channel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Channel Confirmation Dialog */}
      {showDeleteChannelDialog && channelToDelete && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--modal-backdrop)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => {
            setShowDeleteChannelDialog(false)
            setChannelToDelete(null)
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 12,
              padding: 24,
              width: '90%',
              maxWidth: 400,
              boxShadow: `0 8px 32px var(--shadow-2xl)`
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 16px 0', fontSize: 20, fontWeight: 600, color: 'var(--error)' }}>
              Delete Channel
            </h2>
            <p style={{ margin: '0 0 24px 0', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Are you sure you want to delete this channel? This will permanently delete the channel and all its messages. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowDeleteChannelDialog(false)
                  setChannelToDelete(null)
                }}
                style={{
                  padding: '10px 20px',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteChannel}
                style={{
                  padding: '10px 20px',
                  background: 'var(--error)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--error)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--error)'
                }}
              >
                Delete Channel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Channel Confirmation Dialog */}
      {showClearChannelDialog && channelToClear && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--modal-backdrop)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => {
            setShowClearChannelDialog(false)
            setChannelToClear(null)
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 12,
              padding: 24,
              width: '90%',
              maxWidth: 400,
              boxShadow: `0 8px 32px var(--shadow-2xl)`
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 16px 0', fontSize: 20, fontWeight: 600, color: 'var(--warning)' }}>
              Clear Channel Messages
            </h2>
            <p style={{ margin: '0 0 24px 0', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Are you sure you want to clear all messages from this channel? This will permanently delete all messages. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowClearChannelDialog(false)
                  setChannelToClear(null)
                }}
                style={{
                  padding: '10px 20px',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmClearChannel}
                style={{
                  padding: '10px 20px',
                  background: 'var(--warning)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--warning)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--warning)'
                }}
              >
                Clear Messages
              </button>
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
