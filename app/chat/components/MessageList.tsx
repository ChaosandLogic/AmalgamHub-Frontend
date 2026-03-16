'use client'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { MessageCircle } from 'lucide-react'
import { Socket } from 'socket.io-client'
import { useToast } from '../../components/Toast'
import { apiDelete, apiPost, apiPatch } from '../../lib/api/client'
import type { ChatMessage, ChatUser, ChatReaction } from '../../lib/types/chat'

type MessagePart =
  | { type: 'text'; content: string }
  | { type: 'mention'; content: string; user: ChatUser }

interface MessageListProps {
  messages: ChatMessage[]
  currentUserId: string | null
  users: ChatUser[]
  loadingOlder: boolean
  hasMoreMessages: boolean
  typingUsers: Set<string>
  activeChannel: string | null
  socket: Socket | null
  loadMessages: (channelId: string, before: string | null, isInitial: boolean) => Promise<void>
}

export default function MessageList({
  messages,
  currentUserId,
  users,
  loadingOlder,
  hasMoreMessages,
  typingUsers,
  activeChannel,
  socket,
  loadMessages,
}: MessageListProps) {
  const toast = useToast()
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [messageMenuOpen, setMessageMenuOpen] = useState<string | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container || !activeChannel) return

    const handleScroll = () => {
      if (!loadingOlder && hasMoreMessages && container.scrollTop < 200) {
        const oldestMessage = messages[0]
        if (oldestMessage) {
          loadMessages(activeChannel, oldestMessage.created_at, false)
        }
      }
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
      setShowScrollToBottom(!isNearBottom)
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [activeChannel, messages, hasMoreMessages, loadingOlder, loadMessages])

  const formatMessageDate = (date: string) => {
    const messageDate = new Date(date)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (messageDate.toDateString() === today.toDateString()) return 'Today'
    if (messageDate.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return messageDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const parseMessageContent = useCallback((content: string): MessagePart[] => {
    if (!content) return [{ type: 'text', content: '' }]
    const parts: MessagePart[] = []
    const mentionRegex = /@([^\s@\n][^@\n]*?)(?=\s|$|@|\n|[,.;:!?])/g
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const allMatches: Array<{ type: 'mention' | 'url'; match: RegExpMatchArray; index: number }> = []
    let match
    mentionRegex.lastIndex = 0
    while ((match = mentionRegex.exec(content)) !== null) {
      allMatches.push({ type: 'mention', match, index: match.index })
    }
    urlRegex.lastIndex = 0
    while ((match = urlRegex.exec(content)) !== null) {
      allMatches.push({ type: 'url', match, index: match.index })
    }
    allMatches.sort((a, b) => a.index - b.index)
    let lastIndex = 0
    for (const { type, match: m, index } of allMatches) {
      if (index > lastIndex) {
        parts.push({ type: 'text', content: content.substring(lastIndex, index) })
      }
      if (type === 'mention') {
        const mentionedName = m[1].trim()
        const user = users.length > 0
          ? users.find(u => (u?.name ?? '').toLowerCase() === (mentionedName ?? '').toLowerCase())
          : null
        parts.push({
          type: 'mention',
          content: m[0],
          user: user ?? { id: '', name: mentionedName, email: '' }
        })
      } else {
        parts.push({ type: 'text', content: m[0] })
      }
      lastIndex = index + m[0].length
    }
    if (lastIndex < content.length) {
      parts.push({ type: 'text', content: content.substring(lastIndex) })
    }
    return parts.length > 0 ? parts : [{ type: 'text', content }]
  }, [users])

  const toggleReaction = async (messageId: string, emoji: string) => {
    try {
      const message = messages.find(m => m.id === messageId)
      const userReaction = message?.reactions?.find(r => r.user_id === currentUserId && r.emoji === emoji)
      if (userReaction) {
        await apiDelete(`/api/chat/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`)
      } else {
        await apiPost(`/api/chat/messages/${messageId}/reactions`, { emoji })
      }
    } catch {
      toast.error('Failed to update reaction')
    }
  }

  const startEditing = (message: ChatMessage) => {
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
      await apiPatch(`/api/chat/messages/${messageId}`, { content: editingContent })
      cancelEditing()
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : null) || 'Failed to edit message')
    }
  }

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, messageId: string) => {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit(messageId) }
    else if (e.key === 'Escape') { cancelEditing() }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const isImageFile = (mimeType: string) => mimeType.startsWith('image/')

  const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🎉']

  return (
    <div
      ref={messagesContainerRef}
      style={{ flex: 1, overflow: 'auto', background: 'var(--bg-primary)', position: 'relative' }}
    >
      {showScrollToBottom && (
        <button
          onClick={scrollToBottom}
          style={{
            position: 'absolute', bottom: 20, right: 20,
            width: 40, height: 40, borderRadius: '50%',
            background: 'var(--accent-primary)', color: 'white',
            border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 20, zIndex: 10,
            transition: 'transform 0.2s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          title="Scroll to bottom"
        >
          ↓
        </button>
      )}
      <div style={{ padding: '20px 24px' }}>
        {loadingOlder && (
          <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text-secondary)', fontSize: 14 }}>
            Loading older messages...
          </div>
        )}
        {messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, padding: 40 }}>
            <MessageCircle size={64} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)', opacity: 0.5 }} />
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>No messages yet</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 300 }}>
              Start the conversation by sending a message below
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const isMentioned = currentUserId && message.content.includes('@') &&
                parseMessageContent(message.content).some(part =>
                  part.type === 'mention' && part.user.id === currentUserId
                )
              const showDateSeparator = index === 0 ||
                formatMessageDate(messages[index - 1].created_at) !== formatMessageDate(message.created_at)
              const currentUserEmail = users.find(u => u.id === currentUserId)?.email

              return (
                <React.Fragment key={message.id}>
                  {showDateSeparator && (
                    <div style={{
                      textAlign: 'center', padding: '20px 24px 16px 24px',
                      margin: '-20px -24px 0 -24px', position: 'sticky',
                      top: 0, background: 'var(--bg-primary)', zIndex: 10
                    }}>
                      <span style={{
                        padding: '6px 12px', background: 'var(--bg-secondary)',
                        borderRadius: 12, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)',
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
                        width: 40, height: 40, borderRadius: '50%',
                        background: 'var(--accent-primary)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 600, fontSize: 15, flexShrink: 0
                      }}>
                        {((message.user_name ?? '') || '?').charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.2 }}>{message.user_name}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.2 }}>
                            {new Date(message.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            {message.edited_at && <span style={{ marginLeft: 4 }}>(edited)</span>}
                          </span>
                          <div style={{ marginLeft: 'auto', position: 'relative' }}>
                            <button
                              onClick={() => setMessageMenuOpen(messageMenuOpen === message.id ? null : message.id)}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                padding: '4px 8px', fontSize: 16, color: 'var(--text-secondary)',
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
                                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                                background: 'var(--surface)', border: '1px solid var(--border)',
                                borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                zIndex: 1000, minWidth: 150, overflow: 'hidden'
                              }}>
                                <button
                                  onClick={() => setShowEmojiPicker(showEmojiPicker === message.id ? null : message.id)}
                                  style={{
                                    width: '100%', padding: '10px 16px', background: 'none', border: 'none',
                                    textAlign: 'left', cursor: 'pointer', fontSize: 14, color: 'var(--text)',
                                    display: 'flex', alignItems: 'center', gap: 8
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)' }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                                >
                                  <span>😊</span><span>Add Reaction</span>
                                </button>
                                {message.user_email === currentUserEmail && (
                                  <button
                                    onClick={() => { startEditing(message); setMessageMenuOpen(null) }}
                                    style={{
                                      width: '100%', padding: '10px 16px', background: 'none', border: 'none',
                                      textAlign: 'left', cursor: 'pointer', fontSize: 14, color: 'var(--text)',
                                      display: 'flex', alignItems: 'center', gap: 8
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)' }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                                  >
                                    <span>✏️</span><span>Edit Message</span>
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
                                width: '100%', padding: '8px 12px',
                                border: '1px solid var(--accent-primary)', borderRadius: 6,
                                fontSize: 14, background: 'var(--input-bg)', color: 'var(--input-text)'
                              }}
                            />
                            <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                              <button
                                onClick={() => saveEdit(message.id)}
                                style={{ padding: '4px 12px', fontSize: 12, background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                              >Save</button>
                              <button
                                onClick={cancelEditing}
                                style={{ padding: '4px 12px', fontSize: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
                              >Cancel</button>
                              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 8, alignSelf: 'center' }}>
                                Press Enter to save, Esc to cancel
                              </span>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div style={{ fontSize: 14, color: 'var(--text-primary)', wordBreak: 'break-word', lineHeight: 1.6 }}>
                              {parseMessageContent(message.content).map((part, idx) => {
                                if (part.type === 'mention') {
                                  return (
                                    <span
                                      key={idx}
                                      style={{
                                        background: 'var(--accent-primary-light)', color: 'var(--accent-primary)',
                                        padding: '2px 6px', borderRadius: 4, fontWeight: 600, margin: '0 2px'
                                      }}
                                      title={`@${part.user.name}`}
                                    >
                                      {part.content}
                                    </span>
                                  )
                                }
                                const urlRegex = /(https?:\/\/[^\s]+)/g
                                const textContent = part.content
                                const urlMatches = textContent.match(urlRegex)
                                if (urlMatches && urlMatches.length > 0) {
                                  const elements: React.ReactElement[] = []
                                  let lastIdx = 0
                                  urlMatches.forEach((url, urlIdx) => {
                                    const urlIndex = textContent.indexOf(url, lastIdx)
                                    if (urlIndex > lastIdx) {
                                      elements.push(<span key={`t-${idx}-${urlIdx}`}>{textContent.substring(lastIdx, urlIndex)}</span>)
                                    }
                                    elements.push(
                                      <a key={`u-${idx}-${urlIdx}`} href={url} target="_blank" rel="noopener noreferrer"
                                        style={{ color: 'var(--accent-primary)', textDecoration: 'underline', wordBreak: 'break-all' }}
                                        onClick={(e) => e.stopPropagation()}
                                      >{url}</a>
                                    )
                                    lastIdx = urlIndex + url.length
                                  })
                                  if (lastIdx < textContent.length) {
                                    elements.push(<span key={`te-${idx}`}>{textContent.substring(lastIdx)}</span>)
                                  }
                                  return <React.Fragment key={idx}>{elements}</React.Fragment>
                                }
                                return <span key={idx}>{part.content}</span>
                              })}
                            </div>

                            {message.attachments && message.attachments.length > 0 && (
                              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {message.attachments.map(attachment => {
                                  const isImage = isImageFile(attachment.mime_type)
                                  return (
                                    <div key={attachment.id} style={{ maxWidth: isImage ? 400 : '100%', display: 'inline-block' }}>
                                      {isImage ? (
                                        <div style={{ position: 'relative' }}>
                                          <img
                                            src={attachment.path}
                                            alt={attachment.original_filename}
                                            style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border)' }}
                                            onClick={() => window.open(attachment.path, '_blank')}
                                          />
                                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                                            {attachment.original_filename}
                                          </div>
                                        </div>
                                      ) : (
                                        <a
                                          href={`/api/chat/attachments/${attachment.id}/download`}
                                          download={attachment.original_filename}
                                          style={{
                                            display: 'flex', alignItems: 'center', gap: 8,
                                            padding: '12px 16px', background: 'var(--surface-secondary)',
                                            border: '1px solid var(--border)', borderRadius: 8,
                                            textDecoration: 'none', color: 'var(--text)', transition: 'background 0.2s'
                                          }}
                                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)' }}
                                          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-secondary)' }}
                                        >
                                          <span style={{ fontSize: 24 }}>📎</span>
                                          <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

                            <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                              {message.reactions && message.reactions.length > 0 && (
                                <>
                                  {Object.entries(
                                    message.reactions.reduce((acc, r) => {
                                      acc[r.emoji] = acc[r.emoji] || []
                                      acc[r.emoji].push(r)
                                      return acc
                                    }, {} as Record<string, ChatReaction[]>)
                                  ).map(([emoji, reactions]) => {
                                    const hasUserReacted = reactions.some(r => r.user_id === currentUserId)
                                    return (
                                      <button
                                        key={emoji}
                                        onClick={() => toggleReaction(message.id, emoji)}
                                        title={reactions.map(r => r.user_name).join(', ')}
                                        style={{
                                          padding: '4px 8px', fontSize: 14,
                                          background: hasUserReacted ? 'var(--accent-primary-light)' : 'var(--bg-secondary)',
                                          border: `1px solid ${hasUserReacted ? 'var(--accent-primary)' : 'var(--border)'}`,
                                          borderRadius: 12, cursor: 'pointer',
                                          display: 'flex', alignItems: 'center', gap: 4
                                        }}
                                      >
                                        <span>{emoji}</span>
                                        <span style={{ fontSize: 11, fontWeight: 600 }}>{reactions.length}</span>
                                      </button>
                                    )
                                  })}
                                </>
                              )}
                              {showEmojiPicker === message.id && (
                                <div style={{
                                  position: 'absolute', zIndex: 1001, background: 'var(--surface)',
                                  border: '1px solid var(--border)', borderRadius: 8,
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: 8
                                }}>
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    {EMOJI_LIST.map(emoji => (
                                      <button
                                        key={emoji}
                                        onClick={() => { toggleReaction(message.id, emoji); setShowEmojiPicker(null); setMessageMenuOpen(null) }}
                                        style={{ padding: '4px 8px', fontSize: 20, background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 4 }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)' }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
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
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic', marginTop: 12, paddingLeft: 52 }}>
                {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
    </div>
  )
}
