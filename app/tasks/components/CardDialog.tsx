'use client'
import { useEffect, useState } from 'react'
import { useToast } from '../../components/Toast'
import LoadingSpinner from '../../components/LoadingSpinner'
import { X, Calendar, Tag, UserPlus, Save, Archive } from 'lucide-react'
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api/client'

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
  name: string
  color: string
}

interface PresetLabel {
  name: string
  color: string
}

interface TaskCardMember {
  id: string
  card_id: string
  user_id: string
  user_name: string
  user_email: string
  created_at: string
}

interface CardDialogProps {
  cardId: string
  onClose: () => void
}

const LABEL_COLORS = [
  '#ef4444', '#f59e0b', '#10b981', '#3b82f6', 
  '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'
]

export default function CardDialog({ cardId, onClose }: CardDialogProps) {
  const toast = useToast()
  const [card, setCard] = useState<TaskCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [showLabelPicker, setShowLabelPicker] = useState(false)
  const [presetLabels, setPresetLabels] = useState<PresetLabel[]>([])
  const [selectedLabelName, setSelectedLabelName] = useState<string>('')

  // Handle keyboard events - prevent spacebar from closing dialog when typing
  // This must be called before any conditional returns to maintain hook order
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle spacebar
      if (e.key === ' ' || e.code === 'Space') {
        const target = e.target as HTMLElement
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
        
        if (isInput) {
          // When typing in an input, prevent the event from reaching KeyboardSensor
          // but allow the default behavior (typing space) to work
          e.stopPropagation()
          // Don't prevent default - we want the space to be typed
          return
        }
        
        // If spacebar pressed outside inputs, prevent default to avoid accidental drags/closes
        // This prevents the KeyboardSensor from @dnd-kit from activating
        e.preventDefault()
        e.stopPropagation()
      }
    }

    // Use capture phase to intercept before KeyboardSensor
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [])

  useEffect(() => {
    loadCard()
    loadPresetLabels()
  }, [cardId])

  async function loadPresetLabels() {
    try {
      const data = await apiGet<{ labels: any[] }>('/api/tasks/labels')
      setPresetLabels(data.labels || [])
    } catch (error) {
      console.error('Error loading preset labels:', error)
    }
  }

  async function loadCard() {
    try {
      const data = await apiGet<{ card: any }>(`/api/tasks/cards/${cardId}`, { defaultErrorMessage: 'Failed to load card' })
      const card = data.card
      if (card) {
        setCard(card)
        setTitle(card.title)
        setDescription(card.description || '')
        setDueDate(card.due_date ? card.due_date.substring(0, 10) : '')
      }
    } catch (error) {
      console.error('Error loading card:', error)
      toast.error('Failed to load card')
    } finally {
      setLoading(false)
    }
  }

  async function saveCard() {
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }

    setSaving(true)
    try {
      await apiPut(`/api/tasks/cards/${cardId}`, {
        title,
        description: description || null,
        due_date: dueDate || null
      }, { defaultErrorMessage: 'Failed to update card' })
      toast.success('Card updated')
      onClose()
    } catch (error) {
      console.error('Error saving card:', error)
      toast.error('Failed to save card')
    } finally {
      setSaving(false)
    }
  }

  async function addLabel() {
    if (!selectedLabelName) {
      toast.error('Please select a label')
      return
    }
    if (card?.labels && card.labels.some((l: TaskLabel) => l.name === selectedLabelName)) {
      toast.error('Label already added')
      return
    }
    try {
      await apiPost(`/api/tasks/cards/${cardId}/labels`, { label_name: selectedLabelName }, { defaultErrorMessage: 'Failed to add label' })
      await loadCard()
      setSelectedLabelName('')
      setShowLabelPicker(false)
      toast.success('Label added')
    } catch (error) {
      console.error('Error adding label:', error)
      toast.error('Failed to add label')
    }
  }

  async function removeLabel(label: TaskLabel) {
    try {
      await apiDelete(`/api/tasks/cards/${cardId}/labels/${encodeURIComponent(label.name)}`, { defaultErrorMessage: 'Failed to remove label' })
      await loadCard()
      toast.success('Label removed')
    } catch (error) {
      console.error('Error removing label:', error)
      toast.error('Failed to remove label')
    }
  }

  async function archiveCard() {
    if (!confirm('Are you sure you want to archive this card? It will be hidden from the board.')) {
      return
    }
    try {
      await apiDelete(`/api/tasks/cards/${cardId}`, { defaultErrorMessage: 'Failed to archive card' })
      toast.success('Card archived')
      onClose()
    } catch (error) {
      console.error('Error archiving card:', error)
      toast.error('Failed to archive card')
    }
  }

  if (loading) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--modal-backdrop)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 12,
            padding: 24,
            maxWidth: '600px',
            width: '90vw',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 48 }}>
            <LoadingSpinner size={32} />
            <span style={{ color: 'var(--text-secondary)' }}>Loading...</span>
          </div>
        </div>
      </div>
    )
  }

  if (!card) {
    return null
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--modal-backdrop)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 12,
          padding: 24,
          maxWidth: '600px',
          width: '90vw',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, flex: 1 }}>Card Details</h2>
          <button
            onClick={onClose}
            style={{
              padding: 4,
              background: 'transparent',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Title */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => {
              // Prevent spacebar from propagating to KeyboardSensor
              if (e.key === ' ' || e.code === 'Space') {
                e.stopPropagation()
              }
            }}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 14
            }}
          />
        </div>

        {/* Description */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
            Description
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            onKeyDown={e => {
              // Prevent spacebar from propagating to KeyboardSensor
              if (e.key === ' ' || e.code === 'Space') {
                e.stopPropagation()
              }
            }}
            rows={6}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 14,
              resize: 'vertical',
              fontFamily: 'inherit'
            }}
            placeholder="Add a more detailed description..."
          />
        </div>

        {/* Due Date */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
            <Calendar size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
            Due Date
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 14
            }}
          />
        </div>

        {/* Labels */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Tag size={14} />
            <label style={{ fontSize: 13, fontWeight: 500 }}>Labels</label>
          </div>
          
          {/* Existing Labels */}
          {card.labels && card.labels.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {card.labels.map(label => (
                <div
                  key={label.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 8px',
                    background: label.color,
                    color: 'white',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 500
                  }}
                >
                  {label.name}
                  <button
                    onClick={() => removeLabel(label)}
                    style={{
                      padding: 0,
                      background: 'transparent',
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add Label */}
          {showLabelPicker ? (
            <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 6 }}>
              <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                Select a label
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 8 }}>
                {presetLabels.map(label => {
                  const isAlreadyAdded = card?.labels && card.labels.some(l => l.name === label.name)
                  const isSelected = selectedLabelName === label.name
                  
                  return (
                    <button
                      key={label.name}
                      onClick={() => setSelectedLabelName(label.name)}
                      disabled={isAlreadyAdded}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 10px',
                        marginBottom: 4,
                        border: isSelected ? '2px solid var(--accent-primary)' : '2px solid transparent',
                        borderRadius: 4,
                        background: 'var(--surface)',
                        cursor: isAlreadyAdded ? 'not-allowed' : 'pointer',
                        opacity: isAlreadyAdded ? 0.5 : 1,
                        textAlign: 'left',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 20,
                          borderRadius: 4,
                          background: label.color
                        }}
                      />
                      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                        {label.name}
                      </span>
                      {isAlreadyAdded && (
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>
                          Already added
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={addLabel}
                  disabled={!selectedLabelName}
                  style={{
                    padding: '6px 12px',
                    background: selectedLabelName ? 'var(--success)' : 'var(--text-tertiary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: selectedLabelName ? 'pointer' : 'not-allowed',
                    fontSize: 12
                  }}
                >
                  Add Label
                </button>
                <button
                  onClick={() => {
                    setShowLabelPicker(false)
                    setSelectedLabelName('')
                  }}
                  style={{
                    padding: '6px 12px',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 12
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowLabelPicker(true)}
              style={{
                padding: '6px 12px',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Tag size={14} />
              Add Label
            </button>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', marginTop: 24 }}>
          <button
            onClick={archiveCard}
            style={{
              padding: '10px 20px',
              border: '1px solid var(--error)',
              borderRadius: 6,
              background: 'transparent',
              color: 'var(--error)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 14
            }}
          >
            <Archive size={16} />
            Archive
          </button>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={saveCard}
              disabled={!title.trim() || saving}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: 6,
                background: title.trim() && !saving ? 'var(--success)' : 'var(--text-tertiary)',
                color: 'white',
                cursor: title.trim() && !saving ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
