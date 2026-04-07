'use client'

import React from 'react'
import styles from './AuthForm.module.css'

export interface AuthFormProps {
  title: string
  onSubmit: (e: React.FormEvent) => void
  submitLabel: string
  loading: boolean
  error?: string
  /** Optional text shown above the form (e.g. forgot-password instructions). */
  description?: string
  secondaryLink?: { href: string; label: string }
  footer?: React.ReactNode
  children: React.ReactNode
  /** Use true for a single centered submit button (e.g. register). */
  actionsCenter?: boolean
}

/**
 * Shared layout for auth pages: title, card form, error, submit + optional link, footer.
 * Export styles so pages can use the same .label, .input, .description etc. for form fields.
 */
export default function AuthForm({
  title,
  onSubmit,
  submitLabel,
  loading,
  error,
  description,
  secondaryLink,
  footer,
  children,
  actionsCenter = false,
}: AuthFormProps) {
  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <h2 className={styles.title}>{title}</h2>
        {description && <p className={styles.description}>{description}</p>}
        <form onSubmit={onSubmit} className={styles.card}>
          {children}
          {error && <div className={styles.error}>{error}</div>}
          <div className={actionsCenter ? styles.actionsCenter : styles.actions}>
            {!actionsCenter && secondaryLink && (
              <a href={secondaryLink.href} className={styles.link}>
                {secondaryLink.label}
              </a>
            )}
            <button type="submit" disabled={loading} className={styles.btnLift}>
              {submitLabel}
            </button>
          </div>
        </form>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  )
}

export { styles as authFormStyles }
