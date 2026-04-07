'use client'

import { useEffect, useState } from 'react'
import { apiGet } from '../api/client'
import type { CurrentUser } from '../types/user'

/**
 * Single source of truth for the current user. Fetches GET /api/user once on mount.
 * Use this instead of duplicating fetch('/api/user') across pages.
 */
export function useUser(): {
  user: CurrentUser | null
  loading: boolean
  error: boolean
  refetch: () => Promise<void>
} {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const refetch = async () => {
    setLoading(true)
    setError(false)
    try {
      const raw = await apiGet<{ user: CurrentUser }>('/api/user')
      setUser(raw.user ?? null)
    } catch {
      setUser(null)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refetch()
  }, [])

  return { user, loading, error, refetch }
}
