import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  ClipboardList,
  Layers,
  PackageSearch,
  Plus,
  RefreshCw,
  Warehouse,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth, usePermissions } from '../lib/auth'
import type { Branch, InventoryMovement, InventorySummary, LowStockItem, PageResult, Product } from '../lib/types'
import { dateTime, money, movementLabels, numberFormat } from '../lib/format'
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  PageLoader,
  Pagination,
  ProductThumb,
  ProgressBar,
  Select,
  Tabs,
  Textarea,
  cn,
  useToast,
} from '../components/ui'

const movementTones: Record<string, 'green' | 'rose' | 'amber' | 'violet' | 'gray'> = {
  In: 'green',
  Return: 'green',
  Out: 'rose',
  Adjustment: 'amber',
  Sale: 'violet',
  Transfer: 'gray',
}

export function InventoryPage() {
  const { session } = useAuth()
  const { canManageInventory } = usePermissions()
  const toast = useToast()
  const queryClient = useQueryClient()
  const symbol = session?.tenant.currencySymbol ?? '$'

  const [tab, setTab] = useState<'movements' | 'alerts' | 'categories'>('movements')
  const [type, setType] = useState('')
  const [page, setPage] = useState(1)
  const [movementOpen, setMovementOpen] = useState(false)
  const [form, setForm] = useState({ productId: '', type: 'In', quantity: '', notes: '', branchId: '' })

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['inventory-summary'],
    queryFn: () => api.get<InventorySummary>('/inventory/summary'),
  })

  const { data: movements, isLoading: movementsLoading } = useQuery({
    queryKey: ['inventory-movements', type, page],
    queryFn: () => api.get<PageResult<InventoryMovement>>('/inventory/movements', { type: type || undefined, page, pageSize: 25 }),
  })

  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: ['inventory-alerts'],
    queryFn: () => api.get<LowStockItem[]>('/inventory/alerts'),
  })

  const { data: products } = useQuery({
    queryKey: ['inventory-products'],
    queryFn: () => api.get<PageResult<Product>>('/products', { pageSize: 100 }),
  })

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get<Branch[]>('/team/branches'),
  })

  const createMovement = useMutation({
    mutationFn: () =>
      api.post<InventoryMovement>('/inventory/movements', {
        productId: form.productId,
        type: form.type,
        quantity: Number(form.quantity) || 0,
        notes: form.notes || null,
        branchId: form.branchId || null,
      }),
    onSuccess: () => {
      toast('Movimiento registrado y stock actualizado.')
      setMovementOpen(false)
      setForm({ productId: '', type: 'In', quantity: '', notes: '', branchId: '' })
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory-summary'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['pos-products'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo registrar el movimiento.', 'error'),
  })

  const selectedProduct = products?.items.find((product) => product.id === form.productId)
  const maxCategoryValue = Math.max(1, ...(summary?.byCategory.map((item) => item.value) ?? [1]))

  return (
    <div className="page">
      <PageHeader
        title="Inventario"
        subtitle="Controla entradas, salidas, ajustes y alertas de stock."
        actions={
          canManageInventory ? (
            <Button size="sm" onClick={() => setMovementOpen(true)}>
              <Plus className="size-4" /> Registrar movimiento
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Unidades</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Boxes className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[20px] font-bold text-ink">{summaryLoading ? '—' : numberFormat(summary?.stockUnits)}</p>
          <p className="mt-1 text-[10px] text-muted">{summary?.products ?? 0} referencias activas</p>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Valor costo</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600"><Layers className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[20px] font-bold text-ink">{money(summary?.stockValue ?? 0, symbol)}</p>
          <p className="mt-1 text-[10px] text-muted">Inversión en stock</p>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Valor venta</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><ArrowUpRight className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[20px] font-bold text-ink">{money(summary?.retailValue ?? 0, symbol)}</p>
          <p className="mt-1 text-[10px] text-muted">Potencial de facturación</p>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Alertas</p>
            <span className={cn('flex size-8 items-center justify-center rounded-lg', (summary?.lowStock ?? 0) > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600')}>
              <AlertTriangle className="size-4" />
            </span>
          </div>
          <p className="mt-2 font-display text-[20px] font-bold text-ink">{summary?.lowStock ?? 0}</p>
          <p className="mt-1 text-[10px] text-muted">{summary?.outOfStock ?? 0} agotados</p>
        </div>
      </div>

      <div className="mt-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'movements', label: 'Movimientos', count: movements?.total, icon: <RefreshCw className="size-3.5" /> },
            { id: 'alerts', label: 'Alertas', count: alerts?.length, icon: <AlertTriangle className="size-3.5" /> },
            { id: 'categories', label: 'Por categoría', icon: <Warehouse className="size-3.5" /> },
          ]}
        />
      </div>

      {tab === 'movements' && (
        <div className="card mt-3 overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="size-4 text-brand-500" />
              <p className="text-[12px] font-semibold text-ink">Historial de inventario</p>
            </div>
            <Select value={type} onChange={(event) => { setType(event.target.value); setPage(1) }} className="w-full sm:w-[180px]">
              <option value="">Todos los movimientos</option>
              {['In', 'Out', 'Adjustment', 'Sale', 'Return', 'Transfer'].map((value) => (
                <option key={value} value={value}>{movementLabels[value]}</option>
              ))}
            </Select>
          </div>

          {movementsLoading ? (
            <PageLoader label="Cargando movimientos…" />
          ) : (movements?.items.length ?? 0) === 0 ? (
            <EmptyState title="Sin movimientos" description="Los movimientos de stock aparecerán aquí." icon={<RefreshCw className="size-5" />} />
          ) : (
            <>
              <div className="hidden table-wrap md:block">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Tipo</th>
                      <th className="text-right">Cantidad</th>
                      <th className="text-right">Antes</th>
                      <th className="text-right">Después</th>
                      <th>Sede</th>
                      <th>Responsable</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements?.items.map((movement) => (
                      <tr key={movement.id}>
                        <td>
                          <p className="text-[12px] font-semibold text-ink">{movement.productName}{movement.variantName ? ` · ${movement.variantName}` : ''}</p>
                          <p className="text-[10px] text-muted">{movement.reference ?? 'Sin referencia'}</p>
                        </td>
                        <td><Badge tone={movementTones[movement.type] ?? 'gray'}>{movementLabels[movement.type] ?? movement.type}</Badge></td>
                        <td className="text-right text-[12px] font-bold text-ink">
                          <span className={movement.type === 'Out' || movement.type === 'Sale' ? 'text-rose-600' : 'text-emerald-600'}>
                            {movement.type === 'Out' || movement.type === 'Sale' ? '-' : '+'}{movement.quantity}
                          </span>
                        </td>
                        <td className="text-right text-[11.5px] text-muted">{movement.previousStock}</td>
                        <td className="text-right text-[12px] font-semibold text-ink">{movement.newStock}</td>
                        <td className="text-[11.5px] text-muted">{movement.branchName ?? '—'}</td>
                        <td className="text-[11.5px] text-muted">{movement.userName ?? '—'}</td>
                        <td className="text-[11px] text-muted">{dateTime(movement.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-line md:hidden">
                {movements?.items.map((movement) => (
                  <div key={movement.id} className="flex items-start gap-3 px-4 py-3">
                    <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', movement.type === 'Out' || movement.type === 'Sale' ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-600')}>
                      {movement.type === 'Out' || movement.type === 'Sale' ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold text-ink">{movement.productName}</p>
                      <p className="truncate text-[10px] text-muted">{movementLabels[movement.type] ?? movement.type} · {dateTime(movement.createdAt)}</p>
                      <p className="mt-0.5 text-[10px] text-muted">{movement.branchName ?? 'Sin sede'} · {movement.userName ?? 'Sistema'}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn('text-[12.5px] font-bold', movement.type === 'Out' || movement.type === 'Sale' ? 'text-rose-600' : 'text-emerald-600')}>
                        {movement.type === 'Out' || movement.type === 'Sale' ? '-' : '+'}{movement.quantity}
                      </p>
                      <p className="text-[9.5px] text-muted">{movement.previousStock} → {movement.newStock}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-4 pb-4">
                <Pagination page={movements?.page ?? 1} totalPages={movements?.totalPages ?? 1} onChange={setPage} />
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'alerts' && (
        <div className="card mt-3 overflow-hidden">
          <div className="border-b border-line p-4">
            <p className="text-[12px] font-semibold text-ink">Productos que necesitan reposición</p>
            <p className="text-[10.5px] text-muted">Se activan cuando el stock disponible es menor o igual al mínimo configurado.</p>
          </div>
          {alertsLoading ? (
            <PageLoader label="Revisando inventario…" />
          ) : (alerts?.length ?? 0) === 0 ? (
            <EmptyState title="Inventario saludable" description="Ningún producto está por debajo del stock mínimo." icon={<Boxes className="size-5" />} />
          ) : (
            <div className="divide-y divide-line">
              {alerts?.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <ProductThumb src={item.imageUrl} name={item.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-ink">{item.name}</p>
                    <p className="text-[10px] text-muted">{item.categoryName ?? 'Sin categoría'} · mínimo {item.minStock}</p>
                  </div>
                  <div className="text-right">
                    <span className={cn('rounded-lg px-2 py-1 text-[10.5px] font-bold', item.stock === 0 ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700')}>
                      {item.stock === 0 ? 'Agotado' : `${item.stock} uds`}
                    </span>
                    <p className="mt-0.5 text-[9.5px] text-muted">{money(item.price, symbol)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'categories' && (
        <div className="card mt-3 p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <PackageSearch className="size-4 text-brand-500" />
            <p className="text-[12.5px] font-semibold text-ink">Distribución del inventario por categoría</p>
          </div>
          {(summary?.byCategory.length ?? 0) === 0 ? (
            <EmptyState title="Sin datos de inventario" description="Agrega productos con control de stock para ver esta distribución." />
          ) : (
            <div className="space-y-4">
              {summary?.byCategory.map((category) => (
                <div key={category.name}>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                      <p className="truncate text-[12px] font-semibold text-ink">{category.name}</p>
                      <span className="shrink-0 text-[10px] text-muted">{category.products} refs · {numberFormat(category.units)} uds</span>
                    </div>
                    <p className="shrink-0 text-[12px] font-bold text-ink">{money(category.value, symbol)}</p>
                  </div>
                  <ProgressBar value={(category.value / maxCategoryValue) * 100} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal
        open={movementOpen}
        onClose={() => setMovementOpen(false)}
        title="Registrar movimiento"
        subtitle="Ajusta el stock y deja trazabilidad del cambio."
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setMovementOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createMovement.mutate()}
              loading={createMovement.isPending}
              disabled={!form.productId || !(Number(form.quantity) > 0)}
            >
              Guardar movimiento
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="Producto" required>
            <Select value={form.productId} onChange={(event) => setForm((current) => ({ ...current, productId: event.target.value }))}>
              <option value="">Selecciona un producto</option>
              {(products?.items ?? []).filter((product) => product.trackStock).map((product) => (
                <option key={product.id} value={product.id}>{product.name} · {product.stock} uds</option>
              ))}
            </Select>
          </Field>
          {selectedProduct && (
            <div className="rounded-xl bg-canvas p-3 text-[11.5px]">
              <div className="flex justify-between"><span className="text-muted">Stock actual</span><span className="font-bold text-ink">{selectedProduct.stock} uds</span></div>
              <div className="mt-1 flex justify-between"><span className="text-muted">Stock mínimo</span><span className="font-semibold text-ink">{selectedProduct.minStock} uds</span></div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tipo">
              <Select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}>
                <option value="In">Entrada</option>
                <option value="Out">Salida</option>
                <option value="Adjustment">Ajuste (fijar)</option>
                <option value="Return">Devolución</option>
                <option value="Transfer">Traslado</option>
              </Select>
            </Field>
            <Field label="Cantidad" required>
              <Input inputMode="numeric" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} placeholder="0" />
            </Field>
          </div>
          <Field label="Sede">
            <Select value={form.branchId} onChange={(event) => setForm((current) => ({ ...current, branchId: event.target.value }))}>
              <option value="">Sede actual</option>
              {(branches ?? []).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </Select>
          </Field>
          <Field label="Notas">
            <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Motivo del movimiento…" />
          </Field>
          {form.type === 'Adjustment' && (
            <p className="rounded-xl bg-amber-50 p-3 text-[11px] text-amber-800">
              El ajuste fija el stock final en la cantidad indicada, no suma ni resta.
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}
