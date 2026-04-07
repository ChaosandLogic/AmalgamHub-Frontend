'use client'
import { useEffect, useRef, useState } from 'react'
import { Socket } from 'socket.io-client'
import { useToast } from '../../components/Toast'
import { apiPostFormData } from '../../lib/api/client'
import { MAX_UPLOAD_BYTES } from '../../lib/constants/ui'
import type { ChatUser } from '../../lib/types/chat'

interface MessageInputProps {
  activeChannel: string | null
  socket: Socket | null
  users: ChatUser[]
  currentUserId: string | null
  /** Changes whenever the active channel changes, triggering an auto-focus */
  focusTrigger: string | null
}

export default function MessageInput({
  activeChannel,
  socket,
  users,
  currentUserId,
  focusTrigger,
}: MessageInputProps) {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [messageInput, setMessageInput] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false)
  const [mentionPosition, setMentionPosition] = useState({ start: 0, end: 0 })

  useEffect(() => {
    if (focusTrigger && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [focusTrigger])

  const mentionSuggestions = users.filter(user =>
    (user?.name ?? '').toLowerCase().includes(mentionQuery) &&
    user.id !== currentUserId
  ).slice(0, 5)

  const handleTyping = () => {
    if (!socket || !activeChannel) return
    socket.emit('typing', { channelId: activeChannel })
  }

  const handleStopTyping = () => {
    if (!socket || !activeChannel) return
    socket.emit('stop_typing', { channelId: activeChannel })
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setMessageInput(value)
    const cursorPos = e.target.selectionStart || 0
    const textBeforeCursor = value.substring(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1)
      const endMatch = textAfterAt.match(/[\n@,.;:!?]/)
      if (endMatch && endMatch.index !== undefined) {
        setShowMentionSuggestions(false)
        handleTyping()
        return
      }
      const spaceMatch = textAfterAt.match(/\s+(\S)/)
      if (spaceMatch && spaceMatch.index !== undefined) {
        const textBeforeSpace = textAfterAt.substring(0, spaceMatch.index).trim()
        const textAfterSpace = textAfterAt.substring(spaceMatch.index + spaceMatch[0].length)
        if (textBeforeSpace && textAfterSpace) {
          const matchingUser = users.find(u => {
            const lowerName = (u?.name ?? '').toLowerCase()
            const lowerBeforeSpace = (textBeforeSpace ?? '').toLowerCase()
            return lowerName === lowerBeforeSpace || lowerName.startsWith(lowerBeforeSpace + ' ')
          })
          if (matchingUser) {
            setMentionQuery(textBeforeSpace.toLowerCase())
            setShowMentionSuggestions(true)
            setMentionPosition({ start: lastAtIndex, end: lastAtIndex + 1 + spaceMatch.index })
          } else {
            setShowMentionSuggestions(false)
          }
          handleTyping()
          return
        }
      }
      const mentionText = textAfterAt.trim()
      setMentionQuery(mentionText.toLowerCase())
      setShowMentionSuggestions(true)
      setMentionPosition({ start: lastAtIndex, end: cursorPos })
      handleTyping()
      return
    }
    setShowMentionSuggestions(false)
    handleTyping()
  }

  const insertMention = (user: ChatUser) => {
    if (!inputRef.current) return
    const beforeMention = messageInput.substring(0, mentionPosition.start)
    const afterMention = messageInput.substring(mentionPosition.end)
    const newValue = `${beforeMention}@${user.name} ${afterMention}`
    setMessageInput(newValue)
    setShowMentionSuggestions(false)
    setMentionQuery('')
    setTimeout(() => {
      inputRef.current?.focus()
      const newCursorPos = beforeMention.length + user.name.length + 2
      inputRef.current?.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  const sendMessage = async () => {
    if (!socket || !activeChannel) return
    if (!messageInput.trim() && !selectedFile) return

    try {
      let messageContent = messageInput.trim()

      if (selectedFile) {
        setUploadingFile(true)
        const formData = new FormData()
        formData.append('file', selectedFile)
        const tempMessageId = `temp-${Date.now()}`
        formData.append('message_id', tempMessageId)

        const attachment = await apiPostFormData('/api/chat/attachments', formData, { defaultErrorMessage: 'Failed to upload file' })

        socket.emit('send_message', {
          channelId: activeChannel,
          content: messageContent || `📎 ${selectedFile.name}`,
          attachment
        })
        setSelectedFile(null)
        setUploadingFile(false)
      } else {
        socket.emit('send_message', { channelId: activeChannel, content: messageContent })
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
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error('File size must be less than 10MB')
      return
    }
    setSelectedFile(file)
  }

  const removeSelectedFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showMentionSuggestions && mentionSuggestions.length > 0) {
      if (e.key === 'Escape') setShowMentionSuggestions(false)
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
      handleStopTyping()
    }
  }

  const canSend = (messageInput.trim() || !!selectedFile) && !uploadingFile

  return (
    <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface)', position: 'relative' }}>
      {selectedFile && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--surface-secondary)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, color: 'var(--text)' }}>📎 {selectedFile.name}</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>({(selectedFile.size / 1024).toFixed(1)} KB)</span>
          <button
            onClick={removeSelectedFile}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1 }}
          >✕</button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          accept="image/*,.pdf,.doc,.docx,.txt"
          aria-label="Attach file"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingFile}
          aria-label="Attach file"
          style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 8,
            padding: '8px 12px', cursor: uploadingFile ? 'not-allowed' : 'pointer',
            color: 'var(--text)', fontSize: 20, display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0, height: '44px'
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
              setTimeout(() => setShowMentionSuggestions(false), 200)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... Use @ to mention someone"
            aria-label="Message input"
            disabled={uploadingFile}
            style={{
              width: '100%', padding: '12px 16px', border: '1px solid var(--border)',
              borderRadius: 8, fontSize: 14, background: 'var(--input-bg)',
              color: 'var(--input-text)', outline: 'none'
            }}
          />
          {showMentionSuggestions && mentionSuggestions.length > 0 && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 8,
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: 200, overflow: 'auto', zIndex: 1000
            }}>
              {mentionSuggestions.map(user => (
                <div
                  key={user.id}
                  onClick={() => insertMention(user)}
                  style={{
                    padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 600, fontSize: 13, flexShrink: 0
                  }}>
                    {(user.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{user.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{user.email}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={sendMessage}
          disabled={!canSend}
          style={{
            padding: '12px 20px', background: canSend ? 'var(--accent-primary)' : 'var(--text-tertiary)',
            color: 'white', border: 'none', borderRadius: 8,
            cursor: canSend ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 600,
            transition: 'all 0.2s', flexShrink: 0, height: '44px', minWidth: 80
          }}
          onMouseEnter={(e) => { if (canSend) e.currentTarget.style.background = 'var(--accent-primary-hover)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = canSend ? 'var(--accent-primary)' : 'var(--text-tertiary)' }}
        >
          {uploadingFile ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  )
}
