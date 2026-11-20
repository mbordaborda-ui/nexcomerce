const runtimeBase = (window as Window & { __NEXCOMERCE_API_URL__?: string }).__NEXCOMERCE_API_URL__
const BASE = runtimeBase || (import.meta.env.VITE_API_URL as string | undefined) || ''
const SESSION_KEY = 'nexcomerce.session'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export function readSessionRaw<T>(): T | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeSessionRaw(value: unknown | null) {
  if (value === null) localStorage.removeItem(SESSION_KEY)
  else localStorage.setItem(SESSION_KEY, JSON.stringify(value))
}

function getToken(): string | null {
  const session = readSessionRaw<{ token?: string }>()
  return session?.token ?? null
}

type Query = Record<string, string | number | boolean | null | undefined>

function buildUrl(path: string, query?: Query) {
  const normalized = path.startsWith('/') ? path : `/${path}`
  const base = BASE.replace(/\/+$/, '')
  const url = new URL(`${base}/api${normalized}`, window.location.origin)
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
    })
  }
  return url.toString()
}

async function request<T>(method: string, path: string, options: { body?: unknown; query?: Query; raw?: boolean } = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(buildUrl(path, options.query), {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (response.status === 204) return undefined as T
  const contentType = response.headers.get('content-type') ?? ''
  const payload = contentType.includes('application/json') ? await response.json() : await response.text()

  if (!response.ok) {
    let message = 'No se pudo completar la solicitud.'
    if (typeof payload === 'object' && payload !== null && 'message' in payload) {
      message = String((payload as { message: unknown }).message)
    } else if (typeof payload === 'string') {
      const text = payload.trim()
      if (text.length > 0 && !text.startsWith('<')) {
        message = text
      } else if (response.status === 404) {
        message = 'No se encontró el servidor de la API. Verifica que el backend esté desplegado y que la URL del API esté configurada.'
      } else if (response.status >= 500) {
        message = 'El servidor de la API respondió con un error. Intenta de nuevo en unos minutos.'
      }
    }
    if (response.status === 401 && !path.includes('/auth/login')) {
      window.dispatchEvent(new Event('nexcomerce:unauthorized'))
    }
    throw new ApiError(message, response.status)
  }
  return payload as T
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
