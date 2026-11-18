import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays,
  Filter,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Trash2,
  Wallet,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth, usePermissions } from '../lib/auth'
import type { Branch, Expense, Supplier } from '../lib/types'
import { dateShort, money, paymentLabel, todayInput } from '../lib/format'
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
  Pagination,
  Select,
  Textarea,
  Toggle,
  useToast,
} from '../components/ui'

interface ExpensePage {
  items: Expense[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  sum: number
}

type ExpenseForm = {
  category: string
  description: string
  amount: string
  date: string
  paymentMethod: string
  supplierId: string
  branchId: string
  notes: string
  isRecurring: boolean
}

const emptyForm: ExpenseForm = {
  category: 'Otros',
  description: '',
  amount: '',
  date: todayInput(),
  paymentMethod: 'Cash',
  supplierId: '',
  branchId: '',
  notes: '',
  isRecurring: false,
}

export function ExpensesPage() {
  const { session } = useAuth()
  const { canManageExpenses } = usePermissions()
  const toast = useToast()
  const queryClient = useQueryClient()
  const symbol = session?.tenant.currencySymbol ?? '$'

  const [category, setCategory] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [form, setForm] = useState<ExpenseForm>(emptyForm)
  const [deleting, setDeleting] = useState<Expense | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['expenses', category, from, to, page],
    queryFn: () =>
      api.get<ExpensePage>('/expenses', {
        category: category || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        pageSize: 20,
      }),
  })

  const { data: categories } = useQuery({ queryKey: ['expense-categories'], queryFn: () => api.get<string[]>('/expenses/categories') })
  const { data: suppliers } = useQuery({ queryKey: ['expense-suppliers'], queryFn: () => api.get<Supplier[]>('/suppliers') })
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: () => api.get<Branch[]>('/team/branches') })

  const expenses = data?.items ?? []
  const recurring = expenses.filter((expense) => expense.isRecurring).length
  const average = expenses.length > 0 ? (data?.sum ?? 0) / expenses.length : 0

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, date: todayInput(), branchId: session?.branch?.id ?? '' })
    setOpen(true)
  }

  const openEdit = (expense: Expense) => {
    setEditing(expense)
    setForm({
      category: expense.category,
      description: expense.description,
      amount: String(expense.amount),
      date: expense.date.slice(0, 10),
      paymentMethod: expense.paymentMethod,
      supplierId: expense.supplierId ?? '',
      branchId: expense.branchId ?? '',
      notes: expense.notes ?? '',
      isRecurring: expense.isRecurring,
    })
    setOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        category: form.category,
        description: form.description,
        amount: Number(form.amount) || 0,
        date: form.date || null,
        paymentMethod: form.paymentMethod,
        supplierId: form.supplierId || null,
        branchId: form.branchId || null,
        notes: form.notes || null,
        isRecurring: form.isRecurring,
      }
      return editing ? api.put<Expense>(`/expenses/${editing.id}`, payload) : api.post<Expense>('/expenses', payload)
    },
    onSuccess: () => {
      toast(editing ? 'Gasto actualizado.' : 'Gasto registrado.')
      setOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['expenses'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['report-profit'] })
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo guardar el gasto.', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      toast('Gasto eliminado.')
      setDeleting(null)
      void queryClient.invalidateQueries({ queryKey: ['expenses'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo eliminar el gasto.', 'error'),
  })

  const clearFilters = () => {
    setCategory('')
    setFrom('')
    setTo('')
    setPage(1)
  }

  return (
    <div className="page">
      <PageHeader
        title="Gastos"
        subtitle="Registra costos operativos y entiende la rentabilidad real de tu negocio."
        actions={canManageExpenses ? <Button size="sm" onClick={openCreate}><Plus className="size-4" /> Nuevo gasto</Button> : undefined}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Total gastos</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-rose-50 text-rose-500"><Wallet className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[20px] font-bold text-ink">{money(data?.sum ?? 0, symbol)}</p>
          <p className="mt-1 text-[10px] text-muted">Según filtros aplicados</p>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Registros</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><ReceiptText className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[20px] font-bold text-ink">{data?.total ?? 0}</p>
          <p className="mt-1 text-[10px] text-muted">Gastos en el periodo</p>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Promedio</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><Filter className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[20px] font-bold text-ink">{money(average, symbol)}</p>
          <p className="mt-1 text-[10px] text-muted">Por gasto registrado</p>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Recurrentes</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600"><RefreshCw className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[20px] font-bold text-ink">{recurring}</p>
          <p className="mt-1 text-[10px] text-muted">En esta página</p>
        </div>
      </div>

      <div className="card mt-4 mb-4 p-3 sm:p-4">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <Select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1) }} className="sm:w-[190px]">
            <option value="">Todas las categorías</option>
            {(categories ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1) }} aria-label="Desde" />
            <Input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1) }} aria-label="Hasta" />
          </div>
          {(category || from || to) && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>Limpiar</Button>
          )}
          <span className="ml-auto hidden text-[11px] text-muted sm:block">{data?.totalPages ?? 1} páginas</span>
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <PageLoader label="Cargando gastos…" />
        ) : isError ? (
          <EmptyState title="No pudimos cargar los gastos" description="Revisa tu conexión e intenta de nuevo." action={<Button onClick={() => refetch()}>Reintentar</Button>} />
        ) : expenses.length === 0 ? (
          <EmptyState
            title="Sin gastos registrados"
            description="Registra arriendo, nómina, servicios y otros costos para conocer tu utilidad real."
            icon={<Wallet className="size-5" />}
            action={canManageExpenses ? <Button onClick={openCreate}><Plus className="size-4" /> Nuevo gasto</Button> : undefined}
          />
        ) : (
          <>
            <div className="hidden table-wrap md:block">
              <table className="table">
                <thead>
                  <tr>
                    <th>Descripción</th>
                    <th>Categoría</th>
                    <th>Fecha</th>
                    <th>Pago</th>
                    <th>Proveedor</th>
                    <th className="text-right">Monto</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <span className="flex size-8 items-center justify-center rounded-lg bg-rose-50 text-rose-500"><ReceiptText className="size-3.5" /></span>
                          <div className="min-w-0">
                            <p className="truncate text-[12.5px] font-semibold text-ink">{expense.description}</p>
                            <p className="text-[10px] text-muted">{expense.branchName ?? 'Sin sede'}{expense.isRecurring ? ' · Recurrente' : ''}</p>
                          </div>
                        </div>
                      </td>
                      <td><Badge tone="violet">{expense.category}</Badge></td>
                      <td className="text-[11.5px] text-muted">{dateShort(expense.date)}</td>
                      <td className="text-[11.5px] text-muted">{paymentLabel(expense.paymentMethod)}</td>
                      <td className="text-[11.5px] text-muted">{expense.supplierName ?? '—'}</td>
                      <td className="text-right text-[12.5px] font-bold text-ink">{money(expense.amount, symbol)}</td>
                      <td>
                        {canManageExpenses && (
                          <div className="flex justify-end gap-1">
                            <button onClick={() => openEdit(expense)} className="icon-btn border border-line bg-white" aria-label="Editar"><Pencil className="size-3.5" /></button>
                            <button onClick={() => setDeleting(expense)} className="icon-btn border border-line bg-white text-rose-500" aria-label="Eliminar"><Trash2 className="size-3.5" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-line md:hidden">
              {expenses.map((expense) => (
                <button key={expense.id} onClick={() => canManageExpenses && openEdit(expense)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-500"><ReceiptText className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-ink">{expense.description}</p>
                    <p className="truncate text-[10px] text-muted">{expense.category} · {dateShort(expense.date)} · {paymentLabel(expense.paymentMethod)}</p>
                  </div>
                  <p className="text-[12px] font-bold text-rose-600">-{money(expense.amount, symbol)}</p>
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
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Editar gasto' : 'Nuevo gasto'}
        subtitle="Cada gasto se descuenta de tu utilidad neta."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending} disabled={!form.description.trim() || !(Number(form.amount) > 0)}>
              {editing ? 'Guardar cambios' : 'Registrar gasto'}
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Descripción" required className="sm:col-span-2">
            <Input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Ej. Arriendo local principal" />
          </Field>
          <Field label="Categoría" required>
            <Select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
              {(categories ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
          </Field>
          <Field label="Monto" required>
            <Input inputMode="decimal" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" />
          </Field>
          <Field label="Fecha">
            <Input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
          </Field>
          <Field label="Método de pago">
            <Select value={form.paymentMethod} onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))}>
              <option value="Cash">Efectivo</option>
              <option value="Card">Tarjeta</option>
              <option value="Transfer">Transferencia</option>
              <option value="Nequi">Nequi</option>
              <option value="Daviplata">Daviplata</option>
              <option value="Other">Otro</option>
            </Select>
          </Field>
          <Field label="Proveedor">
            <Select value={form.supplierId} onChange={(event) => setForm((current) => ({ ...current, supplierId: event.target.value }))}>
              <option value="">Sin proveedor</option>
              {(suppliers ?? []).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </Select>
          </Field>
          <Field label="Sede">
            <Select value={form.branchId} onChange={(event) => setForm((current) => ({ ...current, branchId: event.target.value }))}>
              <option value="">Todas / sin asignar</option>
              {(branches ?? []).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </Select>
          </Field>
          <Field label="Notas" className="sm:col-span-2">
            <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Referencia, número de factura…" />
          </Field>
          <div className="sm:col-span-2">
            <Toggle
              checked={form.isRecurring}
              onChange={(value) => setForm((current) => ({ ...current, isRecurring: value }))}
              label="Gasto recurrente"
              description="Se repite cada mes (arriendo, nómina, suscripciones)."
            />
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-canvas p-3 text-[11px] text-muted sm:col-span-2">
            <CalendarDays className="size-4 shrink-0 text-brand-500" />
            Los gastos se incluyen en los reportes de utilidad y en el dashboard del mes.
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        title="Eliminar gasto"
        message={`Se eliminará "${deleting?.description ?? ''}" por ${money(deleting?.amount ?? 0, symbol)}. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar gasto"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
