import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Calculator,
  CheckCircle2,
  Clock,
  Lock,
  Plus,
  ReceiptText,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth, usePermissions } from '../lib/auth'
import type { CashOverview, CashSession } from '../lib/types'
import { cashTypeLabels, dateShort, dateTime, money, paymentLabel, timeOnly } from '../lib/format'
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  PageLoader,
  Select,
  StatCard,
  Textarea,
  cn,
  useToast,
} from '../components/ui'

type MovementType = 'Income' | 'Expense' | 'Withdrawal'

export function CashPage() {
  const { session } = useAuth()
  const { canManageSales } = usePermissions()
  const toast = useToast()
  const queryClient = useQueryClient()
  const symbol = session?.tenant.currencySymbol ?? '$'

  const [openOpen, setOpenOpen] = useState(false)
  const [openClose, setOpenClose] = useState(false)
  const [openingAmount, setOpeningAmount] = useState('')
  const [openingNotes, setOpeningNotes] = useState('')
  const [countedAmount, setCountedAmount] = useState('')
  const [closeNotes, setCloseNotes] = useState('')
  const [movementType, setMovementType] = useState<MovementType>('Income')
  const [concept, setConcept] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [reference, setReference] = useState('')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['cash'],
    queryFn: () => api.get<CashOverview>('/cash'),
  })

  const current = data?.current ?? null
  const summary = data?.summary
  const sessions = data?.sessions ?? []

  const expected = current ? current.expectedAmount : 0
  const differencePreview = countedAmount === '' ? null : Number(countedAmount) - expected

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['cash'] })
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    void queryClient.invalidateQueries({ queryKey: ['report-profit'] })
  }

  const openMutation = useMutation({
    mutationFn: () =>
      api.post<CashSession>('/cash/open', {
        openingAmount: Number(openingAmount) || 0,
        branchId: session?.branch?.id ?? null,
        notes: openingNotes || null,
      }),
    onSuccess: () => {
      toast('Caja abierta correctamente.')
      setOpenOpen(false)
      setOpeningAmount('')
      setOpeningNotes('')
      invalidate()
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo abrir la caja.', 'error'),
  })

  const movementMutation = useMutation({
    mutationFn: () =>
      api.post<CashSession>('/cash/movements', {
        type: movementType,
        concept,
        amount: Number(amount) || 0,
        paymentMethod,
        reference: reference || null,
      }),
    onSuccess: () => {
      toast(movementType === 'Income' ? 'Ingreso registrado.' : 'Egreso registrado.')
      setConcept('')
      setAmount('')
      setReference('')
      setMovementType('Income')
      setPaymentMethod('Cash')
      invalidate()
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo registrar el movimiento.', 'error'),
  })

  const closeMutation = useMutation({
    mutationFn: () =>
      api.post<CashSession>('/cash/close', {
        countedAmount: Number(countedAmount) || 0,
        notes: closeNotes || null,
      }),
    onSuccess: (result) => {
      toast(
        result.difference === 0
          ? 'Caja cerrada sin diferencias.'
          : `Caja cerrada con una diferencia de ${money(result.difference, symbol)}.`,
        result.difference === 0 ? 'success' : 'info',
      )
      setOpenClose(false)
      setCountedAmount('')
      setCloseNotes('')
      invalidate()
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo cerrar la caja.', 'error'),
  })

  const movements = useMemo(
    () => [...(current?.movements ?? [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [current],
  )

  if (isLoading) return <PageLoader label="Cargando la caja…" />
  if (isError || !data) {
    return (
      <div className="page">
        <EmptyState
          title="No pudimos cargar la caja"
          description="Revisa tu conexión e intenta de nuevo."
          action={<Button onClick={() => refetch()}>Reintentar</Button>}
        />
      </div>
    )
  }

  const openSession = () => {
    setOpeningAmount(current?.expectedAmount ? String(current.expectedAmount) : '')
    setOpeningNotes('')
    setOpenOpen(true)
  }

  const closeSession = () => {
    setCountedAmount(String(Math.round(expected * 100) / 100))
    setCloseNotes('')
    setOpenClose(true)
  }

  const movementValid = concept.trim().length > 1 && Number(amount) > 0

  return (
    <div className="page">
      <PageHeader
        title="Caja"
        subtitle="Controla el efectivo del día, registra ingresos y cierra la caja con arqueo."
        actions={
          canManageSales ? (
            current ? (
              <Button size="sm" variant="secondary" onClick={closeSession}>
                <Lock className="size-4" /> Cerrar caja
              </Button>
            ) : (
              <Button size="sm" onClick={openSession}>
                <Plus className="size-4" /> Abrir caja
              </Button>
            )
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Ventas en efectivo hoy" value={money(summary?.cashSalesToday ?? 0, symbol)} icon={<Banknote className="size-4" />} tone="violet" hint="Solo pagos en efectivo" />
        <StatCard label="Ingresos manuales" value={money(summary?.incomeToday ?? 0, symbol)} icon={<TrendingUp className="size-4" />} tone="green" hint="Hoy" />
        <StatCard label="Egresos y retiros" value={money(summary?.expensesToday ?? 0, symbol)} icon={<TrendingDown className="size-4" />} tone="rose" hint="Hoy" />
        <StatCard label="Cajas abiertas" value={summary?.openSessions ?? 0} icon={<Wallet className="size-4" />} tone="amber" hint={`${summary?.sessionsThisMonth ?? 0} este mes`} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-4">
          {current ? (
            <section className="card overflow-hidden">
              <div className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-5 text-white sm:p-6">
                <div className="absolute -right-12 -top-16 size-56 rounded-full bg-white/10 blur-2xl" />
                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex size-9 items-center justify-center rounded-xl bg-white/15">
                        <Lock className="size-4" />
                      </span>
                      <div>
                        <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/60">Caja abierta</p>
                        <p className="font-display text-[20px] font-extrabold leading-tight">{current.branchName ?? 'Todas las sedes'}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-[11.5px] text-white/70">
                      {current.userName ?? 'Sin cajero'} · desde {timeOnly(current.openedAt)} · {dateShort(current.openedAt)}
                    </p>
                  </div>
                  <Badge className="!bg-white/15 !text-white">
                    <CheckCircle2 className="size-3" /> En curso
                  </Badge>
                </div>

                <div className="relative mt-5 rounded-2xl bg-white/10 p-4">
                  <p className="text-[10.5px] uppercase tracking-wide text-white/60">Efectivo esperado en caja</p>
                  <p className="mt-0.5 font-display text-[32px] font-extrabold leading-none">{money(current.expectedAmount, symbol)}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-xl bg-white/10 px-3 py-2">
                      <p className="text-[9.5px] text-white/60">Apertura</p>
                      <p className="mt-0.5 text-[12.5px] font-bold">{money(current.openingAmount, symbol)}</p>
                    </div>
                    <div className="rounded-xl bg-white/10 px-3 py-2">
                      <p className="text-[9.5px] text-white/60">Ventas</p>
                      <p className="mt-0.5 text-[12.5px] font-bold">{money(current.salesAmount, symbol)}</p>
                    </div>
                    <div className="rounded-xl bg-white/10 px-3 py-2">
                      <p className="text-[9.5px] text-white/60">Ingresos</p>
                      <p className="mt-0.5 text-[12.5px] font-bold">{money(current.incomeAmount, symbol)}</p>
                    </div>
                    <div className="rounded-xl bg-white/10 px-3 py-2">
                      <p className="text-[9.5px] text-white/60">Egresos</p>
                      <p className="mt-0.5 text-[12.5px] font-bold">{money(current.expenseAmount, symbol)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-line bg-canvas/60 px-4 py-3 sm:px-5">
                <p className="text-[11px] text-muted">
                  {movements.length} movimiento{movements.length === 1 ? '' : 's'} registrado{movements.length === 1 ? '' : 's'} en esta sesión.
                </p>
                <Button size="sm" variant="secondary" onClick={closeSession}>
                  <Calculator className="size-3.5" /> Hacer arqueo
                </Button>
              </div>
            </section>
          ) : (
            <section className="card">
              <EmptyState
                title="Tu caja está cerrada"
                description="Abre una sesión de caja para registrar el efectivo inicial, los movimientos del día y hacer el cierre."
                icon={<Wallet className="size-5" />}
                action={canManageSales ? <Button onClick={openSession}><Plus className="size-4" /> Abrir caja</Button> : undefined}
              />
            </section>
          )}

          <section className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4 sm:px-5 sm:pt-5">
              <div>
                <h2 className="section-title">Movimientos de la sesión</h2>
                <p className="mt-0.5 text-[11px] text-muted">Apertura, ventas en efectivo y ajustes manuales.</p>
              </div>
              <Badge tone="gray"><ReceiptText className="size-3" /> {movements.length}</Badge>
            </div>

            {!current || movements.length === 0 ? (
              <p className="px-5 py-8 text-center text-[12px] text-muted">
                {current ? 'Aún no hay movimientos en esta caja.' : 'Abre la caja para empezar a registrar movimientos.'}
              </p>
            ) : (
              <div className="mt-3 divide-y divide-line">
                {movements.map((movement) => {
                  const incoming = movement.type === 'Income' || movement.type === 'Opening' || movement.type === 'Sale'
                  return (
                    <div key={movement.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                      <span
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-xl',
                          movement.type === 'Opening'
                            ? 'bg-brand-50 text-brand-600'
                            : incoming
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-rose-50 text-rose-500',
                        )}
                      >
                        {movement.type === 'Opening' ? <Lock className="size-4" /> : movement.type === 'Sale' ? <ReceiptText className="size-4" /> : incoming ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-ink">{movement.concept}</p>
                        <p className="truncate text-[10px] text-muted">
                          {cashTypeLabels[movement.type] ?? movement.type} · {timeOnly(movement.date)}
                          {movement.paymentMethod ? ` · ${paymentLabel(movement.paymentMethod)}` : ''}
                          {movement.reference ? ` · ${movement.reference}` : ''}
                        </p>
                      </div>
                      <p className={cn('text-[12.5px] font-bold', movement.type === 'Opening' ? 'text-ink' : incoming ? 'text-emerald-600' : 'text-rose-600')}>
                        {movement.type === 'Expense' || movement.type === 'Withdrawal' ? '−' : '+'}
                        {money(movement.amount, symbol)}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="card p-4 sm:p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="section-title">Registrar movimiento</h2>
                <p className="mt-0.5 text-[11px] text-muted">Ingresos, egresos o retiros de efectivo.</p>
              </div>
              <span className="flex size-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <RefreshCw className="size-4" />
              </span>
            </div>

            {!current ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-[11.5px] text-amber-800">
                <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="size-3.5" /> Caja cerrada</p>
                <p className="mt-1 leading-relaxed text-amber-700">Abre la caja para registrar movimientos de efectivo.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-canvas p-1">
                  {([
                    { id: 'Income', label: 'Ingreso', icon: ArrowDownLeft },
                    { id: 'Expense', label: 'Egreso', icon: ArrowUpRight },
                    { id: 'Withdrawal', label: 'Retiro', icon: Banknote },
                  ] as const).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setMovementType(option.id)}
                      className={cn(
                        'flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold transition-colors',
                        movementType === option.id ? 'bg-white text-brand-700 shadow-sm' : 'text-muted hover:text-brand-700',
                      )}
                    >
                      <option.icon className="size-3.5" /> {option.label}
                    </button>
                  ))}
                </div>
                <Field label="Concepto" required>
                  <Input value={concept} onChange={(event) => setConcept(event.target.value)} placeholder="Ej. Venta mostrador, pago proveedor…" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Monto" required>
                    <Input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />
                  </Field>
                  <Field label="Método">
                    <Select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                      <option value="Cash">Efectivo</option>
                      <option value="Transfer">Transferencia</option>
                      <option value="Nequi">Nequi</option>
                      <option value="Daviplata">Daviplata</option>
                      <option value="Other">Otro</option>
                    </Select>
                  </Field>
                </div>
                <Field label="Referencia">
                  <Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Opcional" />
                </Field>
                <Button className="w-full" onClick={() => movementMutation.mutate()} loading={movementMutation.isPending} disabled={!movementValid}>
                  <Plus className="size-4" /> Registrar movimiento
                </Button>
                <p className="text-center text-[10px] text-muted">Las ventas en efectivo se suman automáticamente.</p>
              </div>
            )}
          </section>

          <section className="card p-4 sm:p-5">
            <h2 className="section-title">Último cierre</h2>
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-canvas px-3 py-3">
              <span
                className={cn(
                  'flex size-9 items-center justify-center rounded-xl',
                  (summary?.lastDifference ?? 0) === 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600',
                )}
              >
                <Calculator className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-ink">
                  {(summary?.lastDifference ?? 0) === 0 ? 'Sin diferencias' : `Diferencia ${money(summary?.lastDifference ?? 0, symbol)}`}
                </p>
                <p className="text-[10.5px] text-muted">
                  {sessions.find((item) => item.status === 'Closed')?.closedAt
                    ? `Cerrada ${dateTime(sessions.find((item) => item.status === 'Closed')?.closedAt)}`
                    : 'Aún no hay cierres'}
                </p>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              El arqueo compara el efectivo contado contra lo esperado. Las diferencias quedan registradas para auditoría.
            </p>
          </section>
        </div>
      </div>

      <section className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 sm:px-5 sm:pt-5">
          <div>
            <h2 className="section-title">Historial de cajas</h2>
            <p className="mt-0.5 text-[11px] text-muted">Últimas sesiones abiertas y cerradas.</p>
          </div>
          <Badge tone="gray"><Clock className="size-3" /> {sessions.length}</Badge>
        </div>

        {sessions.length === 0 ? (
          <p className="px-5 py-8 text-center text-[12px] text-muted">Todavía no hay sesiones de caja.</p>
        ) : (
          <>
            <div className="hidden table-wrap md:block">
              <table className="table">
                <thead>
                  <tr>
                    <th>Sesión</th>
                    <th>Apertura</th>
                    <th>Esperado</th>
                    <th>Contado</th>
                    <th>Diferencia</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <p className="text-[12.5px] font-semibold text-ink">{item.branchName ?? 'Todas las sedes'}</p>
                        <p className="text-[10px] text-muted">{dateShort(item.openedAt)} · {timeOnly(item.openedAt)} · {item.userName ?? '—'}</p>
                      </td>
                      <td className="text-[11.5px] text-muted">{money(item.openingAmount, symbol)}</td>
                      <td className="text-[11.5px] font-semibold text-ink">{money(item.expectedAmount, symbol)}</td>
                      <td className="text-[11.5px] text-muted">{item.countedAmount == null ? '—' : money(item.countedAmount, symbol)}</td>
                      <td className={cn('text-[11.5px] font-semibold', item.difference === 0 ? 'text-muted' : item.difference > 0 ? 'text-emerald-600' : 'text-rose-600')}>
                        {item.status === 'Open' ? '—' : money(item.difference, symbol)}
                      </td>
                      <td>
                        <Badge tone={item.status === 'Open' ? 'green' : 'gray'}>{item.status === 'Open' ? 'Abierta' : 'Cerrada'}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-line md:hidden">
              {sessions.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', item.status === 'Open' ? 'bg-emerald-50 text-emerald-600' : 'bg-brand-50 text-brand-600')}>
                    {item.status === 'Open' ? <Lock className="size-4" /> : <CheckCircle2 className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-ink">{dateShort(item.openedAt)} · {timeOnly(item.openedAt)}</p>
                    <p className="truncate text-[10px] text-muted">
                      {item.userName ?? 'Sin cajero'} · esperado {money(item.expectedAmount, symbol)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[12px] font-bold text-ink">{money(item.status === 'Open' ? item.expectedAmount : item.countedAmount ?? 0, symbol)}</p>
                    <Badge tone={item.status === 'Open' ? 'green' : 'gray'} className="mt-0.5 !px-1.5 !py-0.5 !text-[9.5px]">
                      {item.status === 'Open' ? 'Abierta' : 'Cerrada'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <Modal
        open={openOpen}
        onClose={() => setOpenOpen(false)}
        title="Abrir caja"
        subtitle="Registra el efectivo inicial para empezar el día."
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenOpen(false)}>Cancelar</Button>
            <Button onClick={() => openMutation.mutate()} loading={openMutation.isPending} disabled={Number(openingAmount) < 0}>
              Abrir caja
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="Monto de apertura" required hint="Efectivo con el que inicia la caja.">
            <Input inputMode="decimal" value={openingAmount} onChange={(event) => setOpeningAmount(event.target.value)} placeholder="0.00" autoFocus />
          </Field>
          <Field label="Notas">
            <Textarea value={openingNotes} onChange={(event) => setOpeningNotes(event.target.value)} placeholder="Observaciones de apertura (opcional)" />
          </Field>
          <div className="rounded-xl bg-canvas px-3 py-2.5 text-[11px] leading-relaxed text-muted">
            Se abrirá la caja de <span className="font-semibold text-ink">{session?.branch?.name ?? 'todas las sedes'}</span> a tu nombre.
          </div>
        </div>
      </Modal>

      <Modal
        open={openClose}
        onClose={() => setOpenClose(false)}
        title="Cerrar caja"
        subtitle="Cuenta el efectivo y confirma el arqueo."
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenClose(false)}>Cancelar</Button>
            <Button onClick={() => closeMutation.mutate()} loading={closeMutation.isPending} disabled={countedAmount === '' || Number(countedAmount) < 0}>
              Cerrar caja
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="rounded-2xl border border-line bg-canvas p-3.5 text-[11.5px]">
            <div className="flex justify-between py-0.5"><span className="text-muted">Apertura</span><span className="font-semibold text-ink">{money(current?.openingAmount ?? 0, symbol)}</span></div>
            <div className="flex justify-between py-0.5"><span className="text-muted">Ventas en efectivo</span><span className="font-semibold text-ink">{money(current?.salesAmount ?? 0, symbol)}</span></div>
            <div className="flex justify-between py-0.5"><span className="text-muted">Ingresos</span><span className="font-semibold text-emerald-600">+ {money(current?.incomeAmount ?? 0, symbol)}</span></div>
            <div className="flex justify-between py-0.5"><span className="text-muted">Egresos y retiros</span><span className="font-semibold text-rose-600">− {money(current?.expenseAmount ?? 0, symbol)}</span></div>
            <div className="mt-1.5 flex justify-between border-t border-line pt-1.5">
              <span className="font-bold text-ink">Efectivo esperado</span>
              <span className="font-display text-[15px] font-extrabold text-ink">{money(expected, symbol)}</span>
            </div>
          </div>
          <Field label="Efectivo contado" required>
            <Input inputMode="decimal" value={countedAmount} onChange={(event) => setCountedAmount(event.target.value)} placeholder="0.00" autoFocus />
          </Field>
          {differencePreview !== null && (
            <div
              className={cn(
                'flex items-center justify-between rounded-xl px-3 py-2.5 text-[11.5px]',
                Math.abs(differencePreview) < 0.01
                  ? 'bg-emerald-50 text-emerald-700'
                  : differencePreview > 0
                    ? 'bg-sky-50 text-sky-700'
                    : 'bg-rose-50 text-rose-700',
              )}
            >
              <span className="font-semibold">{Math.abs(differencePreview) < 0.01 ? 'Cuadra perfecto' : differencePreview > 0 ? 'Sobrante' : 'Faltante'}</span>
              <span className="font-display text-[14px] font-extrabold">{money(Math.abs(differencePreview), symbol)}</span>
            </div>
          )}
          <Field label="Notas de cierre">
            <Textarea value={closeNotes} onChange={(event) => setCloseNotes(event.target.value)} placeholder="Explica cualquier diferencia (opcional)" />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
