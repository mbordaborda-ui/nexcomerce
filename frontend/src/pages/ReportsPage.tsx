import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  CircleDollarSign,
  Download,
  PieChart as PieIcon,
  Receipt,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { api } from '../lib/api'
import { useAuth, usePermissions } from '../lib/auth'
import type { InventoryReport, ProfitReport, SalesReport } from '../lib/types'
import { dateShort, daysAgoInput, money, moneyShort, numberFormat, paymentLabel, todayInput } from '../lib/format'
import {
  Badge,
  Button,
  EmptyState,
  Input,
  PageHeader,
  PageLoader,
  ProgressBar,
  SectionCard,
  Tabs,
  cn,
} from '../components/ui'

const ranges = [
  { id: '7', label: '7 días' },
  { id: '30', label: '30 días' },
  { id: '90', label: '90 días' },
]

function ChartTooltip({ active, payload, label, symbol, mode = 'money' }: {
  active?: boolean
  payload?: ReadonlyArray<{ value?: number | string; name?: string; color?: string; payload?: any }>
  label?: string | number
  symbol: string
  mode?: 'money' | 'number'
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 shadow-[var(--shadow-float)]">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">{label ? dateShort(String(label)) : ''}</p>
      {payload.map((item, index) => (
        <p key={index} className="flex items-center gap-1.5 text-[11px] text-muted">
          <span className="size-1.5 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="capitalize">{item.name}</span>
          <span className="ml-auto pl-2 font-bold text-ink">
            {mode === 'money' ? money(Number(item.value ?? 0), symbol) : numberFormat(Number(item.value ?? 0))}
          </span>
        </p>
      ))}
    </div>
  )
}

export function ReportsPage() {
  const { session } = useAuth()
  const { canViewReports } = usePermissions()
  const symbol = session?.tenant.currencySymbol ?? '$'

  const [tab, setTab] = useState<'sales' | 'inventory' | 'profit'>('sales')
  const [range, setRange] = useState('30')
  const [from, setFrom] = useState(daysAgoInput(29))
  const [to, setTo] = useState(todayInput())

  const applyRange = (value: string) => {
    setRange(value)
    setFrom(daysAgoInput(Number(value) - 1))
    setTo(todayInput())
  }

  const { data: sales, isLoading: salesLoading } = useQuery({
    queryKey: ['report-sales', from, to],
    queryFn: () => api.get<SalesReport>('/reports/sales', { from, to }),
    enabled: tab === 'sales',
  })

  const { data: inventory, isLoading: inventoryLoading } = useQuery({
    queryKey: ['report-inventory'],
    queryFn: () => api.get<InventoryReport>('/reports/inventory'),
    enabled: tab === 'inventory',
  })

  const { data: profit, isLoading: profitLoading } = useQuery({
    queryKey: ['report-profit', from, to],
    queryFn: () => api.get<ProfitReport>('/reports/profit', { from, to }),
    enabled: tab === 'profit',
  })

  if (!canViewReports && session?.user.role !== 'Owner' && session?.user.role !== 'Admin') {
    return (
      <div className="page">
        <EmptyState title="No tienes acceso a los reportes" description="Pide a un administrador que habilite el permiso de reportes para tu usuario." icon={<BarChart3 className="size-5" />} />
      </div>
    )
  }

  const salesTotal = sales?.series.reduce((sum, item) => sum + item.sales, 0) ?? 0

  return (
    <div className="page">
      <PageHeader
        title="Reportes"
        subtitle="Analiza ventas, inventario y rentabilidad en un solo lugar."
        actions={
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Download className="size-3.5" /> Exportar
          </Button>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'sales', label: 'Ventas', icon: <Receipt className="size-3.5" /> },
            { id: 'inventory', label: 'Inventario', icon: <Boxes className="size-3.5" /> },
            { id: 'profit', label: 'Rentabilidad', icon: <TrendingUp className="size-3.5" /> },
          ]}
        />
        {tab !== 'inventory' && (
          <div className="flex flex-wrap items-center gap-2 no-print">
            <div className="flex rounded-lg bg-brand-50/80 p-0.5">
              {ranges.map((item) => (
                <button
                  key={item.id}
                  onClick={() => applyRange(item.id)}
                  className={cn('rounded-md px-2.5 py-1.5 text-[10.5px] font-semibold transition-colors', range === item.id ? 'bg-white text-brand-700 shadow-sm' : 'text-muted')}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="w-[135px] py-1.5 text-[11px]" aria-label="Desde" />
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="w-[135px] py-1.5 text-[11px]" aria-label="Hasta" />
          </div>
        )}
      </div>

      {tab === 'sales' && (
        salesLoading ? <PageLoader label="Calculando ventas…" /> : !sales ? (
          <EmptyState title="Sin datos para el periodo" description="Ajusta las fechas o registra nuevas ventas." />
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="card p-4">
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Ingresos</p>
                  <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><CircleDollarSign className="size-4" /></span>
                </div>
                <p className="mt-2 font-display text-[20px] font-bold text-ink">{money(sales.total, symbol)}</p>
                <p className="mt-1 text-[10px] text-muted">{sales.count} ventas</p>
              </div>
              <div className="card p-4">
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Ticket promedio</p>
                  <span className="flex size-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600"><Receipt className="size-4" /></span>
                </div>
                <p className="mt-2 font-display text-[20px] font-bold text-ink">{money(sales.average, symbol)}</p>
                <p className="mt-1 text-[10px] text-muted">Por transacción</p>
              </div>
              <div className="card p-4">
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Utilidad bruta</p>
                  <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><TrendingUp className="size-4" /></span>
                </div>
                <p className="mt-2 font-display text-[20px] font-bold text-ink">{money(sales.profit, symbol)}</p>
                <p className="mt-1 text-[10px] text-muted">Costo de ventas {money(sales.cost, symbol)}</p>
              </div>
              <div className="card p-4">
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Impuestos</p>
                  <span className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><Wallet className="size-4" /></span>
                </div>
                <p className="mt-2 font-display text-[20px] font-bold text-ink">{money(sales.tax, symbol)}</p>
                <p className="mt-1 text-[10px] text-muted">Descuentos {money(sales.discount, symbol)}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-3">
              <SectionCard
                className="xl:col-span-2"
                title="Evolución de ingresos"
                subtitle={`${dateShort(sales.from)} — ${dateShort(sales.to)}`}
                action={<Badge tone="violet">{money(salesTotal, symbol)}</Badge>}
                bodyClassName="px-2 pb-3 pt-4"
              >
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sales.series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="reportSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0ECFA" />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 9.5, fill: '#8b86a0' }} tickFormatter={(value: string) => dateShort(value)} minTickGap={26} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 9.5, fill: '#8b86a0' }} tickFormatter={(value: number) => moneyShort(value, symbol)} width={54} />
                      <Tooltip content={<ChartTooltip symbol={symbol} />} />
                      <Area type="monotone" dataKey="sales" name="Ventas" stroke="#7C3AED" strokeWidth={2.4} fill="url(#reportSales)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>

              <SectionCard title="Métodos de pago" subtitle="Participación en ingresos" bodyClassName="pt-3">
                {sales.byPayment.length === 0 ? (
                  <EmptyState title="Sin pagos" description="No hay pagos en el periodo." />
                ) : (
                  <div className="space-y-3">
                    {sales.byPayment.map((payment) => {
                      const share = sales.total > 0 ? (payment.total / sales.total) * 100 : 0
                      return (
                        <div key={payment.method}>
                          <div className="mb-1 flex items-center justify-between text-[11.5px]">
                            <span className="font-medium text-ink">{paymentLabel(payment.method)} <span className="text-muted">({payment.count})</span></span>
                            <span className="font-bold text-ink">{money(payment.total, symbol)}</span>
                          </div>
                          <ProgressBar value={share} />
                          <p className="mt-0.5 text-right text-[9.5px] text-muted">{share.toFixed(1)}%</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </SectionCard>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <SectionCard title="Productos más vendidos" subtitle="Por unidades" bodyClassName="p-2">
                {sales.topProducts.length === 0 ? (
                  <EmptyState title="Sin productos vendidos" description="No hay ventas en el periodo." />
                ) : (
                  <div className="space-y-1">
                    {sales.topProducts.map((product, index) => (
                      <div key={product.id} className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-brand-50/50">
                        <span className="w-3 text-center font-display text-[11px] font-bold text-brand-300">{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-semibold text-ink">{product.name}</p>
                          <p className="text-[10px] text-muted">{product.categoryName ?? 'Sin categoría'} · {product.quantity} uds</p>
                        </div>
                        <p className="text-[11.5px] font-bold text-ink">{money(product.total, symbol)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Categorías" subtitle="Ventas por categoría" bodyClassName="pt-2">
                {sales.byCategory.length === 0 ? (
                  <EmptyState title="Sin categorías" description="No hay ventas categorizadas." />
                ) : (
                  <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sales.byCategory} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0ECFA" />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: '#8b86a0' }} interval={0} angle={-18} textAnchor="end" height={46} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 9.5, fill: '#8b86a0' }} tickFormatter={(value: number) => moneyShort(value, symbol)} width={50} />
                        <Tooltip content={<ChartTooltip symbol={symbol} />} cursor={{ fill: '#F6F3FF' }} />
                        <Bar dataKey="total" name="Total" radius={[6, 6, 0, 0]}>
                          {sales.byCategory.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </SectionCard>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <SectionCard title="Ventas por vendedor" bodyClassName="p-2">
                <div className="space-y-1">
                  {sales.bySeller.map((seller) => (
                    <div key={seller.name} className="flex items-center gap-3 rounded-xl px-2.5 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-ink">{seller.name}</p>
                        <p className="text-[10px] text-muted">{seller.orders} ventas</p>
                      </div>
                      <p className="text-[11.5px] font-bold text-ink">{money(seller.total, symbol)}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>
              <SectionCard title="Ventas por sede" bodyClassName="p-2">
                <div className="space-y-1">
                  {sales.byBranch.map((branch) => (
                    <div key={branch.name} className="flex items-center gap-3 rounded-xl px-2.5 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-ink">{branch.name}</p>
                        <p className="text-[10px] text-muted">{branch.orders} ventas</p>
                      </div>
                      <p className="text-[11.5px] font-bold text-ink">{money(branch.total, symbol)}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>

            <SectionCard className="mt-4" title="Últimas ventas del periodo" bodyClassName="p-2">
              <div className="hide-scrollbar overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Ticket</th>
                      <th>Cliente</th>
                      <th>Fecha</th>
                      <th>Pago</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.sales.slice(0, 15).map((sale) => (
                      <tr key={sale.id}>
                        <td className="text-[11.5px] font-semibold text-ink">{sale.number}</td>
                        <td className="text-[11.5px]">{sale.customerName ?? 'Cliente ocasional'}</td>
                        <td className="text-[11px] text-muted">{dateShort(sale.createdAt)}</td>
                        <td className="text-[11px] text-muted">{paymentLabel(sale.paymentMethod)}</td>
                        <td className="text-right text-[11.5px] font-bold text-ink">{money(sale.total, symbol)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </>
        )
      )}

      {tab === 'inventory' && (
        inventoryLoading ? <PageLoader label="Calculando inventario…" /> : !inventory ? (
          <EmptyState title="Sin datos de inventario" description="Agrega productos para ver este reporte." />
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="card p-4">
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Referencias</p>
                  <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Boxes className="size-4" /></span>
                </div>
                <p className="mt-2 font-display text-[20px] font-bold text-ink">{inventory.summary.products}</p>
                <p className="mt-1 text-[10px] text-muted">{numberFormat(inventory.summary.stockUnits)} unidades</p>
              </div>
              <div className="card p-4">
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Valor costo</p>
                  <span className="flex size-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600"><Wallet className="size-4" /></span>
                </div>
                <p className="mt-2 font-display text-[20px] font-bold text-ink">{money(inventory.summary.stockValue, symbol)}</p>
                <p className="mt-1 text-[10px] text-muted">Inversión actual</p>
              </div>
              <div className="card p-4">
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Valor venta</p>
                  <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><TrendingUp className="size-4" /></span>
                </div>
                <p className="mt-2 font-display text-[20px] font-bold text-ink">{money(inventory.summary.retailValue, symbol)}</p>
                <p className="mt-1 text-[10px] text-muted">Potencial de venta</p>
              </div>
              <div className="card p-4">
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Alertas</p>
                  <span className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><ArrowDownRight className="size-4" /></span>
                </div>
                <p className="mt-2 font-display text-[20px] font-bold text-ink">{inventory.summary.lowStock}</p>
                <p className="mt-1 text-[10px] text-muted">{inventory.summary.outOfStock} agotados</p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <SectionCard title="Inventario por categoría" subtitle="Costo y valor de venta" bodyClassName="p-0">
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Categoría</th>
                        <th className="text-right">Unidades</th>
                        <th className="text-right">Costo</th>
                        <th className="text-right">Venta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.byCategory.map((category) => (
                        <tr key={category.name}>
                          <td>
                            <span className="inline-flex items-center gap-2 text-[12px] font-medium text-ink">
                              <span className="size-2 rounded-full" style={{ backgroundColor: category.color }} />
                              {category.name}
                            </span>
                          </td>
                          <td className="text-right text-[11.5px] text-muted">{numberFormat(category.units)}</td>
                          <td className="text-right text-[11.5px] text-ink">{money(category.costValue, symbol)}</td>
                          <td className="text-right text-[11.5px] font-semibold text-ink">{money(category.retailValue, symbol)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              <SectionCard title="Alertas de stock" subtitle="Reposición prioritaria" bodyClassName="p-2">
                {inventory.lowStock.length === 0 ? (
                  <EmptyState title="Inventario saludable" description="No hay productos por debajo del mínimo." />
                ) : (
                  <div className="space-y-1">
                    {inventory.lowStock.slice(0, 8).map((item) => (
                      <div key={item.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-semibold text-ink">{item.name}</p>
                          <p className="text-[10px] text-muted">{item.categoryName ?? 'Sin categoría'} · mínimo {item.minStock}</p>
                        </div>
                        <span className={cn('rounded-lg px-2 py-1 text-[10px] font-bold', item.stock === 0 ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700')}>
                          {item.stock === 0 ? 'Agotado' : `${item.stock} uds`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>

            <SectionCard className="mt-4" title="Movimientos recientes" subtitle="Últimos 25 registros" bodyClassName="p-0">
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Tipo</th>
                      <th className="text-right">Cantidad</th>
                      <th className="text-right">Antes</th>
                      <th className="text-right">Después</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.recentMovements.map((movement) => (
                      <tr key={movement.id}>
                        <td className="text-[12px] font-medium text-ink">{movement.productName}{movement.variantName ? ` · ${movement.variantName}` : ''}</td>
                        <td><Badge tone={movement.type === 'Out' || movement.type === 'Sale' ? 'rose' : 'green'}>{movement.type}</Badge></td>
                        <td className="text-right text-[11.5px] font-bold text-ink">{movement.quantity}</td>
                        <td className="text-right text-[11px] text-muted">{movement.previousStock}</td>
                        <td className="text-right text-[11.5px] text-ink">{movement.newStock}</td>
                        <td className="text-[11px] text-muted">{dateShort(movement.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </>
        )
      )}

      {tab === 'profit' && (
        profitLoading ? <PageLoader label="Calculando rentabilidad…" /> : !profit ? (
          <EmptyState title="Sin datos de rentabilidad" description="Ajusta las fechas o registra ventas y gastos." />
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="card p-4">
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Ingresos netos</p>
                  <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><CircleDollarSign className="size-4" /></span>
                </div>
                <p className="mt-2 font-display text-[20px] font-bold text-ink">{money(profit.revenue, symbol)}</p>
                <p className="mt-1 text-[10px] text-muted">Sin impuestos</p>
              </div>
              <div className="card p-4">
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Utilidad bruta</p>
                  <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><ArrowUpRight className="size-4" /></span>
                </div>
                <p className="mt-2 font-display text-[20px] font-bold text-ink">{money(profit.grossProfit, symbol)}</p>
                <p className="mt-1 text-[10px] text-muted">Costo {money(profit.cost, symbol)}</p>
              </div>
              <div className="card p-4">
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Gastos</p>
                  <span className="flex size-8 items-center justify-center rounded-lg bg-rose-50 text-rose-500"><ArrowDownRight className="size-4" /></span>
                </div>
                <p className="mt-2 font-display text-[20px] font-bold text-ink">{money(profit.expenses, symbol)}</p>
                <p className="mt-1 text-[10px] text-muted">Operación del periodo</p>
              </div>
              <div className={cn('card p-4', profit.netProfit >= 0 ? 'bg-gradient-to-br from-brand-600 to-brand-800 text-white' : 'bg-rose-50')}>
                <div className="flex items-start justify-between">
                  <p className={cn('text-[11px] font-semibold uppercase tracking-wide', profit.netProfit >= 0 ? 'text-white/70' : 'text-rose-600')}>Utilidad neta</p>
                  <PieIcon className={cn('size-4', profit.netProfit >= 0 ? 'text-white/70' : 'text-rose-500')} />
                </div>
                <p className={cn('mt-2 font-display text-[20px] font-bold', profit.netProfit >= 0 ? 'text-white' : 'text-rose-700')}>{money(profit.netProfit, symbol)}</p>
                <p className={cn('mt-1 text-[10px]', profit.netProfit >= 0 ? 'text-white/70' : 'text-rose-500')}>Margen {profit.margin}%</p>
              </div>
            </div>

            <SectionCard className="mt-4" title="Ingresos, costos y gastos" subtitle={`${dateShort(profit.from)} — ${dateShort(profit.to)}`} bodyClassName="px-2 pb-3 pt-4">
              <div className="mb-2 flex flex-wrap items-center gap-3 px-2 text-[10.5px] text-muted">
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-brand-500" /> Ingresos</span>
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-400" /> Costos</span>
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-rose-400" /> Gastos</span>
              </div>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={profit.series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0ECFA" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 9.5, fill: '#8b86a0' }} tickFormatter={(value: string) => dateShort(value)} minTickGap={22} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 9.5, fill: '#8b86a0' }} tickFormatter={(value: number) => moneyShort(value, symbol)} width={54} />
                    <Tooltip content={<ChartTooltip symbol={symbol} />} cursor={{ fill: '#F6F3FF' }} />
                    <Bar dataKey="revenue" name="Ingresos" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cost" name="Costos" fill="#FBBF24" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Gastos" fill="#FB7185" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <SectionCard title="Gastos por categoría" subtitle="Distribución del periodo" bodyClassName="p-2">
                {profit.expenseCategories.length === 0 ? (
                  <EmptyState title="Sin gastos" description="Registra gastos para ver su distribución." />
                ) : (
                  <div className="space-y-1">
                    {profit.expenseCategories.map((category) => (
                      <div key={category.category} className="flex items-center justify-between gap-3 rounded-xl px-2.5 py-2">
                        <div>
                          <p className="text-[12px] font-semibold text-ink">{category.category}</p>
                          <p className="text-[10px] text-muted">{category.count} registro{category.count === 1 ? '' : 's'}</p>
                        </div>
                        <p className="text-[11.5px] font-bold text-rose-600">-{money(category.total, symbol)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Resumen del periodo" subtitle="Del ingreso a la utilidad" bodyClassName="pt-2">
                <div className="space-y-2.5 text-[12px]">
                  <div className="flex justify-between"><span className="text-muted">Ingresos netos</span><span className="font-semibold text-ink">{money(profit.revenue, symbol)}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Costo de ventas</span><span className="font-semibold text-rose-500">-{money(profit.cost, symbol)}</span></div>
                  <div className="flex justify-between border-t border-line pt-2"><span className="font-semibold text-ink">Utilidad bruta</span><span className="font-bold text-ink">{money(profit.grossProfit, symbol)}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Gastos operativos</span><span className="font-semibold text-rose-500">-{money(profit.expenses, symbol)}</span></div>
                  <div className="flex justify-between border-t border-line pt-2"><span className="font-bold text-ink">Utilidad neta</span><span className={cn('font-display text-[18px] font-extrabold', profit.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600')}>{money(profit.netProfit, symbol)}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Margen neto</span><span className="font-bold text-brand-700">{profit.margin}%</span></div>
                </div>
              </SectionCard>
            </div>
          </>
        )
      )}
    </div>
  )
}
