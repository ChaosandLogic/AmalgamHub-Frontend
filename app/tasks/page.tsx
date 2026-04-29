'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '../components/Header'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'
import { Plus, MoreVertical, Trash2, Users, Copy } from 'lucide-react'
import Board from './components/Board'
import BoardMembers from './components/BoardMembers'
import LoadingSpinner from '../components/LoadingSpinner'
import { useUser } from '../lib/hooks/useUser'
import { apiGet, apiPost, apiDelete } from '../lib/api/client'

interface TaskBoard {
  id: string
  name: string
  description?: string
  created_by: string
  created_at: string
  updated_at: string
  archived: number
  company_wide?: number
}

const LAST_SELECTED_BOARD_KEY = 'tasks_last_selected_board_id'

function sanitizePdfFilenameSegment(name: string): string {
  const s = name.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, ' ').trim()
  return s.slice(0, 120) || 'Board'
}

/**
 * Tight crop inside `[data-task-board]`: union of title + full scrollable list area
 * (viewport-relative rects converted to coordinates relative to the board element).
 * Matches html2canvas `x` / `y` / `width` / `height` (offsets inside the capture root).
 */
function getTaskBoardCropWithinBoard(boardEl: HTMLElement): { x: number; y: number; width: number; height: number } | null {
  const rootRect = boardEl.getBoundingClientRect()

  let minL = Infinity
  let minT = Infinity
  let maxR = -Infinity
  let maxB = -Infinity

  function unionViewportRect(r: DOMRect) {
    minL = Math.min(minL, r.left)
    minT = Math.min(minT, r.top)
    maxR = Math.max(maxR, r.right)
    maxB = Math.max(maxB, r.bottom)
  }

  /** Scrollable region: include full scrollWidth × scrollHeight (not just the visible viewport). */
  function unionScrollContents(scrollEl: HTMLElement) {
    const r = scrollEl.getBoundingClientRect()
    const left = r.left - scrollEl.scrollLeft
    const top = r.top - scrollEl.scrollTop
    const right = left + scrollEl.scrollWidth
    const bottom = top + scrollEl.scrollHeight
    minL = Math.min(minL, left)
    minT = Math.min(minT, top)
    maxR = Math.max(maxR, right)
    maxB = Math.max(maxB, bottom)
  }

  const titleEl = boardEl.querySelector('[data-task-board-title]')
  if (titleEl instanceof HTMLElement) {
    unionViewportRect(titleEl.getBoundingClientRect())
  }

  const scrollEl = boardEl.querySelector('[data-task-board-scroll]')
  if (scrollEl instanceof HTMLElement) {
    unionScrollContents(scrollEl)
  }

  if (!Number.isFinite(minL)) {
    return null
  }

  const relLeft = minL - rootRect.left
  const relTop = minT - rootRect.top
  const relRight = maxR - rootRect.left
  const relBottom = maxB - rootRect.top

  const rawW = Math.ceil(relRight - relLeft)
  const rawH = Math.ceil(relBottom - relTop)

  return {
    x: Math.max(0, Math.floor(relLeft)),
    y: Math.max(0, Math.floor(relTop)),
    width: Math.max(1, rawW),
    height: Math.max(1, rawH),
  }
}

export default function TasksPage() {
  const router = useRouter()
  const toast = useToast()
  const [boards, setBoards] = useState<TaskBoard[]>([])
  const [selectedBoard, setSelectedBoard] = useState<TaskBoard | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateBoard, setShowCreateBoard] = useState(false)
  const [newBoardName, setNewBoardName] = useState('')
  const [newBoardDescription, setNewBoardDescription] = useState('')
  const [newBoardCompanyWide, setNewBoardCompanyWide] = useState(false)
  const { user } = useUser()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [boardToDelete, setBoardToDelete] = useState<TaskBoard | null>(null)
  const [showBoardMenu, setShowBoardMenu] = useState<string | null>(null)
  const [boardMemberCount, setBoardMemberCount] = useState<number>(0)
  const [showMembersDialog, setShowMembersDialog] = useState(false)
  const [showCopyBoardDialog, setShowCopyBoardDialog] = useState(false)
  const [copyBoardName, setCopyBoardName] = useState('')
  const [copyingBoard, setCopyingBoard] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

  // Save selected board to localStorage whenever it changes
  useEffect(() => {
    if (selectedBoard) {
      try {
        localStorage.setItem(LAST_SELECTED_BOARD_KEY, selectedBoard.id)
      } catch (error) {
        console.error('Error saving selected board to localStorage:', error)
      }
    }
  }, [selectedBoard])

  // Load member count for selected board
  useEffect(() => {
    if (selectedBoard && selectedBoard.company_wide !== 1) {
      apiGet<{ permissions: any[] }>(`/api/tasks/boards/${selectedBoard.id}/permissions`)
        .then(data => setBoardMemberCount((data.permissions || []).length))
        .catch(() => setBoardMemberCount(0))
    } else {
      setBoardMemberCount(0)
    }
  }, [selectedBoard])

  useEffect(() => {
    loadBoards()
  }, [])

  async function loadBoards() {
    try {
      const data = await apiGet<{ boards: TaskBoard[] }>('/api/tasks/boards')
      const boards = data.boards || []
      setBoards(boards)
      if (boards.length > 0 && !selectedBoard) {
        try {
          const lastSelectedBoardId = localStorage.getItem(LAST_SELECTED_BOARD_KEY)
          if (lastSelectedBoardId) {
            const lastBoard = boards.find(b => b.id === lastSelectedBoardId)
            if (lastBoard) { setSelectedBoard(lastBoard); return }
          }
        } catch {}
        setSelectedBoard(boards[0])
      }
    } catch (error) {
      console.error('Error loading boards:', error)
      toast.error('Failed to load boards')
    } finally {
      setLoading(false)
    }
  }

  async function createBoard() {
    if (!newBoardName.trim()) {
      toast.error('Board name is required')
      return
    }

    try {
      const data = await apiPost<{ board: TaskBoard }>('/api/tasks/boards', {
        name: newBoardName,
        description: newBoardDescription || null,
        company_wide: newBoardCompanyWide
      }, { defaultErrorMessage: 'Failed to create board' })
      if (!data.board) throw new Error('Invalid response format')
      setBoards([...boards, data.board])
      setSelectedBoard(data.board)
      setNewBoardName('')
      setNewBoardDescription('')
      setNewBoardCompanyWide(false)
      setShowCreateBoard(false)
      toast.success('Board created')
    } catch (error) {
      console.error('Error creating board:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create board')
    }
  }

  async function copyBoard() {
    if (!selectedBoard || copyingBoard) return
    setCopyingBoard(true)
    try {
      const data = await apiPost<{ board: TaskBoard }>(
        `/api/tasks/boards/${selectedBoard.id}/copy`,
        { name: copyBoardName.trim() || undefined },
        { defaultErrorMessage: 'Failed to copy board' }
      )
      if (!data.board) throw new Error('Invalid response format')
      setBoards([data.board, ...boards])
      setSelectedBoard(data.board)
      setShowCopyBoardDialog(false)
      setCopyBoardName('')
      setShowBoardMenu(null)
      toast.success('Board copied')
    } catch (error) {
      console.error('Error copying board:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to copy board')
    } finally {
      setCopyingBoard(false)
    }
  }

  async function deleteBoard() {
    if (!boardToDelete) return

    try {
      await apiDelete(`/api/tasks/boards/${boardToDelete.id}`, { defaultErrorMessage: 'Failed to delete board' })
      const updatedBoards = boards.filter(b => b.id !== boardToDelete.id)
      setBoards(updatedBoards)
      if (selectedBoard?.id === boardToDelete.id) {
        setSelectedBoard(updatedBoards.length > 0 ? updatedBoards[0] : null)
      }
      setShowDeleteConfirm(false)
      setBoardToDelete(null)
      setShowBoardMenu(null)
      toast.success('Board deleted')
    } catch (error) {
      console.error('Error deleting board:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete board')
    }
  }

  /** Capture board DOM like Gantt PDF export (html2canvas + jsPDF landscape A4). */
  async function handleExportPDF() {
    if (!selectedBoard) {
      toast.error('Please select a board first')
      return
    }

    setExportingPdf(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')

      const boardEl = document.querySelector('[data-task-board]') as HTMLElement | null
      if (!boardEl) {
        toast.error('Could not find board to export')
        return
      }

      const crop = getTaskBoardCropWithinBoard(boardEl)
      if (!crop) {
        toast.error('Could not measure board layout for export')
        return
      }

      toast.success('Generating PDF...')

      const canvas = await html2canvas(boardEl, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        x: crop.x,
        y: crop.y,
        width: crop.width,
        height: crop.height,
        onclone: (_clonedDoc, element) => {
          const root = element as HTMLElement
          root.style.overflow = 'visible'
          root.style.maxHeight = 'none'
          root.style.height = 'auto'

          const scroll = root.querySelector('[data-task-board-scroll]') as HTMLElement | null
          if (scroll) {
            scroll.style.overflow = 'visible'
            scroll.style.height = 'auto'
            scroll.style.maxHeight = 'none'
          }
          const cols = root.querySelector('[data-task-board-columns]') as HTMLElement | null
          if (cols) {
            cols.style.height = 'auto'
            cols.style.minHeight = 'auto'
          }
        },
      })

      const imgData = canvas.toDataURL('image/png')

      /** Fit bitmap to A4 landscape without clipping (uniform scale, centered). */
      const PAGE_W_MM = 297
      const PAGE_H_MM = 210
      const MARGIN_MM = 8
      const innerW = PAGE_W_MM - 2 * MARGIN_MM
      const innerH = PAGE_H_MM - 2 * MARGIN_MM

      const pxW = canvas.width
      const pxH = canvas.height
      const imgAspect = pxW / pxH

      let drawW = innerW
      let drawH = drawW / imgAspect
      if (drawH > innerH) {
        drawH = innerH
        drawW = drawH * imgAspect
      }

      const ox = MARGIN_MM + (innerW - drawW) / 2
      const oy = MARGIN_MM + (innerH - drawH) / 2

      const pdf = new jsPDF('landscape', 'mm', 'a4')

      pdf.addImage(imgData, 'PNG', ox, oy, drawW, drawH)

      const safeName = sanitizePdfFilenameSegment(selectedBoard.name)
      const dateStr = new Date().toISOString().split('T')[0]
      const filename = `Tasks_${safeName}_${dateStr}.pdf`

      pdf.save(filename)
      toast.success('PDF exported successfully!')
    } catch (error: unknown) {
      console.error('Error exporting PDF:', error)
      toast.error(
        (error instanceof Error ? error.message : String(error)) ||
          'Failed to export PDF. Please ensure html2canvas and jspdf are installed.'
      )
    } finally {
      setExportingPdf(false)
    }
  }

  // All authenticated users can manage tasks

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <Header />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <LoadingSpinner size={32} />
          <span style={{ color: 'var(--text-secondary)' }}>Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Header />
      <div style={{ 
        padding: '16px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        flexShrink: 0,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>Tasks</h1>
          {boards.length > 0 && (
            <select
              value={selectedBoard?.id || ''}
              onChange={(e) => {
                const board = boards.find(b => b.id === e.target.value)
                setSelectedBoard(board || null)
              }}
              style={{
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: 14,
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                minWidth: 200
              }}
            >
              {boards.map(board => (
                <option key={board.id} value={board.id}>
                  {board.name} {board.company_wide === 1 ? '(Company-wide)' : ''}
                </option>
              ))}
            </select>
          )}
          {selectedBoard && (
            <>
              {selectedBoard.company_wide !== 1 && (
                <span style={{ 
                  fontSize: 14, 
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  <Users size={16} />
                  {boardMemberCount} {boardMemberCount === 1 ? 'member' : 'members'}
                </span>
              )}
              {selectedBoard.company_wide === 1 && (
                <span style={{ 
                  fontSize: 12,
                  padding: '2px 8px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 4,
                  color: 'var(--text-secondary)',
                  fontWeight: 500
                }}>
                  Company-wide
                </span>
              )}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowBoardMenu(showBoardMenu === selectedBoard.id ? null : selectedBoard.id)
                  }}
                  style={{
                    padding: 4,
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--bg-tertiary)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <MoreVertical size={18} />
                </button>
                {showBoardMenu === selectedBoard.id && (
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
                      onClick={() => setShowBoardMenu(null)}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: 32,
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
                        onClick={(e) => {
                          e.stopPropagation()
                          setCopyBoardName(`Copy of ${selectedBoard.name}`)
                          setShowCopyBoardDialog(true)
                          setShowBoardMenu(null)
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
                        <Copy size={16} />
                        Copy board
                      </button>
                      {selectedBoard.company_wide !== 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowMembersDialog(true)
                            setShowBoardMenu(null)
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
                          <Users size={16} />
                          Add Members
                        </button>
                      )}
                      {user?.id === selectedBoard?.created_by && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setBoardToDelete(selectedBoard)
                            setShowDeleteConfirm(true)
                            setShowBoardMenu(null)
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
                          Delete Board
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {selectedBoard && (
            <button
              type="button"
              onClick={() => void handleExportPDF()}
              disabled={exportingPdf}
              style={{
                padding: '8px 16px',
                background: 'var(--surface)',
                color: exportingPdf ? 'var(--text-tertiary)' : 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                cursor: exportingPdf ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (exportingPdf) return
                e.currentTarget.style.background = 'var(--bg-secondary)'
                e.currentTarget.style.borderColor = 'var(--border-strong)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--surface)'
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
            >
              <span>📄</span>
              {exportingPdf ? 'Exporting…' : 'Export PDF'}
            </button>
          )}
          <button
            onClick={() => setShowCreateBoard(true)}
            style={{
              padding: '8px 16px',
              background: 'var(--success)',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--success-hover)'
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(5, 150, 105, 0.3)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--success)'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <Plus size={16} />
            New Board
          </button>
        </div>
      </div>
      
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', padding: 16 }}>
        <ConfirmDialog
          isOpen={showDeleteConfirm}
          title="Delete Board"
          message={`Are you sure you want to delete "${boardToDelete?.name}"? This will also delete all lists and cards in this board. This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          type="danger"
          onConfirm={deleteBoard}
          onCancel={() => {
            setShowDeleteConfirm(false)
            setBoardToDelete(null)
            setShowBoardMenu(null)
          }}
        />
        
        {/* Create Board Dialog */}
        {showCreateBoard && (
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
            onClick={() => setShowCreateBoard(false)}
          >
            <div
              style={{
                background: 'var(--surface)',
                borderRadius: 12,
                padding: 24,
                maxWidth: '500px',
                width: '90vw',
                maxHeight: '90vh',
                overflowY: 'auto'
              }}
              onClick={e => e.stopPropagation()}
            >
              <h2 style={{ margin: '0 0 20px 0' }}>Create New Board</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
                    Name *
                  </label>
                  <input
                    type="text"
                    value={newBoardName}
                    onChange={e => setNewBoardName(e.target.value)}
                    placeholder="Board name"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      fontSize: 14
                    }}
                    autoFocus
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
                    Description
                  </label>
                  <textarea
                    value={newBoardDescription}
                    onChange={e => setNewBoardDescription(e.target.value)}
                    placeholder="Board description (optional)"
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      fontSize: 14,
                      resize: 'vertical'
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      fontSize: 14
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={newBoardCompanyWide}
                      onChange={e => setNewBoardCompanyWide(e.target.checked)}
                      style={{
                        width: 16,
                        height: 16,
                        cursor: 'pointer'
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: 500, marginBottom: 2 }}>Company-wide board</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        Visible to all users in the company. No need to add individual members.
                      </div>
                    </div>
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
                <button
                  onClick={() => {
                    setShowCreateBoard(false)
                    setNewBoardName('')
                    setNewBoardDescription('')
                    setNewBoardCompanyWide(false)
                  }}
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
                  onClick={createBoard}
                  disabled={!newBoardName.trim()}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: 6,
                    background: newBoardName.trim() ? 'var(--success)' : 'var(--text-tertiary)',
                    color: 'white',
                    cursor: newBoardName.trim() ? 'pointer' : 'not-allowed'
                  }}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {showCopyBoardDialog && selectedBoard && (
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
            onClick={() => {
              if (!copyingBoard) {
                setShowCopyBoardDialog(false)
                setCopyBoardName('')
              }
            }}
          >
            <div
              style={{
                background: 'var(--surface)',
                borderRadius: 12,
                padding: 24,
                maxWidth: '500px',
                width: '90vw',
                maxHeight: '90vh',
                overflowY: 'auto'
              }}
              onClick={e => e.stopPropagation()}
            >
              <h2 style={{ margin: '0 0 8px 0' }}>Copy board</h2>
              <p style={{ margin: '0 0 16px 0', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Creates a new board with the same lists and cards. Card assignees are copied. Gantt timeline tasks are not included.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>
                    Name for the new board *
                  </label>
                  <input
                    type="text"
                    value={copyBoardName}
                    onChange={e => setCopyBoardName(e.target.value)}
                    placeholder="Board name"
                    disabled={copyingBoard}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      fontSize: 14
                    }}
                    autoFocus
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCopyBoardDialog(false)
                    setCopyBoardName('')
                  }}
                  disabled={copyingBoard}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    background: 'var(--surface)',
                    color: 'var(--text-primary)',
                    cursor: copyingBoard ? 'not-allowed' : 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={copyBoard}
                  disabled={copyingBoard || !copyBoardName.trim()}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: 6,
                    background: copyBoardName.trim() && !copyingBoard ? 'var(--success)' : 'var(--text-tertiary)',
                    color: 'white',
                    cursor: copyBoardName.trim() && !copyingBoard ? 'pointer' : 'not-allowed'
                  }}
                >
                  {copyingBoard ? 'Copying…' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Board Members Dialog (controlled from menu) */}
        {selectedBoard && selectedBoard.company_wide !== 1 && (
          <BoardMembers 
            boardId={selectedBoard.id} 
            canEdit={true} 
            onUpdate={() => {
              loadBoards()
              // Reload member count
              apiGet<{ permissions: any[] }>(`/api/tasks/boards/${selectedBoard.id}/permissions`)
                .then(data => setBoardMemberCount((data.permissions || []).length))
                .catch(err => console.error('Error loading board members:', err))
            }}
            showDialog={showMembersDialog}
            onDialogClose={() => setShowMembersDialog(false)}
          />
        )}

        {/* Board View */}
        {selectedBoard ? (
          <Board
            boardId={selectedBoard.id}
            boardName={selectedBoard.name}
            onBoardRenamed={newName => {
              setSelectedBoard(prev => (prev ? { ...prev, name: newName } : null))
              setBoards(prev =>
                prev.map(b => (b.id === selectedBoard.id ? { ...b, name: newName } : b))
              )
            }}
          />
        ) : (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
            {boards.length === 0 ? (
              <>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
                <div style={{ fontSize: 18, marginBottom: 8 }}>No boards yet</div>
                <div style={{ fontSize: 14, marginBottom: 24 }}>
                  Create your first board to get started
                </div>
                <button
                  onClick={() => setShowCreateBoard(true)}
                  style={{
                    padding: '10px 20px',
                    background: 'var(--success)',
                    color: 'white',
                    border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 500
                    }}
                  >
                    Create Board
                  </button>
              </>
            ) : (
              <div>Select a board to view tasks</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
