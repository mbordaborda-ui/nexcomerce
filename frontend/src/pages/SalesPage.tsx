import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Ban,
  CalendarDays,
  CircleDollarSign,
  Eye,
  MessageCircle,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { PageResult, Sale, SaleSummary, SalesSummaryDto } from '../lib/types'
import { dateTime, money, paymentLabel, statusLabel } from '../lib/format'
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  PageLoader,
  Pagination,
  SearchInput,
  Select,
  cn,
  useToast,
} from '../components/ui'

const statusOptions = [
  { id: '', label: 'Todos los estados' },
  { id: 'Completed', label: 'Completadas' },
  { id: 'Pending', label: 'Pendientes' },
  { id: 'Cancelled', label: 'Anuladas' },
]

export function SalesPage() {
  const { session } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const symbol = session?.tenant.currencySymbol ?? '$'

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [cancelId, setCancelId] = useState<string | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['sales', search, status, paymentMethod, from, to, page],
    queryFn: () =>
      api.get<PageResult<SaleSummary>>('/sales', {
        search,
        status: status || undefined,
        paymentMethod: paymentMethod || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        pageSize: 20,
      }),
  })

  const { data: summary } = useQuery({
    queryKey: ['sales-summary', from, to],
    queryFn: () => api.get<SalesSummaryDto>('/sales/summary', { from: from || undefined, to: to || undefined }),
  })

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['sale', detailId],
    queryFn: () => api.get<Sale>(`/sales/${detailId}`),
    enabled: Boolean(detailId),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.post<Sale>(`/sales/${id}/cancel`, { reason: 'Anulación manual desde el panel' }),
    onSuccess: () => {
      toast('Venta anulada y stock devuelto.')
      setCancelId(null)
      setDetailId(null)
      void queryClient.invalidateQueries({ queryKey: ['sales'] })
      void queryClient.invalidateQueries({ queryKey: ['sale'] })
      void queryClient.invalidateQueries({ queryKey: ['sales-summary'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      void queryClient.invalidateQueries({ queryKey: ['pos-products'] })
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo anular la venta.', 'error'),
  })

  const sales = data?.items ?? []

  return (
    <div className="page">
      <PageHeader
        title="Ventas"
        subtitle="Consulta, filtra y anula los movimientos de tu negocio."
        actions={
          <Button variant="secondary" size="sm" onClick={() => { setSearch(''); setStatus(''); setPaymentMethod(''); setFrom(''); setTo(''); setPage(1) }}>
            Limpiar filtros
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Ingresos</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><CircleDollarSign className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[20px] font-bold text-ink">{money(summary?.total ?? 0, symbol)}</p>
          <p className="mt-1 text-[10px] text-muted">En el periodo filtrado</p>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Ventas</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600"><Receipt className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[20px] font-bold text-ink">{summary?.count ?? 0}</p>
          <p className="mt-1 text-[10px] text-muted">Tickets registrados</p>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Ticket promedio</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><TrendingUp className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[20px] font-bold text-ink">{money(summary?.average ?? 0, symbol)}</p>
          <p className="mt-1 text-[10px] text-muted">Promedio por venta</p>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Impuestos</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><Wallet className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[20px] font-bold text-ink">{money(summary?.tax ?? 0, symbol)}</p>
          <p className="mt-1 text-[10px] text-muted">Recaudados en el periodo</p>
        </div>
      </div>

      <div className="card mt-4 p-3 sm:p-4">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1) }} placeholder="Buscar por ticket, cliente o vendedor…" className="flex-1" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
            <Select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} className="lg:w-[150px]">
              {statusOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </Select>
            <Select value={paymentMethod} onChange={(event) => { setPaymentMethod(event.target.value); setPage(1) }} className="lg:w-[150px]">
              <option value="">Todo pago</option>
              {Object.entries({ Cash: 'Efectivo', Card: 'Tarjeta', Transfer: 'Transferencia', Nequi: 'Nequi', Daviplata: 'Daviplata', Credit: 'Crédito', Other: 'Otro' }).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
            <Input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1) }} aria-label="Desde" className="lg:w-[150px]" />
            <Input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1) }} aria-label="Hasta" className="lg:w-[150px]" />
          </div>
        </div>
      </div>

      <div className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-brand-500" />
            <p className="text-[12px] font-semibold text-ink">{data?.total ?? 0} ventas encontradas</p>
          </div>
          <span className="text-[10.5px] text-muted">Página {data?.page ?? 1} de {data?.totalPages ?? 1}</span>
        </div>

        {isLoading ? (
          <PageLoader label="Cargando ventas…" />
        ) : isError ? (
          <EmptyState title="No pudimos cargar las ventas" description="Revisa tu conexión e intenta de nuevo." action={<Button onClick={() => refetch()}>Reintentar</Button>} />
        ) : sales.length === 0 ? (
          <EmptyState title="Sin ventas para estos filtros" description="Cambia el rango de fechas o registra una venta desde el punto de venta." icon={<ShoppingBag className="size-5" />} />
        ) : (
          <>
            <div className="hidden table-wrap md:block">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Cliente</th>
                    <th>Fecha</th>
                    <th>Pago</th>
                    <th>Vendedor</th>
                    <th className="text-right">Total</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className={cn('flex size-7 items-center justify-center rounded-lg', sale.channel === 'WhatsApp' ? 'bg-emerald-50 text-emerald-600' : 'bg-brand-50 text-brand-600')}>
                            {sale.channel === 'WhatsApp' ? <MessageCircle className="size-3.5" /> : <Receipt className="size-3.5" />}
                          </span>
                          <div>
                            <p className="text-[12px] font-bold text-ink">{sale.number}</p>
                            <p className="text-[10px] text-muted">{sale.itemCount} artículo{sale.itemCount === 1 ? '' : 's'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-[12px]">{sale.customerName ?? 'Cliente ocasional'}</td>
                      <td className="text-[11.5px] text-muted">{dateTime(sale.createdAt)}</td>
                      <td><Badge tone="gray">{paymentLabel(sale.paymentMethod)}</Badge></td>
                      <td className="text-[11.5px] text-muted">{sale.userName ?? '—'}</td>
                      <td className="text-right text-[12.5px] font-bold text-ink">{money(sale.total, symbol)}</td>
                      <td>
                        <Badge tone={sale.status === 'Cancelled' ? 'rose' : sale.status === 'Pending' ? 'amber' : 'green'}>{statusLabel(sale.status)}</Badge>
                      </td>
                      <td>
                        <button onClick={() => setDetailId(sale.id)} className="icon-btn border border-line bg-white" aria-label="Ver detalle">
                          <Eye className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-line md:hidden">
              {sales.map((sale) => (
                <button key={sale.id} onClick={() => setDetailId(sale.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', sale.channel === 'WhatsApp' ? 'bg-emerald-50 text-emerald-600' : 'bg-brand-50 text-brand-600')}>
                    {sale.channel === 'WhatsApp' ? <MessageCircle className="size-4" /> : <Receipt className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-bold text-ink">{sale.number} · {sale.customerName ?? 'Cliente ocasional'}</p>
                    <p className="truncate text-[10px] text-muted">{dateTime(sale.createdAt)} · {paymentLabel(sale.paymentMethod)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[12px] font-bold text-ink">{money(sale.total, symbol)}</p>
                    <p className={cn('text-[9.5px] font-semibold', sale.status === 'Cancelled' ? 'text-rose-500' : sale.status === 'Pending' ? 'text-amber-600' : 'text-emerald-600')}>
                      {statusLabel(sale.status)}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            <div className="px-4 pb-4">
              <Pagination page={data?.page ?? 1} totalPages={data?.totalPages ?? 1} onChange={setPage} />
            </div>
          </>
        )}
      </div>

      <Modal
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        title={detail ? `Venta ${detail.number}` : 'Detalle de venta'}
        subtitle={detail ? `${dateTime(detail.createdAt)} · ${detail.branchName ?? 'Sin sede'}` : undefined}
        size="lg"
        footer={
          detail && detail.status !== 'Cancelled' ? (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDetailId(null)}>Cerrar</Button>
              <Button variant="danger" onClick={() => setCancelId(detail.id)}>
                <Ban className="size-3.5" /> Anular venta
              </Button>
            </div>
          ) : (
            <div className="flex justify-end"><Button variant="secondary" onClick={() => setDetailId(null)}>Cerrar</Button></div>
          )
        }
      >
        {detailLoading || !detail ? (
          <PageLoader label="Cargando detalle…" />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl bg-canvas p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted">Cliente</p>
                <p className="mt-0.5 truncate text-[12px] font-semibold text-ink">{detail.customerName ?? 'Cliente ocasional'}</p>
              </div>
              <div className="rounded-xl bg-canvas p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted">Pago</p>
                <p className="mt-0.5 text-[12px] font-semibold text-ink">{paymentLabel(detail.paymentMethod)}</p>
              </div>
              <div className="rounded-xl bg-canvas p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted">Estado</p>
                <p className="mt-0.5 text-[12px] font-semibold text-ink">{statusLabel(detail.status)}</p>
              </div>
              <div className="rounded-xl bg-canvas p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted">Vendedor</p>
                <p className="mt-0.5 truncate text-[12px] font-semibold text-ink">{detail.userName ?? '—'}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-line">
              {detail.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 border-b border-line/70 px-3 py-2.5 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-ink">{item.productName}</p>
                    <p className="text-[10px] text-muted">{item.variantName ?? item.sku} · {item.quantity} × {money(item.unitPrice, symbol)}</p>
                  </div>
                  <p className="text-[12px] font-bold text-ink">{money(item.total, symbol)}</p>
                </div>
              ))}
            </div>

            <div className="ml-auto max-w-xs space-y-1.5 text-[12px]">
              <div className="flex justify-between"><span className="text-muted">Subtotal</span><span className="font-semibold">{money(detail.subtotal, symbol)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Descuento</span><span className="font-semibold text-rose-500">-{money(detail.discount, symbol)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Impuesto</span><span className="font-semibold">{money(detail.tax, symbol)}</span></div>
              <div className="flex justify-between border-t border-line pt-1.5"><span className="font-bold text-ink">Total</span><span className="font-display text-[16px] font-extrabold text-brand-700">{money(detail.total, symbol)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Recibido</span><span className="font-semibold">{money(detail.paidAmount, symbol)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Cambio</span><span className="font-semibold text-emerald-600">{money(detail.change, symbol)}</span></div>
            </div>

            {detail.notes && <p className="rounded-xl bg-brand-50/60 p-3 text-[11.5px] text-muted">{detail.notes}</p>}
            {detail.status === 'Cancelled' && (
              <p className="rounded-xl bg-rose-50 p-3 text-[11.5px] font-medium text-rose-600">
                Venta anulada el {dateTime(detail.cancelledAt)}{detail.cancelReason ? ` · ${detail.cancelReason}` : ''}
              </p>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={cancelId !== null}
        onClose={() => setCancelId(null)}
        onConfirm={() => cancelId && cancelMutation.mutate(cancelId)}
        title="Anular venta"
        message="La venta quedará marcada como anulada y el inventario de los productos se devolverá automáticamente. Esta acción no se puede deshacer."
        confirmLabel="Sí, anular venta"
        loading={cancelMutation.isPending}
      />
    </div>
  )
}
