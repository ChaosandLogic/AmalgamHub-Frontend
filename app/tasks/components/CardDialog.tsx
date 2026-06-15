'use client'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useToast } from '../../components/Toast'
import LoadingSpinner from '../../components/LoadingSpinner'
import { X, Calendar, Tag, Archive, Paperclip, Download, Trash2, Upload, ListTodo, Plus } from 'lucide-react'
import { apiGet, apiPost, apiPut, apiDelete, apiPostFormData } from '../../lib/api/client'

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
  attachments?: TaskCardAttachment[]
  checklist?: TaskChecklistItem[]
}

interface TaskChecklistItem {
  id: string
  text: string
  done: boolean
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

interface TaskCardAttachment {
  id: string
  filename: string
  original_filename: string
  mime_type: string
  size: number
  path: string
  uploaded_by: string
  created_at: string
}

interface CardDialogProps {
  cardId: string
  onClose: () => void
  /** Called after a successful save so the board can refresh */
  onSaved?: () => void
}

const AUTOSAVE_DEBOUNCE_MS = 650

function serializeCardDraft(
  t: string,
  desc: string,
  dd: string,
  cl: TaskChecklistItem[]
): string {
  return JSON.stringify({
    title: t.trim(),
    description: desc ?? '',
    dueDate: dd ?? '',
    checklist: cl.map(({ id, text, done }) => ({ id, text, done })),
  })
}

function isImageMimeType(mime: string | undefined) {
  return typeof mime === 'string' && /^image\//i.test(mime)
}

function taskAttachmentDownloadPath(cardId: string, attachmentId: string) {
  return `/api/tasks/attachments/${encodeURIComponent(cardId)}/${encodeURIComponent(attachmentId)}/download`
}

function newChecklistItemId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '')
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`.padEnd(32, '0').slice(0, 32)
}

function normalizeChecklistFromApi(raw: unknown): TaskChecklistItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x): x is Record<string, unknown> => x != null && typeof x === 'object')
    .map((x) => ({
      id: typeof x.id === 'string' && x.id ? x.id : newChecklistItemId(),
      text: typeof x.text === 'string' ? x.text : '',
      done: !!x.done,
    }))
}

function AttachmentImagePreview({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      title="Open image"
      style={{
        flexShrink: 0,
        display: 'block',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        lineHeight: 0,
        background: 'var(--bg-secondary)',
      }}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        style={{
          width: 96,
          height: 96,
          objectFit: 'cover',
          display: 'block',
        }}
      />
    </a>
  )
}

const LABEL_COLORS = [
  '#ef4444', '#f59e0b', '#10b981', '#3b82f6', 
  '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'
]

export default function CardDialog({ cardId, onClose, onSaved }: CardDialogProps) {
  const toast = useToast()
  const [card, setCard] = useState<TaskCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [showLabelPicker, setShowLabelPicker] = useState(false)
  const [presetLabels, setPresetLabels] = useState<PresetLabel[]>([])
  const [selectedLabelName, setSelectedLabelName] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [checklist, setChecklist] = useState<TaskChecklistItem[]>([])
  /** After Enter on a line, focus the newly inserted row's text input */
  const [checklistFocusId, setChecklistFocusId] = useState<string | null>(null)

  const draftRef = useRef({ title: '', description: '', dueDate: '', checklist: [] as TaskChecklistItem[] })
  const lastSavedSigRef = useRef('')
  const hasBaselineRef = useRef(false)
  const saveInFlightRef = useRef<Promise<boolean> | null>(null)
  const savedIndicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    draftRef.current = { title, description, dueDate, checklist }
  }, [title, description, dueDate, checklist])

  useLayoutEffect(() => {
    if (loading || !card) return
    if (!hasBaselineRef.current) {
      hasBaselineRef.current = true
      lastSavedSigRef.current = serializeCardDraft(title, description, dueDate, checklist)
    }
  }, [loading, card, title, description, dueDate, checklist])

  const persistDraft = useCallback(
    async (options?: { quietEmptyTitle?: boolean }): Promise<boolean> => {
      if (saveInFlightRef.current) {
        await saveInFlightRef.current.catch(() => {})
      }
      const cur = draftRef.current
      if (!cur.title.trim()) {
        if (!options?.quietEmptyTitle) {
          toast.error('Title is required')
        }
        return false
      }
      const sigNow = serializeCardDraft(cur.title, cur.description, cur.dueDate, cur.checklist)
      if (sigNow === lastSavedSigRef.current) {
        return true
      }

      const promise = (async (): Promise<boolean> => {
        setAutosaveStatus('saving')
        try {
          await apiPut(
            `/api/tasks/cards/${cardId}`,
            {
              title: cur.title.trim(),
              description: cur.description || null,
              due_date: cur.dueDate || null,
              checklist: cur.checklist.map(({ id, text, done }) => ({ id, text, done })),
            },
            { defaultErrorMessage: 'Failed to update card' }
          )
          lastSavedSigRef.current = serializeCardDraft(
            cur.title,
            cur.description,
            cur.dueDate,
            cur.checklist
          )
          setAutosaveStatus('saved')
          onSaved?.()
          if (savedIndicatorTimerRef.current) clearTimeout(savedIndicatorTimerRef.current)
          savedIndicatorTimerRef.current = setTimeout(() => setAutosaveStatus('idle'), 2200)
          return true
        } catch (error) {
          console.error('Error saving card:', error)
          setAutosaveStatus('error')
          toast.error('Failed to save card')
          return false
        }
      })()

      saveInFlightRef.current = promise
      const result = await promise
      saveInFlightRef.current = null
      return result
    },
    [cardId, onSaved, toast]
  )

  useEffect(() => {
    if (loading || !card || !hasBaselineRef.current) return
    const sig = serializeCardDraft(title, description, dueDate, checklist)
    if (sig === lastSavedSigRef.current) return
    if (!title.trim()) return

    const t = window.setTimeout(() => {
      void persistDraft({ quietEmptyTitle: true })
    }, AUTOSAVE_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [title, description, dueDate, checklist, loading, card, persistDraft])

  useEffect(() => {
    return () => {
      if (savedIndicatorTimerRef.current) clearTimeout(savedIndicatorTimerRef.current)
    }
  }, [])

  async function handleCloseRequest() {
    const ok = await persistDraft()
    if (!ok) return
    onClose()
  }

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

  useEffect(() => {
    if (!checklistFocusId) return
    const escaped =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(checklistFocusId)
        : checklistFocusId.replace(/"/g, '\\"')
    const el = document.querySelector<HTMLInputElement>(`[data-checklist-text-id="${escaped}"]`)
    if (el) {
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }
    setChecklistFocusId(null)
  }, [checklist, checklistFocusId])

  async function loadPresetLabels() {
    try {
      const data = await apiGet<{ labels: any[] }>('/api/tasks/labels')
      setPresetLabels(data.labels || [])
    } catch (error) {
      console.error('Error loading preset labels:', error)
    }
  }

  async function loadCard() {
    hasBaselineRef.current = false
    lastSavedSigRef.current = ''
    setAutosaveStatus('idle')
    try {
      const data = await apiGet<{ card: any }>(`/api/tasks/cards/${cardId}`, { defaultErrorMessage: 'Failed to load card' })
      const card = data.card
      if (card) {
        setCard(card)
        setTitle(card.title)
        setDescription(card.description || '')
        setDueDate(card.due_date ? card.due_date.substring(0, 10) : '')
        setChecklist(normalizeChecklistFromApi(card.checklist))
      }
    } catch (error) {
      console.error('Error loading card:', error)
      toast.error('Failed to load card')
    } finally {
      setLoading(false)
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
    await persistDraft({ quietEmptyTitle: true })
    try {
      await apiDelete(`/api/tasks/cards/${cardId}`, { defaultErrorMessage: 'Failed to archive card' })
      toast.success('Card archived')
      onClose()
    } catch (error) {
      console.error('Error archiving card:', error)
      toast.error('Failed to archive card')
    }
  }

  async function uploadAttachment(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      await apiPostFormData(`/api/tasks/cards/${cardId}/attachments`, formData, { defaultErrorMessage: 'Failed to upload file' })
      await loadCard()
      toast.success('File uploaded')
    } catch (error) {
      console.error('Error uploading attachment:', error)
      toast.error('Failed to upload file')
    } finally {
      setUploading(false)
    }
  }

  async function deleteAttachment(attachment: TaskCardAttachment) {
    if (!confirm(`Delete "${attachment.original_filename}"?`)) return
    try {
      await apiDelete(`/api/tasks/cards/${cardId}/attachments/${attachment.id}`, { defaultErrorMessage: 'Failed to delete attachment' })
      await loadCard()
      toast.success('Attachment deleted')
    } catch (error) {
      console.error('Error deleting attachment:', error)
      toast.error('Failed to delete attachment')
    }
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
      onClick={() => void handleCloseRequest()}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Card Details</h2>
            <div style={{ marginTop: 6, minHeight: 18, fontSize: 12, color: 'var(--text-tertiary)' }}>
              {autosaveStatus === 'saving' && 'Saving…'}
              {autosaveStatus === 'saved' && 'All changes saved'}
              {autosaveStatus === 'error' && <span style={{ color: 'var(--error)' }}>Save failed — fix and try again</span>}
            </div>
          </div>
          <button
            onClick={() => void handleCloseRequest()}
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

        {/* Checklist */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <ListTodo size={14} />
            <label style={{ fontSize: 13, fontWeight: 500 }}>Checklist</label>
            {checklist.length > 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {checklist.filter(i => i.done).length}/{checklist.length} done
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {checklist.map((item, index) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  background: 'var(--bg-secondary)',
                  borderRadius: 6,
                }}
              >
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => {
                    setChecklist(prev =>
                      prev.map((row, i) => (i === index ? { ...row, done: !row.done } : row))
                    )
                  }}
                  style={{ flexShrink: 0, cursor: 'pointer', width: 16, height: 16 }}
                  aria-label={item.done ? 'Mark item not done' : 'Mark item done'}
                />
                <input
                  type="text"
                  data-checklist-text-id={item.id}
                  value={item.text}
                  onChange={e => {
                    const v = e.target.value
                    setChecklist(prev =>
                      prev.map((row, i) => (i === index ? { ...row, text: v } : row))
                    )
                  }}
                  onKeyDown={e => {
                    if (e.key === ' ' || e.code === 'Space') {
                      e.stopPropagation()
                      return
                    }
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      e.stopPropagation()
                      const newId = newChecklistItemId()
                      setChecklist(prev => {
                        const next = prev.map((row, i) =>
                          i === index ? { ...row, text: row.text.trimEnd() } : row
                        )
                        next.splice(index + 1, 0, { id: newId, text: '', done: false })
                        return next
                      })
                      setChecklistFocusId(newId)
                    }
                  }}
                  placeholder="Item text"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '6px 8px',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    fontSize: 13,
                    background: 'var(--surface)',
                    color: 'var(--text-primary)',
                    textDecoration: item.done ? 'line-through' : 'none',
                    opacity: item.done ? 0.75 : 1,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setChecklist(prev => prev.filter((_, i) => i !== index))}
                  style={{
                    flexShrink: 0,
                    padding: 4,
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Remove item"
                  aria-label="Remove checklist item"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              setChecklist(prev => [...prev, { id: newChecklistItemId(), text: '', done: false }])
            }
            style={{
              marginTop: 8,
              padding: '6px 12px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 13,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Plus size={14} />
            Add item
          </button>
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

        {/* Attachments */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Paperclip size={14} />
            <label style={{ fontSize: 13, fontWeight: 500 }}>Attachments</label>
          </div>

          {/* Existing Attachments */}
          {card.attachments && card.attachments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
              {card.attachments.map(attachment => {
                const downloadHref = taskAttachmentDownloadPath(cardId, attachment.id)
                const showThumb = isImageMimeType(attachment.mime_type)
                return (
                <div
                  key={attachment.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 10px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 6,
                    fontSize: 13
                  }}
                >
                  {showThumb ? (
                    <AttachmentImagePreview src={downloadHref} alt={attachment.original_filename} />
                  ) : (
                    <Paperclip size={14} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {attachment.original_filename}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {formatFileSize(attachment.size)}
                    </div>
                  </div>
                  <a
                    href={downloadHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
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
                    title="Download"
                  >
                    <Download size={14} />
                  </a>
                  <button
                    onClick={() => deleteAttachment(attachment)}
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
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                )
              })}
            </div>
          )}

          {/* Upload Button */}
          <label
            style={{
              padding: '6px 12px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: uploading ? 'var(--text-tertiary)' : 'var(--text-secondary)',
              cursor: uploading ? 'not-allowed' : 'pointer',
              fontSize: 13,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Upload size={14} />
            {uploading ? 'Uploading...' : 'Attach File'}
            <input
              type="file"
              style={{ display: 'none' }}
              disabled={uploading}
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) {
                  uploadAttachment(file)
                  e.target.value = ''
                }
              }}
            />
          </label>
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
          <button
            type="button"
            onClick={() => void handleCloseRequest()}
            style={{
              padding: '10px 20px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
