'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiGet } from '../api/client'

interface UseApiDataOptions<T> {
  /** Transform the raw API response into the desired shape. */
  transform?: (raw: unknown) => T
  /** When true the fetch is skipped (e.g. waiting for a required param). */
  skip?: boolean
}

/**
 * Generic load-on-mount hook. Fetches `url` with GET on mount and whenever
 * `url` or `skip` changes. Pass `url: null` to skip the fetch.
 *
 * Use this for simple "fetch once on mount" patterns only.
 * Pages with socket-driven state or complex sequential fetches are better
 * served by their own dedicated hooks.
 */
export function useApiData<T>(
  url: string | null,
  options?: UseApiDataOptions<T>,
): { data: T | null; loading: boolean; error: string; refetch: () => Promise<void> } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const skip = options?.skip

  // Keep transform in a ref so callers can pass inline arrow functions without
  // causing refetch to be recreated (and the effect to fire) on every render.
  const transformRef = useRef(options?.transform)
  transformRef.current = options?.transform

  const refetch = useCallback(async () => {
    if (!url || skip) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const raw = await apiGet(url)
      setData(transformRef.current ? transformRef.current(raw) : (raw as T))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }, [url, skip]) // transform intentionally excluded — use ref above

  useEffect(() => { refetch() }, [refetch])

  return { data, loading, error, refetch }
}
