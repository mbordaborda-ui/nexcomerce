import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  CreditCard,
  HandCoins,
  Phone,
  Plus,
  ReceiptText,
  UserRound,
  Wallet,
  XCircle,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth, usePermissions } from '../lib/auth'
import type { Customer, PageResult, Receivable, ReceivablesOverview } from '../lib/types'
import { dateShort, daysAgoInput, money, paymentLabel, receivableStatusLabel, todayInput } from '../lib/format'
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  PageLoader,
  ProgressBar,
  SearchInput,
  Select,
  StatCard,
  Tabs,
  Textarea,
  useToast,
} from '../components/ui'

type ReceivableFilter = 'all' | 'pending' | 'overdue' | 'partial' | 'paid' | 'cancelled'

const statusTone: Record<string, 'green' | 'amber' | 'rose' | 'gray' | 'violet'> = {
  Pending: 'amber',
  Partial: 'violet',
  Paid: 'green',
  Cancelled: 'gray',
}

export function ReceivablesPage() {
  const { session } = useAuth()
  const { canManageCustomers } = usePermissions()
  const toast = useToast()
  const queryClient = useQueryClient()
  const symbol = session?.tenant.currencySymbol ?? '$'

  const [filter, setFilter] = useState<ReceivableFilter>('all')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [payOpen, setPayOpen] = useState(false)

  const [form, setForm] = useState({
    customerId: '',
    customerName: '',
    customerPhone: '',
    concept: '',
    total: '',
    issuedAt: todayInput(),
    dueDate: daysAgoInput(-30),
    notes: '',
  })
  const [payment, setPayment] = useState({ amount: '', method: 'Cash', reference: '', notes: '' })

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['receivables', filter, search],
    queryFn: () =>
      api.get<ReceivablesOverview>('/receivables', {
        status: filter === 'all' ? undefined : filter,
        search: search.trim() || undefined,
      }),
  })

  const { data: customersPage } = useQuery({
    queryKey: ['customers-lite'],
    queryFn: () => api.get<PageResult<Customer>>('/customers', { pageSize: 200 }),
    staleTime: 120_000,
  })
  const customers = customersPage?.items ?? []

  const items = data?.items ?? []
  const summary = data?.summary
  const selected = useMemo(() => items.find((item) => item.id === detailId) ?? null, [items, detailId])

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['receivables'] })
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    void queryClient.invalidateQueries({ queryKey: ['report-profit'] })
  }

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<Receivable>('/receivables', {
        customerId: form.customerId || null,
        customerName: form.customerName,
        customerPhone: form.customerPhone || null,
        concept: form.concept,
        total: Number(form.total) || 0,
        issuedAt: form.issuedAt || null,
        dueDate: form.dueDate || null,
        notes: form.notes || null,
      }),
    onSuccess: () => {
      toast('Cuenta por cobrar creada.')
      setCreateOpen(false)
      setForm({ customerId: '', customerName: '', customerPhone: '', concept: '', total: '', issuedAt: todayInput(), dueDate: daysAgoInput(-30), notes: '' })
      invalidate()
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo crear la cuenta.', 'error'),
  })

  const paymentMutation = useMutation({
    mutationFn: () =>
      api.post<Receivable>(`/receivables/${detailId}/payments`, {
        amount: Number(payment.amount) || 0,
        method: payment.method,
        reference: payment.reference || null,
        notes: payment.notes || null,
      }),
    onSuccess: () => {
      toast('Abono registrado.')
      setPayOpen(false)
      setPayment({ amount: '', method: 'Cash', reference: '', notes: '' })
      invalidate()
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo registrar el abono.', 'error'),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.post<Receivable>(`/receivables/${id}/cancel`),
    onSuccess: () => {
      toast('Cuenta anulada.', 'info')
      invalidate()
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo anular la cuenta.', 'error'),
  })

  const openCreate = () => {
    setForm({ customerId: '', customerName: '', customerPhone: '', concept: '', total: '', issuedAt: todayInput(), dueDate: daysAgoInput(-30), notes: '' })
    setCreateOpen(true)
  }

  const openPayment = (item: Receivable) => {
    setDetailId(item.id)
    setPayment({ amount: String(Math.round(item.balance * 100) / 100), method: 'Cash', reference: '', notes: '' })
    setPayOpen(true)
  }

  const openDetail = (item: Receivable) => {
    setDetailId(item.id)
    setPayOpen(false)
  }

  if (isLoading) return <PageLoader label="Cargando cuentas por cobrar…" />
  if (isError || !data) {
    return (
      <div className="page">
        <EmptyState title="No pudimos cargar las cuentas por cobrar" description="Revisa tu conexión e intenta de nuevo." action={<Button onClick={() => refetch()}>Reintentar</Button>} />
      </div>
    )
  }

  const canPay = selected && selected.status !== 'Cancelled' && selected.balance > 0
  const plainTotal = (summary?.totalPending ?? 0) + (summary?.collectedThisMonth ?? 0)
  const collectedPercent = plainTotal > 0 ? ((summary?.collectedThisMonth ?? 0) / plainTotal) * 100 : 0

  return (
    <div className="page">
      <PageHeader
        title="Cuentas por cobrar"
        subtitle="Controla quién te debe, cuánto y desde cuándo. Registra abonos y evita cartera vencida."
        actions={canManageCustomers ? <Button size="sm" onClick={openCreate}><Plus className="size-4" /> Nueva cuenta</Button> : undefined}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Saldo pendiente" value={money(summary?.totalPending ?? 0, symbol)} icon={<Wallet className="size-4" />} tone="violet" hint={`${summary?.customersWithDebt ?? 0} clientes`} />
        <StatCard label="Cartera vencida" value={money(summary?.overdueAmount ?? 0, symbol)} icon={<AlertCircle className="size-4" />} tone="rose" hint="Requiere seguimiento" />
        <StatCard label="Vence esta semana" value={money(summary?.dueThisWeek ?? 0, symbol)} icon={<CalendarClock className="size-4" />} tone="amber" hint="Próximos 7 días" />
        <StatCard label="Cobrado este mes" value={money(summary?.collectedThisMonth ?? 0, symbol)} icon={<HandCoins className="size-4" />} tone="green" hint={`${collectedPercent.toFixed(0)}% del total gestionado`} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_320px]">
        <section className="card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="section-title">Antigüedad de cartera</h2>
              <p className="mt-0.5 text-[11px] text-muted">Distribución del saldo pendiente por días de atraso.</p>
            </div>
            <Badge tone="gray"><Clock className="size-3" /> En vivo</Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Al día', value: summary?.current ?? 0, tone: 'green' as const },
              { label: '1 a 30 días', value: summary?.days1To30 ?? 0, tone: 'amber' as const },
              { label: '31 a 60 días', value: summary?.days31To60 ?? 0, tone: 'amber' as const },
              { label: 'Más de 60', value: summary?.days60Plus ?? 0, tone: 'rose' as const },
            ].map((bucket) => (
              <div key={bucket.label} className="rounded-xl bg-canvas p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{bucket.label}</p>
                <p className="mt-1 text-[14px] font-bold text-ink">{money(bucket.value, symbol)}</p>
                <div className="mt-2">
                  <ProgressBar
                    value={summary?.totalPending ? (bucket.value / summary.totalPending) * 100 : 0}
                    tone={bucket.tone === 'green' ? 'green' : bucket.tone === 'rose' ? 'rose' : 'amber'}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-4 sm:p-5">
          <h2 className="section-title">Cobranza del mes</h2>
          <div className="mt-3 flex items-end justify-between">
            <p className="font-display text-[26px] font-extrabold leading-none text-ink">{money(summary?.collectedThisMonth ?? 0, symbol)}</p>
            <Badge tone="green">{collectedPercent.toFixed(0)}%</Badge>
          </div>
          <div className="mt-3"><ProgressBar value={collectedPercent} tone="green" /></div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            Recuerda registrar cada abono para mantener tu flujo de caja y tus reportes al día.
          </p>
        </section>
      </div>

      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={filter}
          onChange={(value) => setFilter(value)}
          tabs={[
            { id: 'all', label: 'Todas', count: data.total },
            { id: 'pending', label: 'Pendientes' },
            { id: 'overdue', label: 'Vencidas' },
            { id: 'partial', label: 'Abonos' },
            { id: 'paid', label: 'Pagadas' },
            { id: 'cancelled', label: 'Anuladas' },
          ]}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar cliente, teléfono o venta…" className="sm:w-72" />
      </div>

      <section className="card mt-3 overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            title="No hay cuentas por cobrar"
            description={search || filter !== 'all' ? 'Prueba con otros filtros o crea una nueva cuenta.' : 'Las ventas a crédito crean cuentas automáticamente. También puedes registrarlas manualmente.'}
            icon={<CircleDollarSign className="size-5" />}
            action={canManageCustomers ? <Button onClick={openCreate}><Plus className="size-4" /> Nueva cuenta</Button> : undefined}
          />
        ) : (
          <div className="divide-y divide-line">
            {items.map((item) => {
              const paidPercent = item.total > 0 ? (item.paidAmount / item.total) * 100 : 0
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openDetail(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openDetail(item)
                    }
                  }}
                  className="flex w-full cursor-pointer flex-col gap-3 px-4 py-3.5 text-left transition-colors hover:bg-brand-50/40 sm:flex-row sm:items-center sm:px-5"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <UserRound className="size-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-[12.5px] font-semibold text-ink">{item.customerName}</p>
                      <Badge tone={statusTone[item.status] ?? 'gray'} className="!px-1.5 !py-0.5 !text-[9.5px]">{receivableStatusLabel(item.status)}</Badge>
                      {item.daysOverdue > 0 && item.balance > 0 && (
                        <Badge tone="rose" className="!px-1.5 !py-0.5 !text-[9.5px]">{item.daysOverdue} días vencida</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[10.5px] text-muted">
                      {item.concept}{item.saleNumber ? ` · Venta ${item.saleNumber}` : ''} · vence {dateShort(item.dueDate)}
                      {item.customerPhone ? ` · ${item.customerPhone}` : ''}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="w-24"><ProgressBar value={paidPercent} tone={item.status === 'Paid' ? 'green' : 'violet'} /></div>
                      <span className="text-[9.5px] text-muted">{money(item.paidAmount, symbol)} de {money(item.total, symbol)}</span>
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-3 sm:flex-col sm:items-end sm:justify-center">
                    <div className="text-right">
                      <p className="text-[13px] font-bold text-ink">{money(item.balance, symbol)}</p>
                      <p className="text-[9.5px] text-muted">saldo</p>
                    </div>
                    {canManageCustomers && item.status !== 'Cancelled' && item.balance > 0 && (
                      <Button
                        size="sm"
                        variant="soft"
                        className="!py-1"
                        onClick={(event) => {
                          event.stopPropagation()
                          openPayment(item)
                        }}
                      >
                        <CreditCard className="size-3.5" /> Abonar
                      </Button>
                    )}
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
        title="Nueva cuenta por cobrar"
        subtitle="Registra una deuda manual o asóciala a un cliente."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createMutation.mutate()}
              loading={createMutation.isPending}
              disabled={!(Number(form.total) > 0) || (!form.customerId && !form.customerName.trim()) || !form.concept.trim()}
            >
              Crear cuenta
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cliente registrado" className="sm:col-span-2">
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
              <option value="">Cliente manual / ocasional</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </Select>
          </Field>
          <Field label="Nombre del cliente" required={!form.customerId}>
            <Input value={form.customerName} onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))} placeholder="Nombre completo" disabled={Boolean(form.customerId)} />
          </Field>
          <Field label="Teléfono / WhatsApp">
            <Input value={form.customerPhone} onChange={(event) => setForm((current) => ({ ...current, customerPhone: event.target.value }))} placeholder="+57 300 000 0000" />
          </Field>
          <Field label="Concepto" required className="sm:col-span-2">
            <Input value={form.concept} onChange={(event) => setForm((current) => ({ ...current, concept: event.target.value }))} placeholder="Ej. Saldo de venta, préstamo, servicio…" />
          </Field>
          <Field label="Monto total" required>
            <Input inputMode="decimal" value={form.total} onChange={(event) => setForm((current) => ({ ...current, total: event.target.value }))} placeholder="0.00" />
          </Field>
          <Field label="Emisión">
            <Input type="date" value={form.issuedAt} onChange={(event) => setForm((current) => ({ ...current, issuedAt: event.target.value }))} />
          </Field>
          <Field label="Vencimiento" required>
            <Input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} />
          </Field>
          <Field label="Notas" className="sm:col-span-2">
            <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Detalle o acuerdo de pago (opcional)" />
          </Field>
        </div>
      </Modal>

      <Modal
        open={detailId !== null && !payOpen}
        onClose={() => setDetailId(null)}
        title={selected?.customerName ?? 'Cuenta por cobrar'}
        subtitle={selected ? `${selected.concept}${selected.saleNumber ? ` · Venta ${selected.saleNumber}` : ''}` : undefined}
        size="md"
        footer={
          selected ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] text-muted">Saldo pendiente</p>
                <p className="font-display text-[18px] font-extrabold text-ink">{money(selected.balance, symbol)}</p>
              </div>
              <div className="flex gap-2">
                {canManageCustomers && selected.status === 'Pending' && selected.paidAmount === 0 && (
                  <Button variant="danger" size="sm" onClick={() => cancelMutation.mutate(selected.id)} loading={cancelMutation.isPending}>
                    <XCircle className="size-3.5" /> Anular
                  </Button>
                )}
                {canPay && canManageCustomers && (
                  <Button size="sm" onClick={() => openPayment(selected)}>
                    <CreditCard className="size-3.5" /> Registrar abono
                  </Button>
                )}
              </div>
            </div>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl bg-canvas p-3">
                <p className="text-[9.5px] uppercase tracking-wide text-muted">Total</p>
                <p className="mt-1 text-[13px] font-bold text-ink">{money(selected.total, symbol)}</p>
              </div>
              <div className="rounded-xl bg-canvas p-3">
                <p className="text-[9.5px] uppercase tracking-wide text-muted">Abonado</p>
                <p className="mt-1 text-[13px] font-bold text-emerald-600">{money(selected.paidAmount, symbol)}</p>
              </div>
              <div className="rounded-xl bg-canvas p-3">
                <p className="text-[9.5px] uppercase tracking-wide text-muted">Vence</p>
                <p className="mt-1 text-[13px] font-bold text-ink">{dateShort(selected.dueDate)}</p>
              </div>
              <div className="rounded-xl bg-canvas p-3">
                <p className="text-[9.5px] uppercase tracking-wide text-muted">Estado</p>
                <p className="mt-1"><Badge tone={statusTone[selected.status] ?? 'gray'}>{receivableStatusLabel(selected.status)}</Badge></p>
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-canvas/70 p-3.5">
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="text-muted">Progreso de pago</span>
                <span className="font-semibold text-ink">{selected.total > 0 ? Math.round((selected.paidAmount / selected.total) * 100) : 0}%</span>
              </div>
              <div className="mt-2"><ProgressBar value={selected.total > 0 ? (selected.paidAmount / selected.total) * 100 : 0} tone={selected.status === 'Paid' ? 'green' : 'violet'} /></div>
              <p className="mt-2 text-[10.5px] text-muted">
                {selected.daysOverdue > 0 && selected.balance > 0
                  ? `Vencida hace ${selected.daysOverdue} días.`
                  : selected.balance > 0
                    ? `Vence en ${Math.max(0, Math.ceil((new Date(`${selected.dueDate.slice(0, 10)}T00:00:00`).getTime() - Date.now()) / 86400000))} días.`
                    : 'Cuenta pagada en su totalidad.'}
              </p>
            </div>

            {selected.customerPhone && (
              <a href={`tel:${selected.customerPhone}`} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5 text-[11.5px] font-semibold text-brand-700">
                <Phone className="size-3.5" /> {selected.customerPhone}
              </a>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[12px] font-bold text-ink">Abonos registrados</p>
                <Badge tone="gray"><ReceiptText className="size-3" /> {selected.payments.length}</Badge>
              </div>
              {selected.payments.length === 0 ? (
                <p className="rounded-xl bg-canvas px-3 py-4 text-center text-[11.5px] text-muted">Aún no hay abonos.</p>
              ) : (
                <div className="divide-y divide-line rounded-xl border border-line">
                  {[...selected.payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((item) => (
                    <div key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><CheckCircle2 className="size-3.5" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11.5px] font-semibold text-ink">{paymentLabel(item.method)}</p>
                        <p className="text-[10px] text-muted">{dateShort(item.date)}{item.reference ? ` · ${item.reference}` : ''}{item.notes ? ` · ${item.notes}` : ''}</p>
                      </div>
                      <p className="text-[12px] font-bold text-emerald-600">+ {money(item.amount, symbol)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selected.notes && <p className="rounded-xl bg-canvas px-3 py-2.5 text-[11px] text-muted">{selected.notes}</p>}
          </div>
        )}
      </Modal>

      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Registrar abono"
        subtitle={selected ? `${selected.customerName} · saldo ${money(selected.balance, symbol)}` : undefined}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPayOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => paymentMutation.mutate()}
              loading={paymentMutation.isPending}
              disabled={!(Number(payment.amount) > 0) || Number(payment.amount) > (selected?.balance ?? 0)}
            >
              Guardar abono
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="Monto del abono" required>
            <Input inputMode="decimal" value={payment.amount} onChange={(event) => setPayment((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" autoFocus />
          </Field>
          <Field label="Método de pago">
            <Select value={payment.method} onChange={(event) => setPayment((current) => ({ ...current, method: event.target.value }))}>
              <option value="Cash">Efectivo</option>
              <option value="Card">Tarjeta</option>
              <option value="Transfer">Transferencia</option>
              <option value="Nequi">Nequi</option>
              <option value="Daviplata">Daviplata</option>
              <option value="Other">Otro</option>
            </Select>
          </Field>
          <Field label="Referencia">
            <Input value={payment.reference} onChange={(event) => setPayment((current) => ({ ...current, reference: event.target.value }))} placeholder="Número de transacción (opcional)" />
          </Field>
          <Field label="Notas">
            <Textarea value={payment.notes} onChange={(event) => setPayment((current) => ({ ...current, notes: event.target.value }))} placeholder="Acuerdo o detalle del abono" />
          </Field>
          {selected && Number(payment.amount) > selected.balance && (
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-rose-600"><AlertCircle className="size-3.5" /> El abono supera el saldo pendiente.</p>
          )}
        </div>
      </Modal>
    </div>
  )
}
