import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  CircleDollarSign,
  Clock3,
  MessageCircle,
  Package,
  Plus,
  Receipt,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
  AlertTriangle,
  Bot,
} from 'lucide-react'
import { api } from '../lib/api'
import { useAuth, usePermissions } from '../lib/auth'
import type { Dashboard } from '../lib/types'
import { dateShort, greeting, money, moneyShort, numberFormat, timeAgo } from '../lib/format'
import { Badge, Button, EmptyState, PageLoader, ProductThumb, SectionCard } from '../components/ui'
import { cn } from '../components/ui'

const ranges = [
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
]

function ChartTooltip({ active, payload, label, symbol }: {
  active?: boolean
  payload?: ReadonlyArray<{ value?: number | string; payload?: Record<string, unknown> }>
  label?: string | number
  symbol: string
}) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload as { orders?: number } | undefined
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 shadow-[var(--shadow-float)]">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label ? dateShort(String(label)) : ''}</p>
      <p className="font-display text-[15px] font-bold text-ink">{money(Number(payload[0]?.value ?? 0), symbol)}</p>
      <p className="text-[10.5px] text-muted">{row?.orders ?? 0} ventas</p>
    </div>
  )
}

export function DashboardPage() {
  const { session } = useAuth()
  const { canManageSales, canManageProducts, canManageInventory, canManageWhatsApp, canViewReports } = usePermissions()
  const symbol = session?.tenant.currencySymbol ?? '$'
  const [days, setDays] = useState(30)
  const [categoryView, setCategoryView] = useState<'total' | 'quantity'>('total')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', days],
    queryFn: () => api.get<Dashboard>('/dashboard', { days }),
    refetchInterval: 60000,
  })

  if (isLoading) return <PageLoader label="Preparando tu dashboard…" />

  if (isError || !data) {
    return (
      <div className="page">
        <EmptyState
          title="No pudimos cargar tu dashboard"
          description="Verifica tu conexión e inténtalo de nuevo."
          action={<Button onClick={() => refetch()}>Reintentar</Button>}
        />
      </div>
    )
  }

  const todayDelta = data.salesYesterday > 0 ? ((data.salesToday - data.salesYesterday) / data.salesYesterday) * 100 : data.salesToday > 0 ? 100 : 0
  const avgDelta = data.averageTicketPrevious > 0 ? ((data.averageTicket - data.averageTicketPrevious) / data.averageTicketPrevious) * 100 : 0
  const firstName = session?.user.fullName.split(' ')[0] ?? ''
  const categoryTotal = data.categorySales.reduce((sum, item) => sum + (categoryView === 'total' ? item.total : item.quantity), 0)
  const hasCategories = data.categorySales.length > 0

  const quickActions = [
    ...(canManageSales ? [{ to: '/pos', label: 'Nueva venta', hint: 'Cobra en segundos', icon: ShoppingBag, className: 'bg-brand-600 text-white' }] : []),
    ...(canManageProducts ? [{ to: '/products', label: 'Agregar producto', hint: 'Catálogo e inventario', icon: Package, className: 'bg-white text-ink border border-line' }] : []),
    ...(canManageWhatsApp ? [{ to: '/whatsapp', label: 'Ver WhatsApp', hint: `${data.whatsAppOpen} conversaciones`, icon: MessageCircle, className: 'bg-white text-ink border border-line' }] : []),
    ...(canViewReports ? [{ to: '/reports', label: 'Reportes', hint: 'Analiza tu negocio', icon: BarChart3, className: 'bg-white text-ink border border-line' }] : []),
    { to: '/account', label: 'Mi cuenta', hint: 'Perfil y permisos', icon: UserRound, className: 'bg-white text-ink border border-line' },
  ].slice(0, 4)

  return (
    <div className="page">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11.5px] font-medium capitalize text-muted">{greeting()}, {dateShort(new Date().toISOString())} · {session?.tenant.name}</p>
          <h1 className="page-title mt-0.5">Hola, {firstName} 👋</h1>
          <p className="page-subtitle">Así va tu negocio hoy. Todo listo para seguir creciendo.</p>
        </div>
        <div className="flex items-center gap-2">
          {canViewReports && (
            <Link to="/reports" className="btn-secondary btn-sm hidden sm:inline-flex">
              <BarChart3 className="size-3.5" /> Reportes
            </Link>
          )}
          {canManageSales && (
            <Link to="/pos" className="btn-primary btn-sm flex-1 sm:flex-none">
              <Plus className="size-4" /> Nueva venta
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <div className="card card-hover p-4 lg:p-5">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Ventas de hoy</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Wallet className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[21px] font-bold leading-tight text-ink sm:text-2xl">{money(data.salesToday, symbol)}</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold', todayDelta >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600')}>
              {todayDelta >= 0 ? '↑' : '↓'} {Math.abs(todayDelta).toFixed(1)}%
            </span>
            <span className="text-[10px] text-muted">vs. ayer · {data.ordersToday} ventas</span>
          </div>
        </div>

        <div className="card card-hover p-4 lg:p-5">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Ventas del mes</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600"><CircleDollarSign className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[21px] font-bold leading-tight text-ink sm:text-2xl">{money(data.salesMonth, symbol)}</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold', data.salesChange >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600')}>
              {data.salesChange >= 0 ? '↑' : '↓'} {Math.abs(data.salesChange).toFixed(1)}%
            </span>
            <span className="text-[10px] text-muted">{data.ordersMonth} pedidos</span>
          </div>
        </div>

        <div className="card card-hover p-4 lg:p-5">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Utilidad del mes</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><TrendingUp className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[21px] font-bold leading-tight text-ink sm:text-2xl">{money(data.profitMonth, symbol)}</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
              {data.salesMonth > 0 ? `${Math.round((data.profitMonth / data.salesMonth) * 100)}%` : '—'}
            </span>
            <span className="text-[10px] text-muted">margen neto</span>
          </div>
        </div>

        <div className="card card-hover p-4 lg:p-5">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Ticket promedio</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><Receipt className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[21px] font-bold leading-tight text-ink sm:text-2xl">{money(data.averageTicket, symbol)}</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold', avgDelta >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600')}>
              {avgDelta >= 0 ? '↑' : '↓'} {Math.abs(avgDelta).toFixed(1)}%
            </span>
            <span className="text-[10px] text-muted">vs. mes anterior</span>
          </div>
        </div>
      </div>

      <div className="hide-scrollbar -mx-4 mt-4 flex gap-2.5 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-4">
        {quickActions.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className={cn(
              'group flex min-w-[168px] items-center gap-3 rounded-2xl p-3.5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 sm:min-w-0',
              action.className,
            )}
          >
            <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', action.to === '/pos' ? 'bg-white/15' : 'bg-brand-50 text-brand-600')}>
              <action.icon className="size-4.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-bold">{action.label}</span>
              <span className={cn('block truncate text-[10px]', action.to === '/pos' ? 'text-white/70' : 'text-muted')}>{action.hint}</span>
            </span>
            <ArrowUpRight className={cn('size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5', action.to === '/pos' ? 'text-white/60' : 'text-muted')} />
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          title="Evolución de ventas"
          subtitle={`Ingresos de los últimos ${days} días`}
          action={
            <div className="flex rounded-lg bg-brand-50/80 p-0.5">
              {ranges.map((range) => (
                <button
                  key={range.days}
                  onClick={() => setDays(range.days)}
                  className={cn(
                    'rounded-md px-2 py-1 text-[10.5px] font-semibold transition-colors',
                    days === range.days ? 'bg-white text-brand-700 shadow-sm' : 'text-muted hover:text-brand-700',
                  )}
                >
                  {range.label}
                </button>
              ))}
            </div>
          }
          bodyClassName="px-2 pb-3 pt-4 sm:px-3"
        >
          <div className="mb-2 flex items-end justify-between px-2 sm:px-3">
            <div>
              <p className="font-display text-[22px] font-bold text-ink">{money(data.salesSeries.reduce((sum, item) => sum + item.sales, 0), symbol)}</p>
              <p className="text-[10.5px] text-muted">{data.salesSeries.reduce((sum, item) => sum + item.orders, 0)} ventas en el periodo</p>
            </div>
            <Badge tone="green"><TrendingUp className="size-3" /> {money(data.salesToday, symbol)} hoy</Badge>
          </div>
          <div className="h-[220px] w-full sm:h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.salesSeries} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0ECFA" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 9.5, fill: '#8b86a0' }}
                  tickFormatter={(value: string) => dateShort(value)}
                  minTickGap={24}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 9.5, fill: '#8b86a0' }}
                  tickFormatter={(value: number) => moneyShort(value, symbol)}
                  width={54}
                />
                <Tooltip content={<ChartTooltip symbol={symbol} />} cursor={{ stroke: '#C4B1FE', strokeDasharray: '3 3' }} />
                <Area type="monotone" dataKey="sales" stroke="#7C3AED" strokeWidth={2.4} fill="url(#salesGradient)" activeDot={{ r: 4, fill: '#7C3AED', stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Ventas por categoría"
          subtitle="Distribución del periodo"
          action={
            <div className="flex rounded-lg bg-brand-50/80 p-0.5">
              <button onClick={() => setCategoryView('total')} className={cn('rounded-md px-2 py-1 text-[10px] font-semibold', categoryView === 'total' ? 'bg-white text-brand-700 shadow-sm' : 'text-muted')}>Monto</button>
              <button onClick={() => setCategoryView('quantity')} className={cn('rounded-md px-2 py-1 text-[10px] font-semibold', categoryView === 'quantity' ? 'bg-white text-brand-700 shadow-sm' : 'text-muted')}>Unidades</button>
            </div>
          }
          bodyClassName="pt-2"
        >
          {hasCategories ? (
            <>
              <div className="relative mx-auto h-[168px] w-full max-w-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.categorySales}
                      dataKey={categoryView}
                      nameKey="name"
                      innerRadius={54}
                      outerRadius={76}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {data.categorySales.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip
                      formatter={(value) => categoryView === 'total' ? money(Number(value ?? 0), symbol) : `${numberFormat(Number(value ?? 0))} uds.`}
                      contentStyle={{ borderRadius: 12, border: '1px solid #ECE8F6', fontSize: 11, boxShadow: '0 12px 32px -16px rgba(76,29,149,.3)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[9.5px] font-semibold uppercase tracking-wide text-muted">Total</span>
                  <span className="font-display text-[15px] font-bold text-ink">
                    {categoryView === 'total' ? moneyShort(categoryTotal, symbol) : numberFormat(categoryTotal)}
                  </span>
                </div>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-2">
                {data.categorySales.slice(0, 6).map((category) => (
                  <div key={category.name} className="flex min-w-0 items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                    <span className="min-w-0 flex-1 truncate text-[10.5px] text-muted">{category.name}</span>
                    <span className="text-[10.5px] font-semibold text-ink">
                      {categoryView === 'total' ? moneyShort(category.total, symbol) : `${category.quantity}`}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState title="Aún no hay ventas" description="Registra tu primera venta para ver la distribución por categoría." icon={<BarChart3 className="size-5" />} />
          )}
        </SectionCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <SectionCard
          title="Productos más vendidos"
          subtitle="Últimos 30 días"
          action={canManageProducts ? <Link to="/products" className="text-[11px] font-semibold text-brand-700 hover:underline">Ver todos</Link> : undefined}
          bodyClassName="p-2 sm:p-2.5"
        >
          {data.topProducts.length === 0 ? (
            <EmptyState title="Sin productos vendidos" description="Tus productos más vendidos aparecerán aquí." icon={<Package className="size-5" />} />
          ) : (
            <div className="space-y-0.5">
              {data.topProducts.map((product, index) => (
                <div key={product.id} className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-brand-50/50">
                  <span className="w-3 text-center font-display text-[11px] font-bold text-brand-300">{index + 1}</span>
                  <ProductThumb src={product.imageUrl} name={product.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-ink">{product.name}</p>
                    <p className="truncate text-[10px] text-muted">{product.categoryName ?? 'Sin categoría'} · {product.quantity} vendidos</p>
                  </div>
                  <p className="text-[12px] font-bold text-ink">{money(product.total, symbol)}</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <div className="space-y-4">
          <SectionCard
            title="Stock bajo"
            subtitle="Productos que necesitan reposición"
            action={canManageInventory ? <Link to="/inventory" className="text-[11px] font-semibold text-brand-700 hover:underline">Inventario</Link> : undefined}
            bodyClassName="p-2.5 sm:p-3"
          >
            {data.lowStock.length === 0 ? (
              <EmptyState title="Inventario saludable" description="No hay productos por debajo del stock mínimo." icon={<Boxes className="size-5" />} />
            ) : (
              <div className="space-y-1">
                {data.lowStock.slice(0, 4).map((item) => (
                  <div key={item.id} className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-brand-50/50">
                    <ProductThumb src={item.imageUrl} name={item.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11.5px] font-semibold text-ink">{item.name}</p>
                      <p className="text-[9.5px] text-muted">{item.minStock} mín. · {money(item.price, symbol)}</p>
                    </div>
                    <span className={cn('rounded-lg px-2 py-1 text-[10px] font-bold', item.stock === 0 ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700')}>
                      {item.stock === 0 ? 'Agotado' : `${item.stock} uds`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {canManageWhatsApp && (
          <div className="card overflow-hidden">
            <div className="relative bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 p-4 text-white">
              <div className="absolute -right-6 -top-8 size-28 rounded-full bg-white/10" />
              <div className="relative flex items-start justify-between">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide">
                    <span className="size-1.5 animate-pulse rounded-full bg-emerald-200" /> Conectado
                  </span>
                  <p className="mt-2 font-display text-[15px] font-bold">WhatsApp Business</p>
                  <p className="mt-0.5 text-[11px] text-white/75">Atención inteligente con IA, 24/7</p>
                </div>
                <MessageCircle className="size-7 text-white/80" />
              </div>
              <div className="relative mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/10 p-2.5 backdrop-blur">
                  <p className="font-display text-xl font-bold">{data.whatsAppOpen}</p>
                  <p className="text-[9.5px] text-white/70">Conversaciones abiertas</p>
                </div>
                <div className="rounded-xl bg-white/10 p-2.5 backdrop-blur">
                  <p className="font-display text-xl font-bold">{data.whatsAppAutomated}</p>
                  <p className="text-[9.5px] text-white/70">Respuestas automáticas</p>
                </div>
              </div>
              <Link to="/whatsapp" className="relative mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-white py-2 text-[11.5px] font-bold text-emerald-700 transition-colors hover:bg-emerald-50">
                <Bot className="size-3.5" /> Abrir bandeja de WhatsApp <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
          )}
        </div>

        {canManageSales && (
        <SectionCard
          className="lg:col-span-2 xl:col-span-1"
          title="Ventas recientes"
          subtitle="Últimos movimientos"
          action={<Link to="/sales" className="text-[11px] font-semibold text-brand-700 hover:underline">Ver todas</Link>}
          bodyClassName="p-2 sm:p-2.5"
        >
          {data.recentSales.length === 0 ? (
            <EmptyState title="Aún no hay ventas registradas" description="Cuando registres una venta aparecerá aquí." action={<Link to="/pos"><Button size="sm"><Plus className="size-3.5" /> Nueva venta</Button></Link>} />
          ) : (
            <div className="space-y-0.5">
              {data.recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center gap-2.5 rounded-xl px-2 py-2.5 hover:bg-brand-50/50">
                  <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', sale.status === 'Cancelled' ? 'bg-rose-50 text-rose-500' : sale.channel === 'WhatsApp' ? 'bg-emerald-50 text-emerald-600' : 'bg-brand-50 text-brand-600')}>
                    {sale.channel === 'WhatsApp' ? <MessageCircle className="size-3.5" /> : <Receipt className="size-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11.5px] font-semibold text-ink">{sale.customerName ?? 'Cliente ocasional'}</p>
                    <p className="truncate text-[9.5px] text-muted">{sale.number} · {timeAgo(sale.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11.5px] font-bold text-ink">{money(sale.total, symbol)}</p>
                    <span className={cn('text-[9px] font-semibold', sale.status === 'Cancelled' ? 'text-rose-500' : sale.status === 'Pending' ? 'text-amber-600' : 'text-emerald-600')}>
                      {sale.status === 'Cancelled' ? 'Anulada' : sale.status === 'Pending' ? 'Pendiente' : 'Pagada'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card flex items-center gap-2.5 p-3.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Users className="size-4" /></span>
          <div><p className="font-display text-[15px] font-bold text-ink">{data.totalCustomers}</p><p className="text-[9.5px] text-muted">Clientes</p></div>
        </div>
        <div className="card flex items-center gap-2.5 p-3.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600"><ShoppingBag className="size-4" /></span>
          <div><p className="font-display text-[15px] font-bold text-ink">{data.ordersMonth}</p><p className="text-[9.5px] text-muted">Pedidos del mes</p></div>
        </div>
        <div className="card flex items-center gap-2.5 p-3.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><AlertTriangle className="size-4" /></span>
          <div><p className="font-display text-[15px] font-bold text-ink">{data.lowStockCount}</p><p className="text-[9.5px] text-muted">Stock bajo</p></div>
        </div>
        <div className="card flex items-center gap-2.5 p-3.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><Sparkles className="size-4" /></span>
          <div><p className="font-display text-[15px] font-bold text-ink">{moneyShort(data.inventoryValue, symbol)}</p><p className="text-[9.5px] text-muted">Valor inventario</p></div>
        </div>
      </div>

      {canManageSales && data.pendingSales > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Clock3 className="size-4 shrink-0 text-amber-600" />
          <p className="flex-1 text-[11.5px] text-amber-800">
            Tienes <strong>{data.pendingSales} venta{data.pendingSales === 1 ? '' : 's'}</strong> a crédito pendiente{data.pendingSales === 1 ? '' : 's'} de cobro.
          </p>
          <Link to="/sales" className="text-[11px] font-bold text-amber-800 hover:underline">Revisar</Link>
        </div>
      )}
    </div>
  )
}
