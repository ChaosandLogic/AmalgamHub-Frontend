'use client'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import List from './List'

interface TaskList {
  id: string
  board_id: string
  name: string
  position: number
  created_at: string
  archived: number
  cards?: TaskCard[]
}

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

interface SortableListProps {
  list: TaskList
  onCardUpdate: () => void
  canEdit?: boolean
}

export default function SortableList({ list, onCardUpdate, canEdit = true }: SortableListProps) {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging
  } = useSortable({ 
    id: list.id,
    data: {
      type: 'list',
      list
    }
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  // Pass ref, style and attributes to List's root so the sortable node and the
  // transformed element are the same. Previously the wrapper div had the transform
  // but List overwrote the ref with its inner div, causing misaligned drag/drop.
  return (
    <List
      list={list}
      onCardUpdate={onCardUpdate}
      dragHandleProps={listeners}
      canEdit={canEdit}
      droppableRef={setSortableRef}
      sortableStyle={style}
      sortableAttributes={attributes as unknown as Record<string, unknown>}
    />
  )
}
