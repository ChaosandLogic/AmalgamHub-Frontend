/**
 * Base URL for Socket.io connections. Used by chat and notifications.
 * NEXT_PUBLIC_API_URL can be set in env; otherwise inferred from window (same origin on 8080/8443, else :3002).
 */
export function getSocketApiUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:3002'
  const env = process.env.NEXT_PUBLIC_API_URL
  if (env) return env
  const origin = window.location.origin
  const port = window.location.port
  if (port === '8080' || port === '8443') return origin
  const withBackend = origin.replace(/:\d+$/, ':3002')
  return withBackend.includes(':') ? withBackend : `${origin}:3002`
}
