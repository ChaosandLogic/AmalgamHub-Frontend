'use client'
import { useEffect, useState } from 'react'
import { useToast } from '../../components/Toast'
import { Calendar, Users, Paperclip, Check } from 'lucide-react'
import { apiPut } from '../../lib/api/client'
import CardDialog from './CardDialog'

interface TaskCard {
  id: string
  list_id: string
  title: string
  description?: string
  position: number
  due_date?: string
  created_by: string
  created_at: string
  updated_at: string
  archived: number
  /** 1 / true when the card has been ticked off; renders the title with a strike-through. */
  completed?: number | boolean
  project_id?: string
  resource_id?: string
  labels?: TaskLabel[]
  members?: TaskCardMember[]
  attachments?: TaskCardAttachment[]
}

interface TaskLabel {
  id: string
  card_id: string
  name: string
  color: string
  created_at: string
}

interface TaskCardMember {
  id: string
  card_id: string
  user_id: string
  user_name: string
  user_email: string
  created_at: string
}

interface TaskCardAttachment {
  id: string
  original_filename: string
  mime_type?: string
  path?: string
}

interface CardProps {
  card: TaskCard
  onUpdate: () => void
  isDragging?: boolean
}

export default function Card({ card, onUpdate, isDragging = false }: CardProps) {
  const toast = useToast()
  const [showDialog, setShowDialog] = useState(false)
  // Optimistic override of `card.completed` so the tick feels instant while the
  // PUT is in flight. Cleared whenever the parent passes a fresh card payload.
  const [completedOverride, setCompletedOverride] = useState<boolean | null>(null)
  const [savingCompleted, setSavingCompleted] = useState(false)

  const serverCompleted = !!card.completed
  const isCompleted = completedOverride !== null ? completedOverride : serverCompleted

  useEffect(() => {
    setCompletedOverride(null)
  }, [serverCompleted, card.id, card.updated_at])

  async function toggleCompleted(e: React.MouseEvent) {
    e.stopPropagation()
    if (savingCompleted) return
    const next = !isCompleted
    setCompletedOverride(next)
    setSavingCompleted(true)
    try {
      await apiPut(`/api/tasks/cards/${card.id}`, { completed: next })
      onUpdate()
    } catch (err) {
      console.error('Failed to toggle completed:', err)
      setCompletedOverride(null)
      toast.error('Failed to update task')
    } finally {
      setSavingCompleted(false)
    }
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return ''
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('en-GB')
    } catch {
      return dateStr
    }
  }

  const isOverdue = card.due_date 
    ? new Date(card.due_date) < new Date() && new Date(card.due_date).toDateString() !== new Date().toDateString()
    : false

  const previewAttachment = card.attachments?.find((attachment) => {
    if (!attachment.path) return false
    if (attachment.mime_type?.startsWith('image/')) return true
    return /\.(png|jpe?g|gif|webp|svg)$/i.test(attachment.original_filename)
  })

  return (
    <>
      <div
        onClick={(e) => {
          // Prevent dialog from opening during drag
          if (!isDragging) {
            setShowDialog(true)
          }
        }}
        style={{
          background: 'var(--surface)',
          borderRadius: 10,
          padding: '10px 12px',
          marginBottom: 8,
          border: '1px solid var(--border)',
          cursor: isDragging ? 'grabbing' : 'pointer',
          transition: isDragging ? 'none' : 'all 0.2s ease',
          boxShadow: isDragging 
            ? '0 8px 16px rgba(0,0,0,0.2)' 
            : '0 2px 6px rgba(0,0,0,0.08)',
          touchAction: 'none',
          pointerEvents: isDragging ? 'none' : 'auto'
        }}
        onMouseEnter={e => {
          if (!isDragging) {
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)'
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.borderColor = 'var(--border-strong)'
          }
        }}
        onMouseLeave={e => {
          if (!isDragging) {
            e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)'
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.borderColor = 'var(--border)'
          }
        }}
      >
        {/* Labels */}
        {card.labels && card.labels.length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
            {card.labels.map((label, index) => (
              <div
                key={label.name || index}
                style={{
                  height: 8,
                  borderRadius: 4,
                  background: label.color,
                  minWidth: 40,
                  flex: '0 0 auto'
                }}
                title={label.name}
              />
            ))}
          </div>
        )}

        {/* Title row with completion tick */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
          <button
            type="button"
            onClick={toggleCompleted}
            aria-label={isCompleted ? 'Mark task as not done' : 'Mark task as done'}
            aria-pressed={isCompleted}
            title={isCompleted ? 'Mark as not done' : 'Mark as done'}
            style={{
              flexShrink: 0,
              marginTop: 1,
              width: 18,
              height: 18,
              borderRadius: '50%',
              border: `1.5px solid ${isCompleted ? 'var(--success)' : 'var(--border-strong, var(--border))'}`,
              background: isCompleted ? 'var(--success)' : 'transparent',
              color: '#fff',
              padding: 0,
              cursor: savingCompleted ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s ease, border-color 0.15s ease',
              opacity: savingCompleted ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isCompleted) {
                e.currentTarget.style.borderColor = 'var(--success)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isCompleted) {
                e.currentTarget.style.borderColor = 'var(--border-strong, var(--border))'
              }
            }}
          >
            {isCompleted && <Check size={12} strokeWidth={3} />}
          </button>
          <div
            style={{
              flex: 1,
              fontSize: 14,
              fontWeight: 500,
              color: isCompleted ? 'var(--text-secondary)' : 'var(--text-primary)',
              lineHeight: 1.3,
              textDecoration: isCompleted ? 'line-through' : 'none',
              opacity: isCompleted ? 0.7 : 1,
              transition: 'color 0.15s ease, opacity 0.15s ease',
            }}
          >
            {card.title}
          </div>
        </div>

        {/* Image attachment preview */}
        {previewAttachment?.path && (
          <div style={{ marginBottom: 6 }}>
            <img
              src={previewAttachment.path}
              alt={previewAttachment.original_filename}
              style={{
                width: '100%',
                maxHeight: 96,
                objectFit: 'cover',
                borderRadius: 8,
                border: '1px solid var(--border)'
              }}
              loading="lazy"
            />
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
            {/* Due Date */}
            {card.due_date && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  color: isOverdue ? 'var(--error)' : 'var(--text-secondary)',
                  padding: '2px 6px',
                  background: isOverdue ? 'var(--error-light)' : 'transparent',
                  borderRadius: 4
                }}
              >
                <Calendar size={12} />
                {formatDate(card.due_date)}
              </div>
            )}

            {/* Members */}
            {card.members && card.members.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  color: 'var(--text-secondary)'
                }}
              >
                <Users size={12} />
                {card.members.length}
              </div>
            )}

            {/* Attachments */}
            {card.attachments && card.attachments.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  color: 'var(--text-secondary)'
                }}
              >
                <Paperclip size={12} />
                {card.attachments.length}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Card Detail Dialog */}
      {showDialog && (
        <CardDialog
          cardId={card.id}
          onClose={() => {
            setShowDialog(false)
            onUpdate()
          }}
        />
      )}
    </>
  )
}
