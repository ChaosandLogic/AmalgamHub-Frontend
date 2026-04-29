'use client'
import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useToast } from '../../components/Toast'
import { useUser } from '../../lib/hooks/useUser'
import { Plus } from 'lucide-react'
import { apiGet, apiPatch, apiPost, apiPut } from '../../lib/api/client'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  type CollisionDetection,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable'
import SortableList from './SortableList'
import List from './List'
import Card from './Card'

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

interface BoardProps {
  boardId: string
  boardName: string
  onBoardRenamed?: (name: string) => void
}

export default function Board({ boardId, boardName, onBoardRenamed }: BoardProps) {
  const toast = useToast()
  const { user } = useUser()
  const [lists, setLists] = useState<TaskList[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddList, setShowAddList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [activeCard, setActiveCard] = useState<TaskCard | null>(null)
  const [activeList, setActiveList] = useState<TaskList | null>(null)
  const [editingBoardTitle, setEditingBoardTitle] = useState(false)
  const [boardTitleDraft, setBoardTitleDraft] = useState(boardName)
  const [savingBoardTitle, setSavingBoardTitle] = useState(false)
  const boardTitleInputRef = useRef<HTMLInputElement>(null)
  // Track the final drag position to avoid race conditions
  const lastDragOverRef = useRef<{ activeId: string; overId: string } | null>(null)
  // Store the original lists state at drag start to calculate correct positions
  const originalListsRef = useRef<TaskList[]>([])
  // Track the last valid overCard during drag (not the dragged card itself)
  const lastValidOverCardRef = useRef<{ cardId: string; listId: string } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 12 // Increased from 8 to make it less sensitive
      }
    }),
    useSensor(KeyboardSensor)
  )

  // Create a stable empty array reference to avoid dependency array size changes
  const emptySensors = useMemo(() => [], [])

  const loadBoard = useCallback(async () => {
    try {
      const data = await apiGet<{ board: { lists: TaskList[] } }>(`/api/tasks/boards/${boardId}`, { defaultErrorMessage: 'Failed to load board' })
      setLists(data.board?.lists || [])
    } catch (error) {
      console.error('Error loading board:', error)
      toast.error('Failed to load board')
    } finally {
      setLoading(false)
    }
  }, [boardId, toast])

  useEffect(() => {
    loadBoard()
  }, [loadBoard])

  useEffect(() => {
    setBoardTitleDraft(boardName)
  }, [boardName])

  useEffect(() => {
    setEditingBoardTitle(false)
  }, [boardId])

  async function saveBoardTitle() {
    const trimmed = boardTitleDraft.trim()
    if (!trimmed) {
      toast.error('Board name is required')
      setBoardTitleDraft(boardName)
      setEditingBoardTitle(false)
      return
    }
    if (trimmed === boardName) {
      setEditingBoardTitle(false)
      return
    }
    setSavingBoardTitle(true)
    try {
      const data = await apiPut<{ board: { name: string } }>(
        `/api/tasks/boards/${boardId}`,
        { name: trimmed },
        { defaultErrorMessage: 'Failed to rename board' }
      )
      const newName = data.board?.name ?? trimmed
      onBoardRenamed?.(newName)
      toast.success('Board renamed')
      setEditingBoardTitle(false)
    } catch (error) {
      console.error('Error renaming board:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to rename board')
      setBoardTitleDraft(boardName)
      setEditingBoardTitle(false)
    } finally {
      setSavingBoardTitle(false)
    }
  }

  async function createList() {
    if (!newListName.trim()) {
      toast.error('List name is required')
      return
    }

    try {
      const maxPosition = lists.length > 0 ? Math.max(...lists.map(l => l.position)) : -1
      const data = await apiPost<{ list: TaskList }>('/api/tasks/lists', {
        board_id: boardId,
        name: newListName,
        position: maxPosition + 1
      }, { defaultErrorMessage: 'Failed to create list' })
      const newList = { ...data.list, cards: [] }
      if (!newList.id) throw new Error('Invalid response format')
      setLists(prev => [...prev, newList].sort((a, b) => a.position - b.position))
      setNewListName('')
      setShowAddList(false)
      toast.success('List created')
    } catch (error) {
      console.error('Error creating list:', error)
      toast.error('Failed to create list')
    }
  }

  type CardUpdatePayload = { type: 'cardAdded'; listId: string; card: TaskCard } | void

  async function handleCardUpdate(payload?: CardUpdatePayload) {
    // When a new card is added, merge it into current state so we don't overwrite
    // with a full reload (which can revert recently moved cards if there's stale data or race).
    if (payload && typeof payload === 'object' && payload.type === 'cardAdded') {
      setLists(prev =>
        prev.map(l =>
          l.id === payload.listId
            ? { ...l, cards: [...(l.cards || []), payload.card] }
            : l
        )
      )
      return
    }
    await loadBoard()
  }

  function handleDragStart(event: DragStartEvent) {
    const { active } = event
    
    // Store the original lists state for position calculation in handleDragEnd
    originalListsRef.current = JSON.parse(JSON.stringify(lists))
    
    // Clear the last valid overCard from previous drag
    lastValidOverCardRef.current = null
    
    // Check if dragging a card
    const card = findCardById(active.id as string)
    if (card) {
      setActiveCard(card)
      return
    }
    
    // Check if dragging a list
    const list = lists.find(l => l.id === active.id)
    if (list) {
      setActiveList(list)
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string
    
    // Prevent infinite loops - only update if the drag target has changed
    if (lastDragOverRef.current?.activeId === activeId && lastDragOverRef.current?.overId === overId) {
      return
    }
    lastDragOverRef.current = { activeId, overId }

    // Skip if dragging a list (list reordering doesn't need visual feedback during drag)
    if (lists.find(l => l.id === activeId)) {
      return
    }

    // Find the card being dragged
    const activeCard = findCardById(activeId)
    if (!activeCard) return

    // Find the list we're over - could be the list itself or a card within a list
    let overList = lists.find(l => l.id === overId)
    let overCard = null
    
    if (!overList) {
      // Might be over a card, find which list contains it
      overList = lists.find(l => l.cards?.some(c => c.id === overId))
      if (overList) {
        overCard = overList.cards?.find(c => c.id === overId)
      }
    }
    
    // Store the last valid overCard (not the dragged card itself)
    if (overCard && overCard.id !== activeId && overList) {
      lastValidOverCardRef.current = {
        cardId: overCard.id,
        listId: overList.id
      }
    }
    
    if (!overList) return

    const activeList = lists.find(l => l.cards?.some(c => c.id === activeId))
    if (!activeList) return

    // Just update the visual state - we'll calculate the final position in handleDragEnd
    if (activeList.id !== overList.id) {
      // Moving to different list
      setLists(prevLists => {
        const newLists = prevLists.map(list => {
          if (list.id === activeList.id) {
            // Remove card from active list
            return {
              ...list,
              cards: list.cards?.filter(c => c.id !== activeId) || []
            }
          }
          if (list.id === overList.id) {
            // Add card to over list
            const newCards = [...(list.cards || [])]
            if (overCard) {
              const overIndex = newCards.findIndex(c => c.id === overId)
              newCards.splice(overIndex, 0, { ...activeCard, list_id: overList.id })
            } else {
              // Dropping on empty list or at end
              newCards.push({ ...activeCard, list_id: overList.id })
            }
            return {
              ...list,
              cards: newCards
            }
          }
          return list
        })
        return newLists
      })
    } else {
      // Reordering within same list
      if (overCard && activeCard.id !== overCard.id) {
        setLists(prevLists => {
          return prevLists.map(list => {
            if (list.id === activeList.id && list.cards) {
              const oldIndex = list.cards.findIndex(c => c.id === activeId)
              const newIndex = list.cards.findIndex(c => c.id === overId)
              if (oldIndex !== -1 && newIndex !== -1) {
                const reorderedCards = arrayMove(list.cards, oldIndex, newIndex)
                return {
                  ...list,
                  cards: reorderedCards
                }
              }
            }
            return list
          })
        })
      }
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    
    // Clear the drag over tracking
    lastDragOverRef.current = null
    
    // Don't clear activeCard/activeList immediately - keep them until update completes
    // This prevents the card from snapping back to original position

    if (!over) {
      // If dropped outside, revert to original state
      setActiveCard(null)
      setActiveList(null)
      lastValidOverCardRef.current = null
      originalListsRef.current = []
      await loadBoard()
      return
    }

    const activeId = active.id as string
    let overId = over.id as string

    // Handle list reordering
    const activeListIndex = lists.findIndex(l => l.id === activeId)
    const overListIndex = lists.findIndex(l => l.id === overId)
    
    if (activeListIndex !== -1 && overListIndex !== -1 && activeListIndex !== overListIndex) {
      // Reorder lists
      const newLists = arrayMove(lists, activeListIndex, overListIndex)
      setLists(newLists)
      
      // Update positions in database
      try {
        const listsToUpdate = newLists.map((list, index) => ({
          id: list.id,
          position: index
        }))
        
        await apiPatch('/api/tasks/lists/reorder', { lists: listsToUpdate }, { defaultErrorMessage: 'Failed to reorder lists' })
        
        setActiveList(null)
      } catch (error) {
        console.error('Error reordering lists:', error)
        toast.error(error instanceof Error ? error.message : 'Failed to reorder lists')
        setActiveList(null)
        lastValidOverCardRef.current = null
        originalListsRef.current = []
        await loadBoard() // Reload on error
      }
      return
    }

    // Handle card movement
    const activeCard = findCardById(activeId)
    if (!activeCard) {
      console.error('[DragEnd] Active card not found:', activeId)
      setActiveCard(null)
      lastValidOverCardRef.current = null
      originalListsRef.current = []
      await loadBoard()
      return
    }
    
    let overList = lists.find(l => l.id === overId) || 
                   lists.find(l => l.cards?.some(c => c.id === overId))
    
    if (!overList) {
      console.error('[DragEnd] Over list not found for overId:', overId)
      setActiveCard(null)
      lastValidOverCardRef.current = null
      originalListsRef.current = []
      await loadBoard()
      return
    }
    
    let overCard = overList.cards?.find(c => c.id === overId)
    
    // IMPORTANT: Get activeList from ORIGINAL state, not current state
    // Current state has already been modified by handleDragOver
    const originalLists = originalListsRef.current
    const activeList = originalLists.find(l => l.cards?.some(c => c.id === activeId))

    if (!activeList) {
      console.error('[DragEnd] Active list not found in original lists for card:', activeId)
      setActiveCard(null)
      lastValidOverCardRef.current = null
      originalListsRef.current = []
      await loadBoard()
      return
    }
    
    // If we dropped on the same card we're dragging, use the last valid overCard we tracked
    if (!overCard || overCard.id === activeId) {
      if (lastValidOverCardRef.current) {
        const lastOverList = lists.find(l => l.id === lastValidOverCardRef.current!.listId)
        overCard = lastOverList?.cards?.find(c => c.id === lastValidOverCardRef.current!.cardId)
        // Update overId to match the restored card
        if (overCard) {
          overId = overCard.id
        }
        // Update overList to match the last valid target
        if (lastOverList) {
          overList = lastOverList
        }
      }
    }

    // Calculate the final position based on where the card was dropped
    // IMPORTANT: Use the ORIGINAL list state (before handleDragOver visual updates)
    // to calculate the correct position for the backend API
    const targetListId = overList.id
    
    // Find the original target list and source list
    const originalTargetList = originalLists.find(l => l.id === targetListId)
    const originalSourceList = activeList // We already found this above
    
    if (!originalTargetList || !originalSourceList) {
      console.error('[DragEnd] Original target or source list not found!', {
        originalTargetList: !!originalTargetList,
        originalSourceList: !!originalSourceList
      })
      setActiveCard(null)
      lastValidOverCardRef.current = null
      originalListsRef.current = []
      await loadBoard()
      return
    }
    
    const originalTargetCards = originalTargetList.cards || []
    const isSameList = originalTargetList.id === originalSourceList.id
    
    let newPosition = 0
    
    if (overCard && activeCard.id !== overCard.id) {
      // Dropped on a specific card - use that card's position in the ORIGINAL list
      const overCardPosition = originalTargetCards.findIndex(c => c.id === overId)
      
      if (isSameList) {
        // Moving within same list
        // arrayMove(cards, oldIndex, newIndex) moves card FROM oldIndex TO newIndex
        // The newIndex is where the overCard currently is in the visual array
        // We need to find where the card actually ended up after arrayMove
        const currentList = lists.find(l => l.id === targetListId)
        const visualPosition = currentList?.cards?.findIndex(c => c.id === activeId)
        
        if (visualPosition !== undefined && visualPosition !== -1) {
          // Use the actual position from the visual state after arrayMove
          newPosition = visualPosition
        } else {
          // Fallback to original position
          newPosition = overCardPosition
        }
      } else {
        // Moving to different list - target position is just the overCard's position
        newPosition = overCardPosition !== -1 ? overCardPosition : 0
      }
    } else {
      // Dropped on list container (not a specific card) OR dropped on same card (shouldn't happen)
      if (isSameList) {
        // Moving within same list to the end - this shouldn't happen for reordering
        newPosition = originalTargetCards.length - 1
      } else {
        // Moving to different list - add at end
        newPosition = originalTargetCards.length
      }
    }
    
    // Always update if moving to different list or position changed
    const shouldMove = activeList.id !== targetListId || activeCard.position !== newPosition
    if (shouldMove) {
      // Update state optimistically - keep the card in its new position
      // The state is already updated by handleDragOver, so we just need to persist it
      
      try {
        await apiPatch(`/api/tasks/cards/${activeId}/move`, {
          list_id: targetListId,
          position: newPosition
        }, { defaultErrorMessage: 'Failed to move card' })

        await loadBoard()
        setActiveCard(null)
        setActiveList(null)
      } catch (error) {
        console.error('Error moving card:', error)
        toast.error(error instanceof Error ? error.message : 'Failed to move card')
        setActiveCard(null)
        setActiveList(null)
        lastValidOverCardRef.current = null
        originalListsRef.current = []
        // Reload on error to revert to server state
        await loadBoard()
      }
    } else {
      // No change needed
      setActiveCard(null)
      setActiveList(null)
      lastValidOverCardRef.current = null
      originalListsRef.current = []
    }
    
    // Clear the refs
    originalListsRef.current = []
    lastValidOverCardRef.current = null
  }

  function findCardById(cardId: string): TaskCard | null {
    for (const list of lists) {
      const card = list.cards?.find(c => c.id === cardId)
      if (card) return card
    }
    return null
  }

  // Get all card IDs for sortable context
  const allCardIds = lists.flatMap(list => list.cards?.map(c => c.id) || [])
  // Memoize listIds to ensure stable reference for SortableContext
  // Filter out any undefined/null IDs and ensure all lists are included
  const listIds = useMemo(() => {
    return lists.map(l => l.id).filter(id => id != null && id !== '')
  }, [lists])

  // All authenticated users can edit tasks
  const canEdit = true

  // Memoize the sensors array passed to DndContext to ensure stable reference
  const dndSensors = useMemo(() => {
    return sensors
  }, [sensors])

  // Memoize collision detection to prevent infinite render loops
  const collisionDetectionStrategy = useCallback<CollisionDetection>((args) => {
    // Use pointerWithin first to get all droppables under the pointer
    const pointerCollisions = pointerWithin(args)
    
    // If we have collisions, prioritize cards over lists
    if (pointerCollisions.length > 0) {
      // Check if any collision is a card (not a list)
      const cardCollision = pointerCollisions.find(collision => {
        const id = collision.id as string
        // A card ID is one that appears in a list's cards array
        return lists.some(list => list.cards?.some(card => card.id === id))
      })
      
      // If we found a card collision, use only that
      if (cardCollision) {
        return [cardCollision]
      }
    }
    
    // Fall back to closestCorners if pointerWithin returns nothing or only lists
    return closestCorners(args)
  }, [lists])

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
        Loading board...
      </div>
    )
  }

  return (
    <div
      data-task-board
      style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary)', padding: '20px', borderRadius: '12px' }}
    >
      <div data-task-board-title style={{ marginBottom: 20 }}>
        {editingBoardTitle && canEdit ? (
          <input
            ref={boardTitleInputRef}
            type="text"
            value={boardTitleDraft}
            disabled={savingBoardTitle}
            onChange={e => setBoardTitleDraft(e.target.value)}
            onBlur={() => {
              void saveBoardTitle()
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                boardTitleInputRef.current?.blur()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                setBoardTitleDraft(boardName)
                setEditingBoardTitle(false)
              }
            }}
            onClick={e => e.stopPropagation()}
            autoFocus
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 600,
              color: 'var(--text-primary)',
              background: 'var(--surface)',
              border: '1px solid var(--border-strong)',
              borderRadius: 8,
              padding: '4px 10px',
              width: 'min(100%, 560px)',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        ) : (
          <h2
            onClick={() => {
              if (!canEdit) return
              setBoardTitleDraft(boardName)
              setEditingBoardTitle(true)
            }}
            title={canEdit ? 'Click to rename' : undefined}
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 600,
              color: 'var(--text-primary)',
              cursor: canEdit ? 'pointer' : 'default',
              width: 'fit-content',
              borderRadius: 6,
              padding: '2px 4px',
              marginLeft: -4
            }}
          >
            {boardName}
          </h2>
        )}
      </div>

      <DndContext
        sensors={dndSensors}
        collisionDetection={collisionDetectionStrategy}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div data-task-board-scroll style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
          <SortableContext 
            items={listIds} 
            strategy={horizontalListSortingStrategy}
          >
            <div data-task-board-columns style={{ display: 'flex', gap: 20, height: '100%', paddingBottom: 16 }}>
              {lists
                .filter(list => listIds.includes(list.id)) // Only render lists that are in SortableContext
                .map((list, index) => (
                  <SortableList
                    key={list.id}
                    list={list}
                    onCardUpdate={handleCardUpdate}
                    canEdit={canEdit}
                  />
                ))}

              {/* Add List Button */}
              {canEdit && (
              <div style={{ minWidth: 280, maxWidth: 280 }}>
            {showAddList ? (
              <div
                style={{
                  background: 'var(--surface-elevated)',
                  borderRadius: 12,
                  padding: 16,
                  border: '1px solid var(--border)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
                }}
              >
                <input
                  type="text"
                  value={newListName}
                  onChange={e => setNewListName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      createList()
                    } else if (e.key === 'Escape') {
                      setShowAddList(false)
                      setNewListName('')
                    }
                  }}
                  placeholder="Enter list name..."
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 14,
                    marginBottom: 8
                  }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={createList}
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
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowAddList(false)
                      setNewListName('')
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
            ) : (
              <button
                onClick={() => setShowAddList(true)}
                style={{
                  width: '100%',
                  padding: '16px',
                  background: 'var(--surface-elevated)',
                  border: '2px dashed var(--border)',
                  borderRadius: 12,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--accent-primary-light)'
                  e.currentTarget.style.borderColor = 'var(--accent-primary)'
                  e.currentTarget.style.color = 'var(--accent-primary)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.12)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'var(--surface-elevated)'
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.color = 'var(--text-secondary)'
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)'
                }}
              >
                <Plus size={18} />
                Add another list
              </button>
            )}
              </div>
              )}
            </div>
          </SortableContext>
        </div>

        <DragOverlay>
          {activeCard && (
            <div 
              style={{ 
                opacity: 0.9, 
                transform: 'rotate(3deg)',
                boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
                borderRadius: 8,
                maxWidth: 280
              }}
            >
              <Card card={activeCard} onUpdate={() => {}} isDragging={true} />
            </div>
          )}
          {activeList && (
            <div 
              style={{ 
                opacity: 0.9, 
                minWidth: 280, 
                maxWidth: 280,
                boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
                borderRadius: 8
              }}
            >
              <List list={activeList} onCardUpdate={() => {}} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

