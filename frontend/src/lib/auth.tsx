import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, readSessionRaw, writeSessionRaw } from './api'
import type { AuthResponse, MeResponse, Session } from './types'

interface RegisterPayload {
  businessName: string
  fullName: string
  email: string
  password: string
  phone?: string
  businessType?: string
  country?: string
  currency?: string
  currencySymbol?: string
}

interface AuthContextValue {
  session: Session | null
  loading: boolean
  login: (email: string, password: string) => Promise<Session>
  register: (payload: RegisterPayload) => Promise<Session>
  logout: () => void
  refresh: () => Promise<void>
  hasPermission: (permission: string) => boolean
  setSession: (session: Session) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function toSession(response: AuthResponse): Session {
  return {
    token: response.token,
    user: response.user,
    tenant: response.tenant,
    branch: response.branch,
    permissions: response.permissions,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(() => readSessionRaw<Session>())
  const [loading, setLoading] = useState(true)

  const setSession = useCallback((next: Session) => {
    setSessionState(next)
    writeSessionRaw(next)
  }, [])

  const logout = useCallback(() => {
    setSessionState(null)
    writeSessionRaw(null)
  }, [])

  const refresh = useCallback(async () => {
    const stored = readSessionRaw<{ token?: string }>()
    if (!stored?.token) {
      setLoading(false)
      return
    }
    try {
      const me = await api.get<MeResponse>('/auth/me')
      const next: Session = {
        token: stored.token,
        user: me.user,
        tenant: me.tenant,
        branch: me.branch,
        permissions: me.permissions,
      }
      setSessionState(next)
      writeSessionRaw(next)
    } catch {
      logout()
    } finally {
      setLoading(false)
    }
  }, [logout])

  useEffect(() => {
    void refresh()
    const onUnauthorized = () => {
      setSessionState(null)
      writeSessionRaw(null)
    }
    window.addEventListener('nexcomerce:unauthorized', onUnauthorized)
    return () => window.removeEventListener('nexcomerce:unauthorized', onUnauthorized)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mantiene los permisos al día si el propietario los cambia mientras la sesión está abierta.
  useEffect(() => {
    if (!session) return
    const onFocus = () => { void refresh() }
    const interval = window.setInterval(() => { void refresh() }, 5 * 60 * 1000)
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.clearInterval(interval)
    }
  }, [session, refresh])

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post<AuthResponse>('/auth/login', { email, password })
    const next = toSession(response)
    setSession(next)
    return next
  }, [setSession])

  const register = useCallback(async (payload: RegisterPayload) => {
    const response = await api.post<AuthResponse>('/auth/register', payload)
    const next = toSession(response)
    setSession(next)
    return next
  }, [setSession])

  const hasPermission = useCallback(
    (permission: string) =>
      session?.user.role === 'Owner' ||
      session?.user.role === 'Admin' ||
      Boolean(session?.permissions.includes(permission)),
    [session],
  )

  const value = useMemo<AuthContextValue>(
    () => ({ session, loading, login, register, logout, refresh, hasPermission, setSession }),
    [session, loading, login, register, logout, refresh, hasPermission, setSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return context
}

export function usePermissions() {
  const { hasPermission, session } = useAuth()
  return {
    canManageProducts: hasPermission('products.manage'),
    canManageInventory: hasPermission('inventory.manage'),
    canManageSales: hasPermission('sales.manage'),
    canManageCustomers: hasPermission('customers.manage'),
    canManageSuppliers: hasPermission('suppliers.manage'),
    canManageExpenses: hasPermission('expenses.manage'),
    canManageEmployees: hasPermission('employees.manage'),
    canViewReports: hasPermission('reports.view'),
    canManageSettings: hasPermission('settings.manage'),
    canManageWhatsApp: hasPermission('whatsapp.manage'),
    currencySymbol: session?.tenant.currencySymbol ?? '$',
  }
}
