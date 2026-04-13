/**
 * Base URL for Socket.io connections. Used by chat and notifications.
 *
 * With the Next.js rewrite `/socket.io` → backend (see next.config.mjs), the browser
 * can use the same origin as the page (no CORS). Nginx in production should proxy
 * `/socket.io` the same way. Override with NEXT_PUBLIC_API_URL if the client must
 * talk to the API host directly.
 */
export function getSocketApiUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:3002'
  const env = process.env.NEXT_PUBLIC_API_URL
  if (env) return env
  return window.location.origin
}
