'use client'
import { useState } from 'react'
import { useToast } from '../../components/Toast'
import { Calendar, Users } from 'lucide-react'
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
  project_id?: string
  resource_id?: string
  labels?: TaskLabel[]
  members?: TaskCardMember[]
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

interface CardProps {
  card: TaskCard
  onUpdate: () => void
  isDragging?: boolean
}

export default function Card({ card, onUpdate, isDragging = false }: CardProps) {
  const toast = useToast()
  const [showDialog, setShowDialog] = useState(false)

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
          padding: 14,
          marginBottom: 10,
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
          <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
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

        {/* Title */}
        <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
          {card.title}
        </div>

        {/* Description preview */}
        {card.description && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.4 }}>
            {card.description.length > 100 
              ? card.description.substring(0, 100) + '...' 
              : card.description}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
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
