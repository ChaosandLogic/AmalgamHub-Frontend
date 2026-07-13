'use client'

import React from 'react'
import { AlertTriangle } from 'lucide-react'
import styles from './ConfirmDialog.module.css'

interface TimesheetReminderDialogProps {
  isOpen: boolean
  onGoToTimesheet: () => void
  onDismiss: () => void
}

export default function TimesheetReminderDialog({
  isOpen,
  onGoToTimesheet,
  onDismiss,
}: TimesheetReminderDialogProps) {
  if (!isOpen) return null

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <AlertTriangle size={24} className={`${styles.icon} ${styles.iconWarning}`} />
          <div className={styles.content}>
            <h2 className={styles.title}>Timesheet reminder</h2>
            <p className={styles.message}>
              Please complete and submit today&apos;s timesheet. Mark today as submitted when
              you&apos;re done, then submit the full week when ready.
            </p>
          </div>
        </div>
        <div className={styles.actions}>
          <button
            onClick={onDismiss}
            className={`${styles.button} ${styles.buttonCancel}`}
          >
            Dismiss
          </button>
          <button
            onClick={onGoToTimesheet}
            className={`${styles.button} ${styles.buttonConfirm} ${styles.buttonWarning}`}
          >
            Go to timesheet
          </button>
        </div>
      </div>
    </div>
  )
}
