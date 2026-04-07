'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '../components/Header'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'
import { Plus, MoreVertical, Trash2, Users } from 'lucide-react'
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
          <Board boardId={selectedBoard.id} boardName={selectedBoard.name} />
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
