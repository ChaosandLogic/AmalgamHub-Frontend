'use client'
import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useToast } from '../../components/Toast'
import ConfirmDialog from '../../components/ConfirmDialog'
import { Plus, MoreVertical, Trash2, Palette } from 'lucide-react'
import SortableCard from './SortableCard'
import { apiPost, apiPut, apiDelete } from '../../lib/api/client'

interface TaskList {
  id: string
  board_id: string
  name: string
  position: number
  created_at: string
  archived: number
  color?: string | null
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

interface CardAddedPayload {
  type: 'cardAdded'
  listId: string
  card: TaskCard
}

interface ListProps {
  list: TaskList
  onCardUpdate: (payload?: CardAddedPayload) => void
  dragHandleProps?: any
  canEdit?: boolean // Whether user can edit (create/delete cards)
  droppableRef?: (node: HTMLElement | null) => void // Allow parent (SortableList) to set sortable/droppable ref on this root
  sortableStyle?: CSSProperties // Applied by SortableList so transform/transition are on the same node as the ref
  sortableAttributes?: Record<string, unknown>
}

export default function List({ list, onCardUpdate, dragHandleProps, canEdit = true, droppableRef, sortableStyle, sortableAttributes }: ListProps) {
  const toast = useToast()
  const [showAddCard, setShowAddCard] = useState(false)
  const [newCardTitle, setNewCardTitle] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [listName, setListName] = useState(list.name)
  
  // 8 predefined colors that work in both light and dark modes
  const predefinedColors = [
    '#3b82f6', // Blue
    '#10b981', // Green
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#64748b'  // Slate/Gray
  ]

  // Update listName when list prop changes
  useEffect(() => {
    setListName(list.name)
  }, [list.name])

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: list.id
  })

  // Combine droppable ref with parent ref if provided
  // This ensures both sortable and droppable refs point to the same element
  const setCombinedDroppableRef = (node: HTMLElement | null) => {
    setDroppableRef(node)
    if (droppableRef) {
      droppableRef(node)
    }
  }

  const cardIds = list.cards?.map(c => c.id) || []

  async function createCard() {
    if (!newCardTitle.trim()) {
      toast.error('Card title is required')
      return
    }

    try {
      const maxPosition = list.cards && list.cards.length > 0 
        ? Math.max(...list.cards.map(c => c.position)) 
        : -1

      const data = await apiPost<{ card: TaskCard }>('/api/tasks/cards', {
        list_id: list.id,
        title: newCardTitle,
        position: maxPosition + 1
      }, { defaultErrorMessage: 'Failed to create card' })
      const newCard = data.card
      if (!newCard) throw new Error('Invalid response format')
      onCardUpdate({ type: 'cardAdded', listId: list.id, card: { ...newCard, labels: newCard.labels || [], members: newCard.members || [] } })
      setNewCardTitle('')
      setShowAddCard(false)
      toast.success('Card created')
    } catch (error) {
      console.error('Error creating card:', error)
      toast.error('Failed to create card')
    }
  }

  async function deleteList() {
    try {
      await apiDelete(`/api/tasks/lists/${list.id}`, { defaultErrorMessage: 'Failed to delete list' })
      toast.success('List deleted')
      onCardUpdate()
    } catch (error) {
      console.error('Error deleting list:', error)
      toast.error('Failed to delete list')
    } finally {
      setShowDeleteConfirm(false)
      setShowMenu(false)
    }
  }

  async function updateListName() {
    if (!listName.trim()) {
      toast.error('List name is required')
      setListName(list.name)
      setIsEditingName(false)
      return
    }

    if (listName.trim() === list.name) {
      setIsEditingName(false)
      return
    }

    try {
      await apiPut(`/api/tasks/lists/${list.id}`, { name: listName.trim() }, { defaultErrorMessage: 'Failed to update list name' })
      toast.success('List name updated')
      setIsEditingName(false)
      onCardUpdate()
    } catch (error) {
      console.error('Error updating list name:', error)
      toast.error('Failed to update list name')
      setListName(list.name)
      setIsEditingName(false)
    }
  }

  async function updateListColor(color: string | null) {
    try {
      await apiPut(`/api/tasks/lists/${list.id}`, { color }, { defaultErrorMessage: 'Failed to update list color' })
      toast.success('List color updated')
      setShowColorPicker(false)
      setShowMenu(false)
      onCardUpdate()
    } catch (error) {
      console.error('Error updating list color:', error)
      toast.error('Failed to update list color')
    }
  }

  // Don't sort - use the order from the array as it comes from the parent
  // Sorting by position can cause snap-back if positions haven't been updated yet
  // The parent (Board) maintains the correct order during drag operations
  const sortedCards = list.cards || []

  return (
    <>
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete List"
        message={`Are you sure you want to delete "${list.name}"? This will also delete all cards in this list. This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        onConfirm={deleteList}
        onCancel={() => {
          setShowDeleteConfirm(false)
          setShowMenu(false)
        }}
      />
      
      {/* Color Picker Dialog */}
      {showColorPicker && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1000
            }}
            onClick={() => setShowColorPicker(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: 24,
              right: 0,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 1001,
              padding: 12,
              minWidth: 200
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
              Select Color
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
              {predefinedColors.map(color => (
                <button
                  key={color}
                  onClick={() => updateListColor(color)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 6,
                    border: list.color === color ? '3px solid var(--accent-primary)' : '2px solid var(--border)',
                    background: color,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: list.color === color ? '0 2px 8px rgba(0,0,0,0.2)' : 'none'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'scale(1.1)'
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'scale(1)'
                    e.currentTarget.style.boxShadow = list.color === color ? '0 2px 8px rgba(0,0,0,0.2)' : 'none'
                  }}
                  title={color}
                />
              ))}
            </div>
            <button
              onClick={() => updateListColor(null)}
              style={{
                width: '100%',
                padding: '6px 12px',
                background: list.color === null ? 'var(--accent-primary-light)' : 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 6,
                cursor: 'pointer',
                color: 'var(--text-primary)',
                fontSize: 12,
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => {
                if (list.color !== null) {
                  e.currentTarget.style.background = 'var(--bg-tertiary)'
                }
              }}
              onMouseLeave={e => {
                if (list.color !== null) {
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              Remove Color
            </button>
          </div>
        </>
      )}
    <div
      ref={setCombinedDroppableRef}
      style={{
        minWidth: 280,
        maxWidth: 280,
        background: isOver ? 'var(--accent-primary-light)' : 'var(--surface-elevated)',
        borderRadius: 12,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        height: 'fit-content',
        maxHeight: '100%',
        transition: 'background 0.2s ease, border 0.2s ease, box-shadow 0.2s ease',
        border: isOver 
          ? '2px dashed var(--accent-primary)' 
          : '1px solid var(--border)',
        boxShadow: isOver 
          ? '0 4px 12px rgba(0, 0, 0, 0.1)' 
          : '0 2px 8px rgba(0, 0, 0, 0.08)',
        ...(sortableStyle || {})
      }}
      {...(sortableAttributes || {})}
    >
      {/* List Header */}
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          marginBottom: 12,
          padding: '4px 0', // Add vertical padding to increase drag area
          cursor: (dragHandleProps && canEdit && !isEditingName) ? 'grab' : 'default',
          userSelect: 'none',
          minHeight: 40 // Ensure minimum height for easier dragging
        }}
        {...(canEdit && dragHandleProps && !isEditingName ? dragHandleProps : {})}
      >
        {isEditingName && canEdit ? (
          <input
            type="text"
            value={listName}
            onChange={e => setListName(e.target.value)}
            onBlur={updateListName}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                updateListName()
              } else if (e.key === 'Escape') {
                setListName(list.name)
                setIsEditingName(false)
              }
            }}
            autoFocus
            style={{
              flex: 1,
              margin: 0,
              padding: '4px 8px',
              fontSize: 16,
              fontWeight: 600,
              border: '2px solid var(--accent-primary)',
              borderRadius: 4,
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              outline: 'none'
            }}
            onClick={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
          />
        ) : (
          <h3 
            style={{ 
              margin: 0, 
              fontSize: 16, 
              fontWeight: 600, 
              flex: 1,
              padding: '6px 12px',
              borderRadius: 6,
              background: list.color || 'transparent',
              color: list.color ? '#ffffff' : 'var(--text-primary)',
              transition: 'background 0.2s ease, color 0.2s ease',
              pointerEvents: 'auto'
            }}
            onDoubleClick={(e) => {
              if (canEdit) {
                e.preventDefault()
                e.stopPropagation()
                setIsEditingName(true)
              }
            }}
            title={canEdit ? 'Double-click to edit, drag to reorder' : ''}
          >
            {list.name}
          </h3>
        )}
        {canEdit && (
          <div style={{ position: 'relative', flexShrink: 0, marginLeft: 8 }}>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setShowMenu(!showMenu)
              }}
              onPointerDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onDragStart={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              style={{
                padding: 6,
                background: 'transparent',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s',
                minWidth: 28,
                minHeight: 28
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--bg-tertiary)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <MoreVertical size={16} />
            </button>
            {showMenu && (
            <>
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 1000
                }}
                onClick={() => setShowMenu(false)}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 24,
                  right: 0,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  zIndex: 1001,
                  minWidth: 160,
                  padding: 4
                }}
              >
                <button
                  onClick={() => {
                    setShowColorPicker(true)
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--bg-tertiary)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <Palette size={16} />
                  List Color
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(true)
                    setShowMenu(false)
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    color: 'var(--error)',
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--bg-tertiary)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <Trash2 size={16} />
                  Delete List
                </button>
              </div>
            </>
          )}
        </div>
        )}
      </div>

      {/* Cards */}
      <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 8 }}>
          {sortedCards.map(card => (
            <SortableCard
              key={card.id}
              card={card}
              onUpdate={onCardUpdate}
              canEdit={canEdit}
            />
          ))}
        </div>
      </SortableContext>

      {/* Add Card - only show if user can edit */}
      {canEdit && showAddCard ? (
        <div>
          <textarea
            value={newCardTitle}
            onChange={e => setNewCardTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                createCard()
              } else if (e.key === 'Escape') {
                setShowAddCard(false)
                setNewCardTitle('')
              }
            }}
            placeholder="Enter a title for this card..."
            autoFocus
            rows={3}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 14,
              resize: 'none',
              marginBottom: 8,
              fontFamily: 'inherit'
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={createCard}
              style={{
                padding: '6px 12px',
                background: 'var(--success)',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13
              }}
            >
              Add Card
            </button>
            <button
              onClick={() => {
                setShowAddCard(false)
                setNewCardTitle('')
              }}
              style={{
                padding: '6px 12px',
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : canEdit ? (
        <button
          onClick={() => setShowAddCard(true)}
          style={{
            width: '100%',
            padding: '8px',
            background: 'transparent',
            border: 'none',
            borderRadius: 6,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'background 0.2s'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--bg-tertiary)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <Plus size={16} />
          Add a card
        </button>
      ) : null}
    </div>
    </>
  )
}
