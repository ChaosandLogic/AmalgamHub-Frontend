'use client'
import type { CSSProperties } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
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
    setActivatorNodeRef,
    transform,
    isDragging
  } = useSortable({ 
    id: card.id,
    animateLayoutChanges: () => false,
    disabled: !canEdit
  })

  const wrapperStyle: CSSProperties = {
    position: 'relative',
    transform: CSS.Transform.toString(transform),
    transition: 'none',
    opacity: isDragging ? 0 : 1,
    pointerEvents: isDragging ? 'none' : 'auto',
  }

  const handleStyle: CSSProperties = {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
    display: 'flex',
    alignItems: 'center',
    padding: 2,
    borderRadius: 4,
    cursor: isDragging ? 'grabbing' : 'grab',
    color: 'var(--text-tertiary)',
    touchAction: 'none',
  }

  return (
    <div ref={setNodeRef} style={wrapperStyle} className="card-drag-wrapper">
      {/* Drag handle — listeners live here only so clicking the rest of the
          card never starts a drag and won't freeze the card mid-edit. */}
      {canEdit && (
        <div
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          style={handleStyle}
          className="card-drag-handle"
          title="Drag to reorder"
        >
          <GripVertical size={14} />
        </div>
      )}
      <Card card={card} onUpdate={onUpdate} isDragging={isDragging} />
    </div>
  )
}
