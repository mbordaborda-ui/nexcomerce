import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Trash2,
  Truck,
  UserRound,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { usePermissions } from '../lib/auth'
import type { Supplier } from '../lib/types'
import { dateShort, numberFormat } from '../lib/format'
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  PageLoader,
  SearchInput,
  Textarea,
  Toggle,
  cn,
  useToast,
} from '../components/ui'

type SupplierForm = {
  name: string
  contactName: string
  documentNumber: string
  email: string
  phone: string
  address: string
  notes: string
  isActive: boolean
}

const emptyForm: SupplierForm = {
  name: '', contactName: '', documentNumber: '', email: '', phone: '', address: '', notes: '', isActive: true,
}

export function SuppliersPage() {
  const { canManageSuppliers } = usePermissions()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState<SupplierForm>(emptyForm)
  const [deleting, setDeleting] = useState<Supplier | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['suppliers', search],
    queryFn: () => api.get<Supplier[]>('/suppliers', { search }),
  })

  const suppliers = data ?? []
  const active = suppliers.filter((supplier) => supplier.isActive)
  const withOrders = suppliers.filter((supplier) => supplier.productsSupplied > 0)

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setOpen(true)
  }

  const openEdit = (supplier: Supplier) => {
    setEditing(supplier)
    setForm({
      name: supplier.name,
      contactName: supplier.contactName ?? '',
      documentNumber: supplier.documentNumber ?? '',
      email: supplier.email ?? '',
      phone: supplier.phone ?? '',
      address: supplier.address ?? '',
      notes: supplier.notes ?? '',
      isActive: supplier.isActive,
    })
    setOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        contactName: form.contactName || null,
        documentNumber: form.documentNumber || null,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        notes: form.notes || null,
        isActive: form.isActive,
      }
      return editing ? api.put<Supplier>(`/suppliers/${editing.id}`, payload) : api.post<Supplier>('/suppliers', payload)
    },
    onSuccess: () => {
      toast(editing ? 'Proveedor actualizado.' : 'Proveedor creado.')
      setOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      void queryClient.invalidateQueries({ queryKey: ['expense-suppliers'] })
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo guardar el proveedor.', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/suppliers/${id}`),
    onSuccess: () => {
      toast('Proveedor desactivado.')
      setDeleting(null)
      void queryClient.invalidateQueries({ queryKey: ['suppliers'] })
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo desactivar el proveedor.', 'error'),
  })

  return (
    <div className="page">
      <PageHeader
        title="Proveedores"
        subtitle="Centraliza contactos y compras de quienes abastecen tu negocio."
        actions={canManageSuppliers ? <Button size="sm" onClick={openCreate}><Plus className="size-4" /> Nuevo proveedor</Button> : undefined}
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Proveedores</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Truck className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[20px] font-bold text-ink">{numberFormat(suppliers.length)}</p>
          <p className="mt-1 text-[10px] text-muted">{active.length} activos</p>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Con compras</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><Building2 className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[20px] font-bold text-ink">{withOrders.length}</p>
          <p className="mt-1 text-[10px] text-muted">Asociados a gastos</p>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Registros</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600"><UserRound className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[20px] font-bold text-ink">{numberFormat(suppliers.reduce((sum, supplier) => sum + supplier.productsSupplied, 0))}</p>
          <p className="mt-1 text-[10px] text-muted">Compras y gastos</p>
        </div>
      </div>

      <div className="card mt-4 mb-4 p-3 sm:p-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre, contacto o teléfono…" />
      </div>

      {isLoading ? (
        <div className="card"><PageLoader label="Cargando proveedores…" /></div>
      ) : isError ? (
        <div className="card">
          <EmptyState title="No pudimos cargar los proveedores" description="Revisa tu conexión e intenta de nuevo." action={<Button onClick={() => refetch()}>Reintentar</Button>} />
        </div>
      ) : suppliers.length === 0 ? (
        <div className="card">
          <EmptyState
            title="Aún no tienes proveedores"
            description="Agrega los proveedores que abastecen tu negocio para controlar compras y gastos."
            icon={<Truck className="size-5" />}
            action={canManageSuppliers ? <Button onClick={openCreate}><Plus className="size-4" /> Nuevo proveedor</Button> : undefined}
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {suppliers.map((supplier) => (
            <div key={supplier.id} className={cn('card card-hover flex flex-col p-4', !supplier.isActive && 'opacity-70')}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <Building2 className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-ink">{supplier.name}</p>
                    <p className="truncate text-[10.5px] text-muted">{supplier.contactName ?? 'Sin contacto asignado'}</p>
                  </div>
                </div>
                <Badge tone={supplier.isActive ? 'green' : 'gray'}>{supplier.isActive ? 'Activo' : 'Inactivo'}</Badge>
              </div>

              <div className="mt-3 flex-1 space-y-1.5 text-[11px]">
                {supplier.phone && <p className="flex items-center gap-2 text-muted"><Phone className="size-3 shrink-0" /> {supplier.phone}</p>}
                {supplier.email && <p className="flex items-center gap-2 truncate text-muted"><Mail className="size-3 shrink-0" /> <span className="truncate">{supplier.email}</span></p>}
                {supplier.address && <p className="flex items-center gap-2 truncate text-muted"><MapPin className="size-3 shrink-0" /> <span className="truncate">{supplier.address}</span></p>}
                {supplier.documentNumber && <p className="text-[10px] text-muted">NIT / Doc. {supplier.documentNumber}</p>}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5">
                <div>
                  <p className="text-[11px] font-bold text-ink">{supplier.productsSupplied} compra{supplier.productsSupplied === 1 ? '' : 's'}</p>
                  <p className="text-[9.5px] text-muted">Desde {dateShort(supplier.createdAt)}</p>
                </div>
                {canManageSuppliers && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(supplier)} className="icon-btn border border-line bg-white" aria-label="Editar"><Pencil className="size-3.5" /></button>
                    <button onClick={() => setDeleting(supplier)} className="icon-btn border border-line bg-white text-rose-500" aria-label="Desactivar"><Trash2 className="size-3.5" /></button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Editar proveedor' : 'Nuevo proveedor'}
        subtitle="Guarda los datos clave para agilizar tus compras."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending} disabled={!form.name.trim()}>Guardar proveedor</Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Empresa / proveedor" required className="sm:col-span-2">
            <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ej. Distribuidora Andina" />
          </Field>
          <Field label="Persona de contacto">
            <Input value={form.contactName} onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))} />
          </Field>
          <Field label="Documento / NIT">
            <Input value={form.documentNumber} onChange={(event) => setForm((current) => ({ ...current, documentNumber: event.target.value }))} />
          </Field>
          <Field label="Teléfono">
            <Input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
          </Field>
          <Field label="Correo">
            <Input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          </Field>
          <Field label="Dirección" className="sm:col-span-2">
            <Input value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
          </Field>
          <Field label="Notas" className="sm:col-span-2">
            <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Condiciones de pago, plazos de entrega…" />
          </Field>
          <div className="sm:col-span-2">
            <Toggle checked={form.isActive} onChange={(value) => setForm((current) => ({ ...current, isActive: value }))} label="Proveedor activo" description="Disponible para asociar a gastos y compras." />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        title="Desactivar proveedor"
        message={`"${deleting?.name ?? ''}" quedará inactivo. Su historial de compras se conserva.`}
        confirmLabel="Desactivar"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
