'use client'

import React from 'react'
import { AlertTriangle } from 'lucide-react'
import styles from './ConfirmDialog.module.css'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger',
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  if (!isOpen) return null

  const iconClass = type === 'danger' ? styles.iconDanger : 
                   type === 'warning' ? styles.iconWarning : 
                   styles.iconInfo

  const confirmClass = type === 'danger' ? styles.buttonDanger :
                       type === 'warning' ? styles.buttonWarning :
                       styles.buttonInfo

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <AlertTriangle 
            size={24} 
            className={`${styles.icon} ${iconClass}`}
          />
          <div className={styles.content}>
            <h2 className={styles.title}>
              {title}
            </h2>
            <p className={styles.message}>
              {message}
            </p>
          </div>
        </div>
        <div className={styles.actions}>
          <button
            onClick={onCancel}
            className={`${styles.button} ${styles.buttonCancel}`}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`${styles.button} ${styles.buttonConfirm} ${confirmClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
