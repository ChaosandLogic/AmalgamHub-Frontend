'use client'

import { useEffect, useCallback } from 'react'

interface ModalProps {
  children: React.ReactNode
  onClose?: () => void
  /** Controls z-index layering for nested modals. Defaults to 1000. */
  zIndex?: number
  /** Max width of the modal card in px. Defaults to 480. */
  maxWidth?: number
  /** If true, clicking the backdrop does not close the modal. */
  disableBackdropClose?: boolean
}

/**
 * Shared modal wrapper: fixed overlay with centered card.
 * Closes on backdrop click (unless disableBackdropClose) and Escape key.
 */
export default function Modal({
  children,
  onClose,
  zIndex = 1000,
  maxWidth = 480,
  disableBackdropClose = false,
}: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose()
    },
    [onClose]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--modal-backdrop, rgba(0,0,0,0.5))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex,
        padding: 16,
      }}
      onClick={!disableBackdropClose && onClose ? (e) => { if (e.target === e.currentTarget) onClose() } : undefined}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          width: '100%',
          maxWidth,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
