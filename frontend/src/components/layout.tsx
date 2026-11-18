import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  Boxes,
  ChevronDown,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Package,
  Plus,
  Receipt,
  Settings,
  ShoppingBag,
  Sparkles,
  Truck,
  UserCog,
  Users,
  Wallet,
  X,
  Menu,
} from 'lucide-react'
import { useAuth, usePermissions } from '../lib/auth'
import { api } from '../lib/api'
import type { Conversation, Tenant } from '../lib/types'
import { cn, Avatar, Badge } from './ui'

function canSee(session: { user: { role: string }; permissions: string[] } | null, permission?: string) {
  if (!permission) return true
  return Boolean(session && (session.user.role === 'Owner' || session.user.role === 'Admin' || session.permissions.includes(permission)))
}

export function Logo({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="relative flex size-9 items-center justify-center overflow-hidden rounded-[11px] bg-gradient-to-br from-brand-500 to-brand-800 shadow-[0_6px_16px_-6px_rgba(124,58,237,0.6)]">
        <svg viewBox="0 0 64 64" className="size-8" aria-hidden="true">
          <path d="M19 44V20h7l12 15V20h7v24h-7L26 29v15z" fill="white" />
        </svg>
      </span>
      {!compact && (
        <span className={cn('font-display text-[17px] font-extrabold tracking-tight', light ? 'text-white' : 'text-ink')}>
          Nex<span className="text-brand-600">Comerce</span>
        </span>
      )}
    </Link>
  )
}

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; permission?: string }

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Principal',
    items: [
      { to: '/', label: 'Inicio', icon: LayoutDashboard },
      { to: '/pos', label: 'Punto de venta', icon: ShoppingBag, permission: 'sales.manage' },
      { to: '/sales', label: 'Ventas', icon: Receipt, permission: 'sales.manage' },
    ],
  },
  {
    label: 'Catálogo',
    items: [
      { to: '/products', label: 'Productos', icon: Package, permission: 'products.manage' },
      { to: '/inventory', label: 'Inventario', icon: Boxes, permission: 'inventory.manage' },
    ],
  },
  {
    label: 'Relaciones',
    items: [
      { to: '/customers', label: 'Clientes', icon: Users, permission: 'customers.manage' },
      { to: '/whatsapp', label: 'WhatsApp', icon: MessageCircle, permission: 'whatsapp.manage' },
      { to: '/suppliers', label: 'Proveedores', icon: Truck, permission: 'suppliers.manage' },
    ],
  },
  {
    label: 'Finanzas',
    items: [
      { to: '/expenses', label: 'Gastos', icon: Wallet, permission: 'expenses.manage' },
      { to: '/reports', label: 'Reportes', icon: BarChart3, permission: 'reports.view' },
    ],
  },
  {
    label: 'Negocio',
    items: [
      { to: '/team', label: 'Equipo y sedes', icon: UserCog, permission: 'employees.manage' },
      { to: '/settings', label: 'Configuración', icon: Settings, permission: 'settings.manage' },
    ],
  },
]

const pageTitles: Record<string, string> = {
  '/': 'Inicio',
  '/pos': 'Punto de venta',
  '/sales': 'Ventas',
  '/products': 'Productos',
  '/inventory': 'Inventario',
  '/customers': 'Clientes',
  '/suppliers': 'Proveedores',
  '/expenses': 'Gastos',
  '/reports': 'Reportes',
  '/team': 'Equipo y sedes',
  '/settings': 'Configuración',
  '/whatsapp': 'WhatsApp Business',
}

function Sidebar({ onMore }: { onMore: () => void }) {
  const { session, logout } = useAuth()
  const { canManageWhatsApp } = usePermissions()
  const tenant = session?.tenant
  const trialDays = tenant?.trialEndsAt ? Math.max(0, Math.ceil((new Date(tenant.trialEndsAt).getTime() - Date.now()) / 86400000)) : null

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-line bg-white lg:flex">
      <div className="flex h-[72px] items-center px-5">
        <Logo />
      </div>

      <div className="mx-4 mb-4 flex items-center gap-2.5 rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2.5">
        <Avatar name={tenant?.name} src={tenant?.logoUrl} size="sm" className="rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-bold text-ink">{tenant?.name}</p>
          <p className="truncate text-[10.5px] text-muted">{session?.branch?.name ?? 'Todas las sedes'}</p>
        </div>
        <ChevronDown className="size-3.5 text-muted" />
      </div>

      <nav className="scroll-thin flex-1 overflow-y-auto px-3 pb-4">
        {navGroups.map((group) => {
          const items = group.items.filter((item) => canSee(session, item.permission))
          if (items.length === 0) return null
          return (
            <div key={group.label} className="mb-4">
              <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-muted/70">{group.label}</p>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) => cn('nav-item group', isActive && 'nav-item-active')}
                  >
                    <item.icon className="size-[18px] shrink-0" strokeWidth={2} />
                    <span className="flex-1">{item.label}</span>
                    {item.to === '/whatsapp' && canManageWhatsApp && <UnreadDot />}
                    {item.to === '/pos' && (
                      <span className="rounded-md bg-brand-600/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand-600">POS</span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      <div className="border-t border-line p-3">
        <div className="mb-2 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 p-3.5 text-white">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[11px] font-semibold text-white/80">Plan {tenant?.plan ?? 'Starter'}</p>
            <Sparkles className="size-3.5 text-brand-200" />
          </div>
          <p className="font-display text-[13px] font-bold leading-snug">
            {trialDays !== null && trialDays > 0 ? `Prueba gratis · ${trialDays} días` : 'Todo tu negocio, en un solo lugar'}
          </p>
          <Link to="/settings" className="mt-2.5 inline-flex w-full items-center justify-center gap-1 rounded-lg bg-white/15 py-1.5 text-[11px] font-semibold hover:bg-white/25">
            Ver mi plan <ArrowUpRight className="size-3" />
          </Link>
        </div>
        <button onClick={onMore} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-brand-50">
          <Avatar name={session?.user.fullName} src={session?.user.avatarUrl} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-semibold text-ink">{session?.user.fullName}</span>
            <span className="block truncate text-[10.5px] text-muted">{session?.user.role === 'Owner' ? 'Propietario' : session?.user.email}</span>
          </span>
          <ChevronRight className="size-3.5 text-muted" />
        </button>
        <button onClick={logout} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium text-muted hover:text-rose-600">
          <LogOut className="size-3.5" /> Cerrar sesión
        </button>
      </div>
    </aside>
  )
}

function UnreadDot() {
  const { data } = useQuery({
    queryKey: ['conversations-shell'],
    queryFn: () => api.get<Conversation[]>('/whatsapp/conversations'),
    refetchInterval: 30000,
    staleTime: 15000,
  })
  const unread = data?.reduce((sum, conversation) => sum + conversation.unreadCount, 0) ?? 0
  if (!unread) return null
  return <span className="flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9.5px] font-bold text-white">{unread}</span>
}

function Topbar({ onMore }: { onMore: () => void }) {
  const { session, logout } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const title = pageTitles[location.pathname] ?? 'NexComerce'

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-white/85 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:h-[72px] lg:px-8">
        <div className="lg:hidden">
          <Logo compact />
        </div>
        <div className="hidden min-w-0 flex-1 lg:block">
          <div className="flex items-center gap-2 text-[11px] font-medium text-muted">
            <span>{session?.tenant.name}</span>
            <ChevronRight className="size-3" />
            <span className="text-ink">{title}</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 lg:hidden">
          <p className="truncate font-display text-[14px] font-bold text-ink">{session?.tenant.name}</p>
          <p className="text-[10px] text-muted">{title}</p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link
            to="/pos"
            className="hidden items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-[12px] font-semibold text-white shadow-[var(--shadow-glow)] transition-colors hover:bg-brand-700 sm:flex"
          >
            <Plus className="size-4" /> Nueva venta
          </Link>
          <button className="icon-btn relative border border-line bg-white" aria-label="Notificaciones">
            <Bell className="size-[18px]" />
            <span className="absolute right-2 top-2 size-1.5 rounded-full bg-rose-500 ring-2 ring-white" />
          </button>
          <button onClick={onMore} className="flex items-center gap-2 rounded-full lg:hidden" aria-label="Abrir menú">
            <Avatar name={session?.user.fullName} src={session?.user.avatarUrl} size="sm" />
          </button>
          <div className="relative hidden lg:block">
            <button onClick={() => setMenuOpen((value) => !value)} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-brand-50">
              <Avatar name={session?.user.fullName} src={session?.user.avatarUrl} size="sm" />
              <span className="max-w-[120px] truncate text-[12px] font-semibold text-ink">{session?.user.fullName.split(' ')[0]}</span>
              <ChevronDown className="size-3.5 text-muted" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-white p-1.5 shadow-[var(--shadow-float)] animate-[slide-up_0.18s_ease-out]">
                  <div className="px-2.5 py-2">
                    <p className="truncate text-[12.5px] font-bold text-ink">{session?.user.fullName}</p>
                    <p className="truncate text-[11px] text-muted">{session?.user.email}</p>
                  </div>
                  <div className="divider my-1" />
                  <Link to="/settings" onClick={() => setMenuOpen(false)} className="nav-item py-2 text-[12px]">
                    <Settings className="size-4" /> Mi cuenta y negocio
                  </Link>
                  <Link to="/whatsapp" onClick={() => setMenuOpen(false)} className="nav-item py-2 text-[12px]">
                    <MessageCircle className="size-4" /> WhatsApp
                  </Link>
                  <button onClick={() => { setMenuOpen(false); logout() }} className="nav-item w-full py-2 text-[12px] text-rose-600 hover:bg-rose-50 hover:text-rose-700">
                    <LogOut className="size-4" /> Cerrar sesión
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

const mobileTabs = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard },
  { to: '/products', label: 'Productos', icon: Package },
  { to: '/pos', label: 'Vender', icon: Plus, main: true },
  { to: '/whatsapp', label: 'WhatsApp', icon: MessageCircle },
]

function MobileNav({ onMore }: { onMore: () => void }) {
  const location = useLocation()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-safe backdrop-blur-xl lg:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-2 pb-1.5 pt-1.5">
        {mobileTabs.slice(0, 2).map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              cn('flex flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-medium transition-colors', isActive ? 'text-brand-700' : 'text-muted')
            }
          >
            <tab.icon className="size-[21px]" strokeWidth={2} />
            {tab.label}
          </NavLink>
        ))}
        <NavLink to="/pos" className="flex flex-col items-center pb-1">
          <span
            className={cn(
              'flex size-[52px] -translate-y-3 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-[0_10px_24px_-8px_rgba(124,58,237,0.75)] transition-transform active:scale-95',
              location.pathname === '/pos' && 'ring-4 ring-brand-100',
            )}
          >
            <Plus className="size-7" strokeWidth={2.4} />
          </span>
          <span className="-mt-1 text-[10px] font-bold text-brand-700">Vender</span>
        </NavLink>
        {mobileTabs.slice(2).map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn('relative flex flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-medium transition-colors', isActive ? 'text-brand-700' : 'text-muted')
            }
          >
            <tab.icon className="size-[21px]" strokeWidth={2} />
            {tab.label}
            {tab.to === '/whatsapp' && <span className="absolute right-2 top-0"><UnreadDot /></span>}
          </NavLink>
        ))}
        <button onClick={onMore} className="flex flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-medium text-muted">
          <Menu className="size-[21px]" strokeWidth={2} />
          Más
        </button>
      </div>
    </nav>
  )
}

function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  const visibleItems = useMemo(
    () => navGroups.flatMap((group) => group.items).filter((item) => canSee(session, item.permission)),
    [session],
  )

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] lg:hidden">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-white pb-safe shadow-[var(--shadow-float)] animate-[slide-up_0.28s_cubic-bezier(0.16,1,0.3,1)]">
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <Avatar name={session?.user.fullName} src={session?.user.avatarUrl} />
            <div>
              <p className="text-[13px] font-bold text-ink">{session?.user.fullName}</p>
              <p className="text-[11px] text-muted">{session?.tenant.name} · {session?.tenant.plan}</p>
            </div>
          </div>
          <button onClick={onClose} className="icon-btn"><X className="size-4" /></button>
        </div>
        <div className="grid grid-cols-3 gap-2 p-4">
          {visibleItems.map((item) => (
            <button
              key={item.to}
              onClick={() => { navigate(item.to); onClose() }}
              className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-white px-2 py-3.5 text-center transition-colors hover:border-brand-200 hover:bg-brand-50"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <item.icon className="size-5" />
              </span>
              <span className="text-[10.5px] font-semibold leading-tight text-ink">{item.label}</span>
            </button>
          ))}
        </div>
        <div className="px-4 pb-5">
          <div className="mb-3 flex items-center justify-between rounded-xl border border-brand-100 bg-brand-50/60 p-3">
            <div>
              <p className="text-[11px] font-semibold text-brand-800">Plan {session?.tenant.plan}</p>
              <p className="text-[10px] text-muted">Tu negocio en un solo lugar</p>
            </div>
            <Badge tone="violet"><CreditCard className="size-3" /> Activo</Badge>
          </div>
          <button
            onClick={() => { onClose(); logout() }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-100 bg-rose-50 py-2.5 text-[12.5px] font-semibold text-rose-600"
          >
            <LogOut className="size-4" /> Cerrar sesión
          </button>
          <p className="mt-4 text-center text-[10px] text-muted">NexComerce v1.0 · Hecho para negocios que crecen</p>
        </div>
      </div>
    </div>
  )
}

export function AppShell() {
  const [moreOpen, setMoreOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname])

  return (
    <div className="min-h-dvh bg-canvas">
      <Sidebar onMore={() => setMoreOpen(true)} />
      <div className="lg:pl-[264px]">
        <Topbar onMore={() => setMoreOpen(true)} />
        <main className="min-h-[calc(100dvh-72px)]">
          <Outlet />
        </main>
      </div>
      <MobileNav onMore={() => setMoreOpen(true)} />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </div>
  )
}

export function TenantBadge({ tenant }: { tenant: Tenant }) {
  return (
    <div className="flex items-center gap-2">
      <Avatar name={tenant.name} src={tenant.logoUrl} size="sm" />
      <div>
        <p className="text-[12px] font-bold text-ink">{tenant.name}</p>
        <p className="text-[10px] text-muted">{tenant.businessType}</p>
      </div>
    </div>
  )
}
