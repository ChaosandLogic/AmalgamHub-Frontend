/**
 * Central API client. All requests use credentials: 'include' and consistent error handling.
 * Paths are relative to current origin; Next rewrites /api to backend.
 */

function throwApiError(json: Record<string, unknown>, status: number, defaultMessage?: string): never {
  const message = (json?.message as string | undefined) ?? defaultMessage ?? `Request failed (${status})`
  throw new Error(message)
}

/** Parse JSON only when the response is actually JSON; return {} otherwise. */
async function parseJson(res: Response): Promise<Record<string, unknown>> {
  const ct = res.headers.get('content-type') ?? ''
  if (!ct.includes('application/json')) return {}
  return res.json().catch(() => ({}))
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  try {
    const res = await fetch(path, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init.headers as Record<string, string>),
        ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      },
    })
    return res
  } catch (err) {
    throw new Error(`Network error reaching ${path}: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/** Shared non-ok handler — detects proxy/gateway failures vs real API errors. */
async function handleErrorResponse(res: Response, defaultMessage?: string): Promise<never> {
  const json = await parseJson(res)
  if (Object.keys(json).length === 0 && res.status >= 500) {
    // No JSON body on a 5xx — this is a gateway/proxy failure (backend unreachable)
    throw new Error(defaultMessage ?? `Backend unavailable (${res.status}) — is the server running?`)
  }
  throwApiError(json, res.status, defaultMessage)
}

/**
 * Get parsed JSON. On non-ok response, throws an Error with message from body or defaultMessage.
 */
export async function apiGet<T = unknown>(
  path: string,
  options?: { defaultErrorMessage?: string }
): Promise<T> {
  const res = await request(path, { method: 'GET' })
  if (!res.ok) await handleErrorResponse(res, options?.defaultErrorMessage)
  const json = await parseJson(res)
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
  if (!res.ok) await handleErrorResponse(res, options?.defaultErrorMessage)
  const json = await parseJson(res)
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
  if (!res.ok) await handleErrorResponse(res, options?.defaultErrorMessage)
  const json = await parseJson(res)
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
  if (!res.ok) await handleErrorResponse(res, options?.defaultErrorMessage)
  const json = await parseJson(res)
  return (json?.data !== undefined ? json.data : json) as T
}

/**
 * DELETE. On non-ok, throws with message from body or defaultMessage.
 */
export async function apiDelete<T = void>(
  path: string,
  options?: { defaultErrorMessage?: string }
): Promise<T> {
  const res = await request(path, { method: 'DELETE' })
  if (!res.ok) await handleErrorResponse(res, options?.defaultErrorMessage)
  const json = await parseJson(res)
  return (json?.data !== undefined ? json.data : json) as T
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
  if (!res.ok) await handleErrorResponse(res, options?.defaultErrorMessage)
  const json = await parseJson(res)
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
  if (!res.ok) await handleErrorResponse(res, 'Download failed')
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
