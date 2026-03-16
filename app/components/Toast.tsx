'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, AlertTriangle, Info, MessageCircle, X } from 'lucide-react'
import styles from './Toast.module.css'
import { TOAST_DURATION_MS } from '../lib/constants/ui'

type ToastType = 'success' | 'error' | 'info' | 'warning' | 'notification'

interface Toast {
  id: string
  message: string
  type: ToastType
  title?: string
  link?: string
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
  warning: (message: string) => void
  /** Show a notification toast (e.g. chat mention). Clicking it navigates to link if provided. */
  showNotificationToast: (title: string, options?: { message?: string; link?: string }) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => removeToast(id), TOAST_DURATION_MS)
  }, [removeToast])

  const showNotificationToast = useCallback((title: string, options?: { message?: string; link?: string }) => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts(prev => [...prev, {
      id,
      message: options?.message ?? title,
      type: 'notification',
      title,
      link: options?.link
    }])
    setTimeout(() => removeToast(id), TOAST_DURATION_MS + 1000)
  }, [removeToast])

  const success = useCallback((message: string) => showToast(message, 'success'), [showToast])
  const error = useCallback((message: string) => showToast(message, 'error'), [showToast])
  const info = useCallback((message: string) => showToast(message, 'info'), [showToast])
  const warning = useCallback((message: string) => showToast(message, 'warning'), [showToast])

  const getToastClass = (type: ToastType) => {
    const typeClasses: Record<ToastType, string> = {
      success: styles.toastSuccess,
      error: styles.toastError,
      warning: styles.toastWarning,
      info: styles.toastInfo,
      notification: styles.toastNotification
    }
    return `${styles.toast} ${typeClasses[type]}`
  }

  const getIcon = (type: ToastType) => {
    const iconProps = { size: 20, className: styles.icon }
    const icons = {
      success: <CheckCircle2 {...iconProps} />,
      error: <XCircle {...iconProps} />,
      warning: <AlertTriangle {...iconProps} />,
      info: <Info {...iconProps} />,
      notification: <MessageCircle {...iconProps} />
    }
    return icons[type]
  }

  function handleToastClick(toast: Toast) {
    if (toast.type === 'notification' && toast.link) {
      router.push(toast.link)
    }
    removeToast(toast.id)
  }

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning, showNotificationToast }}>
      {children}
      
      <div className={styles.container}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            onClick={() => handleToastClick(toast)}
            className={getToastClass(toast.type)}
            role={toast.link ? 'button' : undefined}
          >
            {getIcon(toast.type)}
            <div className={styles.content}>
              {toast.type === 'notification' && toast.title ? (
                <>
                  <div className={styles.toastTitle}>{toast.title}</div>
                  {toast.message !== toast.title && <div className={styles.message}>{toast.message}</div>}
                </>
              ) : (
                <div className={styles.message}>{toast.message}</div>
              )}
            </div>
            <X
              size={16}
              className={styles.closeButton}
              onClick={(e) => {
                e.stopPropagation()
                removeToast(toast.id)
              }}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

