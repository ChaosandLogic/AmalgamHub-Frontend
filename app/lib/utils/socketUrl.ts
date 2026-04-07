/**
 * Base URL for Socket.io connections. Used by chat and notifications.
 *
 * Nginx proxies /socket.io to the backend, so the browser connects to the
 * same origin the page was loaded from (no cross-origin issues).
 * NEXT_PUBLIC_API_URL can override if set.
 */
export function getSocketApiUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:3002'
  const env = process.env.NEXT_PUBLIC_API_URL
  if (env) return env
  return window.location.origin
}
