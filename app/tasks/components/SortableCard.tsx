'use client'
import type { CSSProperties } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Card from './Card'

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

interface SortableCardProps {
  card: TaskCard
  onUpdate: () => void
  canEdit?: boolean
}

export default function SortableCard({ card, onUpdate, canEdit = true }: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ 
    id: card.id,
    animateLayoutChanges: () => false, // Disable automatic layout animations
    disabled: !canEdit // Disable drag if user can't edit
  })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: 'none', // Completely disable transitions to prevent snap-back
    opacity: isDragging ? 0 : 1, // Hide completely during drag (overlay shows it)
    cursor: canEdit ? (isDragging ? 'grabbing' : 'grab') : 'default',
    pointerEvents: isDragging ? 'none' : 'auto'
  }

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes}
      {...(canEdit ? listeners : {})}
    >
      <Card card={card} onUpdate={onUpdate} isDragging={isDragging} />
    </div>
  )
}
