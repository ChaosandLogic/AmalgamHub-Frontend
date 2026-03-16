/**
 * Central API client. All requests use credentials: 'include' and consistent error handling.
 * Paths are relative to current origin; Next rewrites /api to backend.
 */
async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.headers as Record<string, string>),
      ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  return res
}

/**
 * Get parsed JSON. On non-ok response, throws an Error with message from body or defaultMessage.
 */
export async function apiGet<T = unknown>(
  path: string,
  options?: { defaultErrorMessage?: string }
): Promise<T> {
  const res = await request(path, { method: 'GET' })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = json?.message ?? options?.defaultErrorMessage ?? 'Request failed'
    throw new Error(message)
  }
  return (json?.data !== undefined ? json.data : json) as T
}

/**
 * POST with JSON body. On non-ok, throws with message from body or defaultMessage.
 */
export async function apiPost<T = unknown>(
  path: string,
  body?: Record<string, unknown>,
  options?: { defaultErrorMessage?: string }
): Promise<T> {
  const res = await request(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = json?.message ?? options?.defaultErrorMessage ?? 'Request failed'
    throw new Error(message)
  }
  return (json?.data !== undefined ? json.data : json) as T
}

/**
 * PATCH with JSON body. Use for partial updates.
 */
export async function apiPatch<T = unknown>(
  path: string,
  body?: Record<string, unknown>,
  options?: { defaultErrorMessage?: string }
): Promise<T> {
  const res = await request(path, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = json?.message ?? options?.defaultErrorMessage ?? 'Request failed'
    throw new Error(message)
  }
  return (json?.data !== undefined ? json.data : json) as T
}

/**
 * PUT with JSON body.
 */
export async function apiPut<T = unknown>(
  path: string,
  body?: Record<string, unknown>,
  options?: { defaultErrorMessage?: string }
): Promise<T> {
  const res = await request(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = json?.message ?? options?.defaultErrorMessage ?? 'Request failed'
    throw new Error(message)
  }
  return (json?.data !== undefined ? json.data : json) as T
}

/**
 * DELETE. On non-ok, throws with message from body or defaultMessage.
 */
export async function apiDelete(
  path: string,
  options?: { defaultErrorMessage?: string }
): Promise<void> {
  const res = await request(path, { method: 'DELETE' })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    const message = json?.message ?? options?.defaultErrorMessage ?? 'Request failed'
    throw new Error(message)
  }
}

/**
 * POST FormData (file uploads). Browser sets the multipart Content-Type boundary automatically.
 */
export async function apiPostFormData<T = unknown>(
  path: string,
  formData: FormData,
  options?: { defaultErrorMessage?: string }
): Promise<T> {
  const res = await request(path, { method: 'POST', body: formData })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = json?.message ?? options?.defaultErrorMessage ?? 'Request failed'
    throw new Error(message)
  }
  return (json?.data !== undefined ? json.data : json) as T
}

/**
 * Download a file as a blob and trigger a browser save dialog.
 * Pass init to override method/body (e.g. POST with JSON body).
 */
export async function apiDownload(
  path: string,
  filename: string,
  init?: RequestInit,
): Promise<void> {
  const res = await request(path, init ?? {})
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json?.message ?? 'Download failed')
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  URL.revokeObjectURL(url)
  document.body.removeChild(a)
}

/**
 * Raw fetch for cases that need Response (e.g. blob, custom parsing).
 * Caller is responsible for checking res.ok and handling errors.
 */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return request(path, init ?? {})
}
