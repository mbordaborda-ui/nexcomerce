import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  CircleDollarSign,
  Clock,
  Instagram,
  MessageCircle,
  PackageCheck,
  Phone,
  Plus,
  ReceiptText,
  ShoppingBag,
  Store,
  Trash2,
  Truck,
  UserRound,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Customer, Order, OrdersOverview, PageResult, Product } from '../lib/types'
import { dateShort, dateTime, money, orderChannelLabel, orderStatusLabel, paymentLabel } from '../lib/format'
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  PageLoader,
  SearchInput,
  Select,
  StatCard,
  Tabs,
  cn,
  useToast,
} from '../components/ui'

type OrderFilter = 'all' | 'Pending' | 'Confirmed' | 'Preparing' | 'Ready' | 'Delivered' | 'Cancelled'

type DraftItem = { key: string; productId: string; productName: string; quantity: string; unitPrice: string }

const emptyItem = (): DraftItem => ({
  key: Math.random().toString(36).slice(2),
  productId: '',
  productName: '',
  quantity: '1',
  unitPrice: '',
})

const statusTone: Record<string, 'violet' | 'amber' | 'green' | 'rose' | 'gray'> = {
  Pending: 'amber',
  Confirmed: 'violet',
  Preparing: 'violet',
  Ready: 'green',
  Delivered: 'green',
  Cancelled: 'gray',
}

const nextStatus: Record<string, string> = {
  Pending: 'Confirmed',
  Confirmed: 'Preparing',
  Preparing: 'Ready',
  Ready: 'Delivered',
}

function channelIcon(channel: string) {
  if (channel === 'WhatsApp') return MessageCircle
  if (channel === 'Instagram') return Instagram
  if (channel === 'Phone') return Phone
  return Store
}

export function OrdersPage() {
  const { session } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const symbol = session?.tenant.currencySymbol ?? '$'

  const [filter, setFilter] = useState<OrderFilter>('all')
  const [channel, setChannel] = useState('')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [convertOpen, setConvertOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  const [form, setForm] = useState({
    channel: 'WhatsApp',
    customerId: '',
    customerName: '',
    customerPhone: '',
    dueAt: '',
    notes: '',
    items: [emptyItem()],
  })
  const [convert, setConvert] = useState({ orderId: '', method: 'Cash', paidAmount: '', dueDays: '30' })

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['orders', filter, channel, search],
    queryFn: () =>
      api.get<OrdersOverview>('/orders', {
        status: filter === 'all' ? undefined : filter,
        channel: channel || undefined,
        search: search.trim() || undefined,
      }),
  })

  const { data: productsPage } = useQuery({
    queryKey: ['order-products'],
    queryFn: () => api.get<PageResult<Product>>('/products', { pageSize: 200 }),
    staleTime: 120_000,
  })
  const { data: customersPage } = useQuery({
    queryKey: ['customers-lite'],
    queryFn: () => api.get<PageResult<Customer>>('/customers', { pageSize: 200 }),
    staleTime: 120_000,
  })
  const products = productsPage?.items ?? []
  const customers = customersPage?.items ?? []

  const orders = data?.items ?? []
  const stats = data?.stats
  const selected = useMemo(() => orders.find((order) => order.id === detailId) ?? null, [orders, detailId])
  const converting = useMemo(() => orders.find((order) => order.id === convert.orderId) ?? selected, [orders, convert.orderId, selected])

  const draftTotal = form.items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0)
  const convertInvalid = convert.method === 'Credit' && (Number(convert.paidAmount) || 0) > (converting?.total ?? 0)

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['orders'] })
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<Order>('/orders', {
        channel: form.channel,
        customerId: form.customerId || null,
        customerName: form.customerName || 'Cliente ocasional',
        customerPhone: form.customerPhone || null,
        dueAt: form.dueAt || null,
        notes: form.notes || null,
        items: form.items
          .filter((item) => item.productName.trim() || item.productId)
          .map((item) => ({
            productId: item.productId || null,
            productName: item.productName,
            quantity: Number(item.quantity) || 0,
            unitPrice: item.unitPrice === '' ? null : Number(item.unitPrice),
            notes: null,
          })),
      }),
    onSuccess: () => {
      toast('Pedido creado.')
      setCreateOpen(false)
      setForm({ channel: 'WhatsApp', customerId: '', customerName: '', customerPhone: '', dueAt: '', notes: '', items: [emptyItem()] })
      invalidate()
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo crear el pedido.', 'error'),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.put<Order>(`/orders/${id}/status`, { status }),
    onSuccess: () => {
      toast('Estado del pedido actualizado.')
      invalidate()
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo actualizar el pedido.', 'error'),
  })

  const convertMutation = useMutation({
    mutationFn: () =>
      api.post<{ order: Order; saleNumber: string }>(`/orders/${converting?.id}/convert`, {
        paymentMethod: convert.method,
        paidAmount: convert.method === 'Credit' ? Number(convert.paidAmount) || 0 : undefined,
        dueDays: convert.method === 'Credit' ? Number(convert.dueDays) || 30 : null,
      }),
    onSuccess: (result) => {
      toast(`Pedido convertido en la venta ${result.saleNumber}.`)
      setConvertOpen(false)
      setDetailId(null)
      invalidate()
      void queryClient.invalidateQueries({ queryKey: ['sales'] })
      void queryClient.invalidateQueries({ queryKey: ['cash'] })
      void queryClient.invalidateQueries({ queryKey: ['receivables'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo convertir el pedido.', 'error'),
  })

  const openCreate = () => {
    setForm({ channel: 'WhatsApp', customerId: '', customerName: '', customerPhone: '', dueAt: '', notes: '', items: [emptyItem()] })
    setCreateOpen(true)
  }

  const updateItem = (key: string, patch: Partial<DraftItem>) => {
    setForm((current) => ({ ...current, items: current.items.map((item) => (item.key === key ? { ...item, ...patch } : item)) }))
  }

  const pickProduct = (key: string, productId: string) => {
    const product = products.find((item) => item.id === productId)
    updateItem(key, {
      productId,
      productName: product?.name ?? '',
      unitPrice: product ? String(product.price) : '',
    })
  }

  const openConvert = (order: Order) => {
    setConvert({ orderId: order.id, method: 'Cash', paidAmount: '', dueDays: '30' })
    setConvertOpen(true)
  }

  const openDetail = (order: Order) => {
    setDetailId(order.id)
    setConvert({ orderId: order.id, method: 'Cash', paidAmount: '', dueDays: '30' })
  }

  if (isLoading) return <PageLoader label="Cargando pedidos…" />
  if (isError || !data) {
    return (
      <div className="page">
        <EmptyState title="No pudimos cargar los pedidos" description="Revisa tu conexión e intenta de nuevo." action={<Button onClick={() => refetch()}>Reintentar</Button>} />
      </div>
    )
  }

  const createValid =
    form.items.some((item) => (item.productName.trim() || item.productId) && Number(item.quantity) > 0) &&
    (!form.customerId ? form.customerName.trim().length > 0 || form.channel === 'Counter' : true)

  return (
    <div className="page">
      <PageHeader
        title="Pedidos"
        subtitle="Centraliza pedidos de WhatsApp, Instagram y mostrador. Convierte cada pedido en venta con un clic."
        actions={<Button size="sm" onClick={openCreate}><Plus className="size-4" /> Nuevo pedido</Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Nuevos" value={stats?.pending ?? 0} icon={<ShoppingBag className="size-4" />} tone="amber" hint="Por confirmar" />
        <StatCard label="En preparación" value={(stats?.confirmed ?? 0) + (stats?.preparing ?? 0)} icon={<ChefHat className="size-4" />} tone="violet" hint="Confirmados y alistando" />
        <StatCard label="Listos para entregar" value={stats?.ready ?? 0} icon={<PackageCheck className="size-4" />} tone="green" hint="Esperando entrega" />
        <StatCard label="Ventas de pedidos hoy" value={money(stats?.revenueToday ?? 0, symbol)} icon={<CircleDollarSign className="size-4" />} tone="blue" hint={`${stats?.deliveredToday ?? 0} entregados`} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card flex items-center gap-3 p-3.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><MessageCircle className="size-4" /></span>
          <div>
            <p className="text-[15px] font-bold text-ink">{stats?.whatsAppOpen ?? 0}</p>
            <p className="text-[10px] text-muted">abiertos en WhatsApp</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-3.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-rose-50 text-rose-500"><Instagram className="size-4" /></span>
          <div>
            <p className="text-[15px] font-bold text-ink">{stats?.instagramOpen ?? 0}</p>
            <p className="text-[10px] text-muted">abiertos en Instagram</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-3.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Truck className="size-4" /></span>
          <div>
            <p className="text-[15px] font-bold text-ink">{stats?.deliveredToday ?? 0}</p>
            <p className="text-[10px] text-muted">entregados hoy</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-3.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Clock className="size-4" /></span>
          <div>
            <p className="text-[15px] font-bold text-ink">{(stats?.pending ?? 0) + (stats?.confirmed ?? 0) + (stats?.preparing ?? 0) + (stats?.ready ?? 0)}</p>
            <p className="text-[10px] text-muted">pedidos en curso</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
        <Tabs
          value={filter}
          onChange={(value) => setFilter(value)}
          tabs={[
            { id: 'all', label: 'Todos', count: orders.length },
            { id: 'Pending', label: 'Nuevos', count: stats?.pending },
            { id: 'Confirmed', label: 'Confirmados', count: stats?.confirmed },
            { id: 'Preparing', label: 'Preparando', count: stats?.preparing },
            { id: 'Ready', label: 'Listos', count: stats?.ready },
            { id: 'Delivered', label: 'Entregados' },
            { id: 'Cancelled', label: 'Cancelados' },
          ]}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={channel} onChange={(event) => setChannel(event.target.value)} className="sm:w-44">
            <option value="">Todos los canales</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="Instagram">Instagram</option>
            <option value="Counter">Mostrador</option>
            <option value="Phone">Teléfono</option>
            <option value="Other">Otro</option>
          </Select>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar pedido o cliente…" className="sm:w-64" />
        </div>
      </div>

      <section className="card mt-3 overflow-hidden">
        {orders.length === 0 ? (
          <EmptyState
            title="No hay pedidos"
            description={search || filter !== 'all' || channel ? 'Prueba con otros filtros o crea un nuevo pedido.' : 'Crea tu primer pedido para organizar la operación de WhatsApp, Instagram y mostrador.'}
            icon={<ShoppingBag className="size-5" />}
            action={<Button onClick={openCreate}><Plus className="size-4" /> Nuevo pedido</Button>}
          />
        ) : (
          <div className="divide-y divide-line">
            {orders.map((order) => {
              const ChannelIcon = channelIcon(order.channel)
              const flow = nextStatus[order.status]
              return (
                <div key={order.id} className="px-4 py-3.5 sm:px-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <button type="button" onClick={() => openDetail(order)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', order.channel === 'WhatsApp' ? 'bg-emerald-50 text-emerald-600' : order.channel === 'Instagram' ? 'bg-rose-50 text-rose-500' : 'bg-brand-50 text-brand-600')}>
                        <ChannelIcon className="size-4.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="font-mono text-[11.5px] font-bold text-ink">{order.number}</p>
                          <Badge tone={statusTone[order.status] ?? 'gray'} className="!px-1.5 !py-0.5 !text-[9.5px]">{orderStatusLabel(order.status)}</Badge>
                          <Badge tone="gray" className="!px-1.5 !py-0.5 !text-[9.5px]">{orderChannelLabel(order.channel)}</Badge>
                          {order.saleNumber && (
                            <Badge tone="green" className="!px-1.5 !py-0.5 !text-[9.5px]"><BadgeCheck className="size-2.5" /> {order.saleNumber}</Badge>
                          )}
                        </div>
                        <p className="mt-1 truncate text-[12.5px] font-semibold text-ink">{order.customerName}</p>
                        <p className="truncate text-[10.5px] text-muted">
                          {order.itemCount} producto{order.itemCount === 1 ? '' : 's'} · {dateTime(order.createdAt)}
                          {order.customerPhone ? ` · ${order.customerPhone}` : ''}
                          {order.dueAt ? ` · entrega ${dateShort(order.dueAt)}` : ''}
                        </p>
                        <p className="mt-1 truncate text-[10.5px] text-muted">
                          {order.items.map((item) => `${item.quantity}× ${item.productName}`).join(' · ')}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                      <p className="text-[13.5px] font-bold text-ink">{money(order.total, symbol)}</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {flow && order.status !== 'Cancelled' && (
                          <Button
                            size="sm"
                            variant="soft"
                            className="!py-1"
                            onClick={() => statusMutation.mutate({ id: order.id, status: flow })}
                            loading={statusMutation.isPending && statusMutation.variables?.id === order.id}
                          >
                            {orderStatusLabel(flow)} <ArrowRight className="size-3" />
                          </Button>
                        )}
                        {!order.saleId && order.status !== 'Cancelled' && (
                          <Button size="sm" className="!py-1" onClick={() => openConvert(order)}>
                            <ReceiptText className="size-3" /> Convertir
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nuevo pedido"
        subtitle="Registra el pedido tal como llegó por WhatsApp, Instagram o mostrador."
        size="lg"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] text-muted">Total del pedido</p>
              <p className="font-display text-[18px] font-extrabold text-ink">{money(draftTotal, symbol)}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending} disabled={!createValid}>Crear pedido</Button>
            </div>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Canal" required>
            <Select value={form.channel} onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value }))}>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Instagram">Instagram</option>
              <option value="Counter">Mostrador</option>
              <option value="Phone">Teléfono</option>
              <option value="Other">Otro</option>
            </Select>
          </Field>
          <Field label="Cliente registrado">
            <Select
              value={form.customerId}
              onChange={(event) => {
                const customer = customers.find((item) => item.id === event.target.value)
                setForm((current) => ({
                  ...current,
                  customerId: event.target.value,
                  customerName: customer?.name ?? current.customerName,
                  customerPhone: customer?.phone ?? current.customerPhone,
                }))
              }}
            >
              <option value="">Cliente ocasional / manual</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </Select>
          </Field>
          <Field label="Nombre del cliente">
            <Input value={form.customerName} onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))} placeholder="Nombre o alias" disabled={Boolean(form.customerId)} />
          </Field>
          <Field label="Teléfono / WhatsApp">
            <Input value={form.customerPhone} onChange={(event) => setForm((current) => ({ ...current, customerPhone: event.target.value }))} placeholder="+57 300 000 0000" />
          </Field>
          <Field label="Fecha de entrega">
            <Input type="date" value={form.dueAt} onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))} />
          </Field>
          <Field label="Notas">
            <Input value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Dirección, indicaciones…" />
          </Field>

          <div className="sm:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12px] font-bold text-ink">Productos del pedido</p>
              <Button size="sm" variant="soft" onClick={() => setForm((current) => ({ ...current, items: [...current.items, emptyItem()] }))}>
                <Plus className="size-3.5" /> Agregar
              </Button>
            </div>
            <div className="space-y-2">
              {form.items.map((item) => (
                <div key={item.key} className="rounded-xl border border-line bg-canvas/60 p-2.5">
                  <div className="grid gap-2 sm:grid-cols-[1.3fr_1.2fr_70px_100px_36px] sm:items-end">
                    <Field label="Producto">
                      <Select value={item.productId} onChange={(event) => pickProduct(item.key, event.target.value)}>
                        <option value="">Manual</option>
                        {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                      </Select>
                    </Field>
                    <Field label="Descripción">
                      <Input value={item.productName} onChange={(event) => updateItem(item.key, { productName: event.target.value })} placeholder="Nombre del producto" />
                    </Field>
                    <Field label="Cant.">
                      <Input inputMode="numeric" value={item.quantity} onChange={(event) => updateItem(item.key, { quantity: event.target.value.replace(/\D/g, '') })} />
                    </Field>
                    <Field label="Precio">
                      <Input inputMode="decimal" value={item.unitPrice} onChange={(event) => updateItem(item.key, { unitPrice: event.target.value })} placeholder="0.00" />
                    </Field>
                    <button
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, items: current.items.length > 1 ? current.items.filter((row) => row.key !== item.key) : [emptyItem()] }))}
                      className="icon-btn mb-0.5 justify-self-start border border-line bg-white text-rose-500 sm:justify-self-auto"
                      aria-label="Quitar producto"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-[11px] text-brand-800 sm:col-span-2">
            <CalendarDays className="size-4 shrink-0" />
            Puedes convertir este pedido en venta cuando esté confirmado o entregado.
          </div>
        </div>
      </Modal>

      <Modal
        open={detailId !== null && !convertOpen}
        onClose={() => setDetailId(null)}
        title={selected ? `Pedido ${selected.number}` : 'Pedido'}
        subtitle={selected ? `${orderChannelLabel(selected.channel)} · ${dateTime(selected.createdAt)}` : undefined}
        size="md"
        footer={
          selected ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] text-muted">Total</p>
                <p className="font-display text-[18px] font-extrabold text-ink">{money(selected.total, symbol)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {selected.status !== 'Cancelled' && selected.status !== 'Delivered' && (
                  <Select
                    value={selected.status}
                    onChange={(event) => statusMutation.mutate({ id: selected.id, status: event.target.value })}
                    className="w-40"
                  >
                    <option value="Pending">Nuevo</option>
                    <option value="Confirmed">Confirmado</option>
                    <option value="Preparing">En preparación</option>
                    <option value="Ready">Listo</option>
                    <option value="Delivered">Entregado</option>
                    <option value="Cancelled">Cancelado</option>
                  </Select>
                )}
                {!selected.saleId && selected.status !== 'Cancelled' && (
                  <Button size="sm" onClick={() => openConvert(selected)}>
                    <ReceiptText className="size-3.5" /> Convertir en venta
                  </Button>
                )}
              </div>
            </div>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={statusTone[selected.status] ?? 'gray'}>{orderStatusLabel(selected.status)}</Badge>
              <Badge tone="gray">{orderChannelLabel(selected.channel)}</Badge>
              {selected.saleNumber && <Badge tone="green"><BadgeCheck className="size-3" /> Venta {selected.saleNumber}</Badge>}
            </div>

            <div className="rounded-2xl border border-line bg-canvas/70 p-3.5">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm"><UserRound className="size-4.5" /></span>
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-bold text-ink">{selected.customerName}</p>
                  <p className="truncate text-[10.5px] text-muted">{selected.customerPhone ?? 'Sin teléfono'}{selected.dueAt ? ` · entrega ${dateShort(selected.dueAt)}` : ''}</p>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[12px] font-bold text-ink">Productos</p>
              <div className="divide-y divide-line rounded-xl border border-line">
                {selected.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><PackageCheck className="size-3.5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11.5px] font-semibold text-ink">{item.productName}</p>
                      <p className="text-[10px] text-muted">{item.quantity} × {money(item.unitPrice, symbol)}</p>
                    </div>
                    <p className="text-[12px] font-bold text-ink">{money(item.total, symbol)}</p>
                  </div>
                ))}
                <div className="flex items-center justify-between bg-canvas px-3 py-2.5">
                  <span className="text-[11.5px] font-bold text-ink">Total</span>
                  <span className="font-display text-[15px] font-extrabold text-ink">{money(selected.total, symbol)}</span>
                </div>
              </div>
            </div>

            {selected.notes && (
              <div className="rounded-xl bg-canvas px-3 py-2.5 text-[11px] text-muted">
                <p className="font-semibold text-ink">Notas</p>
                <p className="mt-0.5">{selected.notes}</p>
              </div>
            )}

            {selected.saleId && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-[11px] font-semibold text-emerald-700">
                <CheckCircle2 className="size-4" /> Este pedido ya generó la venta {selected.saleNumber}. Gestiona el cobro desde Ventas.
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={convertOpen}
        onClose={() => setConvertOpen(false)}
        title="Convertir pedido en venta"
        subtitle={converting ? `Pedido ${converting.number} · ${money(converting.total, symbol)}` : undefined}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConvertOpen(false)}>Cancelar</Button>
            <Button onClick={() => convertMutation.mutate()} loading={convertMutation.isPending} disabled={convertInvalid}>
              <ReceiptText className="size-4" /> Convertir en venta
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="Método de pago" required>
            <Select
              value={convert.method}
              onChange={(event) => setConvert((current) => ({ ...current, method: event.target.value }))}
            >
              <option value="Cash">Efectivo</option>
              <option value="Card">Tarjeta</option>
              <option value="Transfer">Transferencia</option>
              <option value="Nequi">Nequi</option>
              <option value="Daviplata">Daviplata</option>
              <option value="Credit">Crédito</option>
              <option value="Other">Otro</option>
            </Select>
          </Field>
          {convert.method === 'Credit' ? (
            <>
              <Field label="Abono inicial" hint="Déjalo en 0 para registrar toda la deuda en cuentas por cobrar.">
                <Input inputMode="decimal" value={convert.paidAmount} onChange={(event) => setConvert((current) => ({ ...current, paidAmount: event.target.value }))} placeholder="0.00" />
              </Field>
              {convertInvalid && (
                <p className="text-[11px] font-medium text-rose-600">El abono inicial no puede superar el total del pedido.</p>
              )}
              <Field label="Días de plazo">
                <Input inputMode="numeric" value={convert.dueDays} onChange={(event) => setConvert((current) => ({ ...current, dueDays: event.target.value.replace(/\D/g, '') }))} placeholder="30" />
              </Field>
              <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-800">
                Se creará automáticamente una cuenta por cobrar por el saldo pendiente.
              </div>
            </>
          ) : (
            <div className="rounded-xl bg-canvas px-3 py-2.5 text-[11px] leading-relaxed text-muted">
              Al convertir, se descuenta el inventario y la venta queda registrada con pago en{' '}
              <span className="font-semibold text-ink">{paymentLabel(convert.method)}</span>.
            </div>
          )}
          <div className="rounded-xl bg-emerald-50 px-3 py-2.5 text-[11px] leading-relaxed text-emerald-800">
            <p className="font-semibold">Se validará el stock disponible</p>
            <p className="mt-0.5">Si algún producto no tiene unidades suficientes, te lo indicaremos antes de generar la venta.</p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
