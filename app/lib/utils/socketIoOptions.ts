/**
 * Shared Socket.io client options (chat + notifications).
 * Sends JWT in handshake.auth so the backend can authenticate even if cookie
 * forwarding through a proxy is flaky.
 */

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null
  const parts = `; ${document.cookie}`.split(`; ${name}=`)
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() ?? null
  }
  return null
}

/** Options aligned with backend socket/index.js (auth from handshake.auth.token or Cookie). */
export function getDefaultSocketIoOptions() {
  const token = getCookieValue('token')
  return {
    withCredentials: true,
    transports: ['polling', 'websocket'] as const,
    path: '/socket.io',
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    timeout: 10000,
    ...(token ? { auth: { token } } : {}),
  }
}
