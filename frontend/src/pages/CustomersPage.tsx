import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Crown,
  History,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  ShoppingBag,
  Trash2,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth, usePermissions } from '../lib/auth'
import type { Customer, PageResult, SaleSummary } from '../lib/types'
import { dateTime, money, numberFormat } from '../lib/format'
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  PageLoader,
  Pagination,
  SearchInput,
  Textarea,
  Toggle,
  cn,
  useToast,
} from '../components/ui'

type CustomerForm = {
  name: string
  documentNumber: string
  email: string
  phone: string
  address: string
  notes: string
  tags: string
  isActive: boolean
}

const emptyForm: CustomerForm = { name: '', documentNumber: '', email: '', phone: '', address: '', notes: '', tags: '', isActive: true }

interface CustomerDetail {
  customer: Customer
  sales: SaleSummary[]
}

export function CustomersPage() {
  const { session } = useAuth()
  const { canManageCustomers } = usePermissions()
  const toast = useToast()
  const queryClient = useQueryClient()
  const symbol = session?.tenant.currencySymbol ?? '$'

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState<CustomerForm>(emptyForm)
  const [deleting, setDeleting] = useState<Customer | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['customers', search, page],
    queryFn: () => api.get<PageResult<Customer>>('/customers', { search, page, pageSize: 20 }),
  })

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['customer', detailId],
    queryFn: () => api.get<CustomerDetail>(`/customers/${detailId}`),
    enabled: Boolean(detailId),
  })

  const customers = data?.items ?? []

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setOpen(true)
  }

  const openEdit = (customer: Customer) => {
    setEditing(customer)
    setForm({
      name: customer.name,
      documentNumber: customer.documentNumber ?? '',
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      address: customer.address ?? '',
      notes: customer.notes ?? '',
      tags: customer.tags ?? '',
      isActive: customer.isActive,
    })
    setOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        documentNumber: form.documentNumber || null,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        notes: form.notes || null,
        tags: form.tags || null,
        isActive: form.isActive,
      }
      return editing ? api.put<Customer>(`/customers/${editing.id}`, payload) : api.post<Customer>('/customers', payload)
    },
    onSuccess: () => {
      toast(editing ? 'Cliente actualizado.' : 'Cliente creado.')
      setOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['customers'] })
      void queryClient.invalidateQueries({ queryKey: ['pos-customers'] })
      void queryClient.invalidateQueries({ queryKey: ['customer'] })
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo guardar el cliente.', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      toast('Cliente desactivado.')
      setDeleting(null)
      void queryClient.invalidateQueries({ queryKey: ['customers'] })
      void queryClient.invalidateQueries({ queryKey: ['pos-customers'] })
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo desactivar el cliente.', 'error'),
  })

  const pagePurchases = customers.reduce((sum, customer) => sum + customer.purchases, 0)
  const pageSpent = customers.reduce((sum, customer) => sum + customer.totalSpent, 0)
  const recurring = customers.filter((customer) => customer.purchases > 1).length

  return (
    <div className="page">
      <PageHeader
        title="Clientes"
        subtitle="Conoce a tus clientes, su historial y su valor para el negocio."
        actions={
          canManageCustomers ? (
            <Button size="sm" onClick={openCreate}><Plus className="size-4" /> Nuevo cliente</Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Clientes</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Users className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[20px] font-bold text-ink">{numberFormat(data?.total ?? 0)}</p>
          <p className="mt-1 text-[10px] text-muted">Registrados en el negocio</p>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Compras</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600"><ShoppingBag className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[20px] font-bold text-ink">{numberFormat(pagePurchases)}</p>
          <p className="mt-1 text-[10px] text-muted">En esta página</p>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Facturación</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><Wallet className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[20px] font-bold text-ink">{money(pageSpent, symbol)}</p>
          <p className="mt-1 text-[10px] text-muted">Compras acumuladas</p>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Recurrentes</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><Crown className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[20px] font-bold text-ink">{recurring}</p>
          <p className="mt-1 text-[10px] text-muted">Con más de una compra</p>
        </div>
      </div>

      <div className="card mt-4 mb-4 p-3 sm:p-4">
        <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1) }} placeholder="Buscar por nombre, correo, teléfono o documento…" />
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <PageLoader label="Cargando clientes…" />
        ) : isError ? (
          <EmptyState title="No pudimos cargar los clientes" description="Revisa tu conexión e intenta de nuevo." action={<Button onClick={() => refetch()}>Reintentar</Button>} />
        ) : customers.length === 0 ? (
          <EmptyState
            title="Aún no tienes clientes"
            description="Registra clientes para hacer seguimiento de sus compras y fidelizarlos."
            icon={<UserPlus className="size-5" />}
            action={canManageCustomers ? <Button onClick={openCreate}><Plus className="size-4" /> Nuevo cliente</Button> : undefined}
          />
        ) : (
          <>
            <div className="hidden table-wrap md:block">
              <table className="table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Contacto</th>
                    <th className="text-right">Compras</th>
                    <th className="text-right">Total gastado</th>
                    <th>Última compra</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer.id}>
                      <td>
                        <button onClick={() => setDetailId(customer.id)} className="flex items-center gap-2.5 text-left">
                          <Avatar name={customer.name} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-[12.5px] font-semibold text-ink">{customer.name}</p>
                            <p className="truncate text-[10px] text-muted">{customer.documentNumber ?? 'Sin documento'}{customer.loyaltyPoints > 0 ? ` · ${customer.loyaltyPoints} pts` : ''}</p>
                          </div>
                        </button>
                      </td>
                      <td>
                        <p className="text-[11.5px] text-ink">{customer.phone ?? '—'}</p>
                        <p className="truncate text-[10px] text-muted">{customer.email ?? 'Sin correo'}</p>
                      </td>
                      <td className="text-right text-[12px] font-semibold text-ink">{customer.purchases}</td>
                      <td className="text-right text-[12px] font-bold text-ink">{money(customer.totalSpent, symbol)}</td>
                      <td className="text-[11px] text-muted">{customer.lastPurchaseAt ? dateTime(customer.lastPurchaseAt) : 'Sin compras'}</td>
                      <td><Badge tone={customer.isActive ? 'green' : 'gray'}>{customer.isActive ? 'Activo' : 'Inactivo'}</Badge></td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button onClick={() => setDetailId(customer.id)} className="icon-btn border border-line bg-white" aria-label="Historial"><History className="size-3.5" /></button>
                          {canManageCustomers && (
                            <>
                              <button onClick={() => openEdit(customer)} className="icon-btn border border-line bg-white" aria-label="Editar"><Pencil className="size-3.5" /></button>
                              <button onClick={() => setDeleting(customer)} className="icon-btn border border-line bg-white text-rose-500" aria-label="Desactivar"><Trash2 className="size-3.5" /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-line md:hidden">
              {customers.map((customer) => (
                <div key={customer.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={customer.name} size="sm" />
                  <button onClick={() => setDetailId(customer.id)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-[12px] font-semibold text-ink">{customer.name}</p>
                    <p className="truncate text-[10px] text-muted">{customer.phone ?? customer.email ?? 'Sin contacto'} · {customer.purchases} compras</p>
                  </button>
                  <div className="text-right">
                    <p className="text-[12px] font-bold text-ink">{money(customer.totalSpent, symbol)}</p>
                    {canManageCustomers && (
                      <button onClick={() => openEdit(customer)} className="text-[9.5px] font-semibold text-brand-600">Editar</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-4 pb-4">
              <Pagination page={data?.page ?? 1} totalPages={data?.totalPages ?? 1} onChange={setPage} />
            </div>
          </>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Editar cliente' : 'Nuevo cliente'}
        subtitle="Los datos de contacto te ayudan a vender y fidelizar mejor."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending} disabled={!form.name.trim()}>Guardar cliente</Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre completo" required className="sm:col-span-2">
            <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ej. Laura Gómez" />
          </Field>
          <Field label="Documento / NIT">
            <Input value={form.documentNumber} onChange={(event) => setForm((current) => ({ ...current, documentNumber: event.target.value }))} />
          </Field>
          <Field label="Teléfono / WhatsApp">
            <Input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="+57 300 000 0000" />
          </Field>
          <Field label="Correo">
            <Input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          </Field>
          <Field label="Dirección">
            <Input value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
          </Field>
          <Field label="Etiquetas" hint="Ej. mayorista, VIP, frecuente" className="sm:col-span-2">
            <Input value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} />
          </Field>
          <Field label="Notas" className="sm:col-span-2">
            <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Preferencias, recordatorios…" />
          </Field>
          <div className="sm:col-span-2">
            <Toggle checked={form.isActive} onChange={(value) => setForm((current) => ({ ...current, isActive: value }))} label="Cliente activo" description="Disponible para asociar a nuevas ventas." />
          </div>
        </div>
      </Modal>

      <Modal
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        title={detail?.customer.name ?? 'Historial del cliente'}
        subtitle={detail ? `${detail.customer.purchases} compras · ${money(detail.customer.totalSpent, symbol)} facturados` : undefined}
        size="md"
      >
        {detailLoading || !detail ? (
          <PageLoader label="Cargando historial…" />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {detail.customer.phone && <Badge tone="violet"><Phone className="size-3" /> {detail.customer.phone}</Badge>}
              {detail.customer.email && <Badge tone="gray"><Mail className="size-3" /> {detail.customer.email}</Badge>}
              {detail.customer.address && <Badge tone="gray"><MapPin className="size-3" /> {detail.customer.address}</Badge>}
              {detail.customer.tags && <Badge tone="amber">{detail.customer.tags}</Badge>}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-canvas p-3 text-center">
                <p className="font-display text-[16px] font-bold text-ink">{detail.customer.purchases}</p>
                <p className="text-[9.5px] text-muted">Compras</p>
              </div>
              <div className="rounded-xl bg-canvas p-3 text-center">
                <p className="font-display text-[16px] font-bold text-ink">{money(detail.customer.totalSpent, symbol)}</p>
                <p className="text-[9.5px] text-muted">Total gastado</p>
              </div>
              <div className="rounded-xl bg-canvas p-3 text-center">
                <p className="font-display text-[16px] font-bold text-ink">{detail.customer.loyaltyPoints}</p>
                <p className="text-[9.5px] text-muted">Puntos</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[12px] font-semibold text-ink">Últimas compras</p>
              {detail.sales.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line p-4 text-center text-[11.5px] text-muted">Este cliente aún no tiene compras registradas.</p>
              ) : (
                <div className="space-y-1.5">
                  {detail.sales.map((sale) => (
                    <div key={sale.id} className="flex items-center gap-2.5 rounded-xl border border-line/80 px-3 py-2">
                      <span className={cn('flex size-7 items-center justify-center rounded-lg', sale.status === 'Cancelled' ? 'bg-rose-50 text-rose-500' : 'bg-brand-50 text-brand-600')}>
                        <ShoppingBag className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11.5px] font-semibold text-ink">{sale.number}</p>
                        <p className="text-[9.5px] text-muted">{dateTime(sale.createdAt)} · {sale.itemCount} artículos</p>
                      </div>
                      <p className="text-[11.5px] font-bold text-ink">{money(sale.total, symbol)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {detail.customer.notes && (
              <p className="rounded-xl bg-brand-50/60 p-3 text-[11.5px] text-muted">{detail.customer.notes}</p>
            )}

            <div className="flex gap-2">
              {detail.customer.phone && (
                <a
                  href={`https://wa.me/${detail.customer.phone.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary btn-sm flex-1"
                >
                  <MessageCircle className="size-3.5" /> Escribir por WhatsApp
                </a>
              )}
              {canManageCustomers && (
                <Button variant="soft" size="sm" className="flex-1" onClick={() => { setDetailId(null); openEdit(detail.customer) }}>
                  <Pencil className="size-3.5" /> Editar cliente
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        title="Desactivar cliente"
        message={`"${deleting?.name ?? ''}" quedará inactivo y no aparecerá en el punto de venta. Su historial se conserva.`}
        confirmLabel="Desactivar"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
