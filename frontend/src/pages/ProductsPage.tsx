import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Boxes,
  Layers,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  Tag,
  Trash2,
  Wrench,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth, usePermissions } from '../lib/auth'
import type { Category, InventorySummary, PageResult, Product } from '../lib/types'
import { money, numberFormat } from '../lib/format'
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
  ProductThumb,
  SearchInput,
  Select,
  Tabs,
  Textarea,
  Toggle,
  cn,
  useToast,
} from '../components/ui'

type ProductForm = {
  name: string
  sku: string
  barcode: string
  categoryId: string
  type: string
  price: string
  cost: string
  compareAtPrice: string
  unit: string
  brand: string
  stock: string
  minStock: string
  trackStock: boolean
  isActive: boolean
  description: string
  imageUrl: string
  tags: string
}

const emptyProduct: ProductForm = {
  name: '', sku: '', barcode: '', categoryId: '', type: 'Product', price: '', cost: '',
  compareAtPrice: '', unit: 'Unidad', brand: '', stock: '0', minStock: '0',
  trackStock: true, isActive: true, description: '', imageUrl: '', tags: '',
}

type CategoryForm = { name: string; description: string; color: string; isActive: boolean }
const emptyCategory: CategoryForm = { name: '', description: '', color: '#7C3AED', isActive: true }

export function ProductsPage() {
  const { session } = useAuth()
  const { canManageProducts } = usePermissions()
  const toast = useToast()
  const queryClient = useQueryClient()
  const symbol = session?.tenant.currencySymbol ?? '$'

  const [tab, setTab] = useState<'products' | 'categories'>('products')
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [page, setPage] = useState(1)

  const [productOpen, setProductOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyProduct)
  const [deleting, setDeleting] = useState<Product | null>(null)

  const [categoryOpen, setCategoryOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategory)
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null)

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => api.get<Category[]>('/categories') })
  const { data: summary } = useQuery({ queryKey: ['inventory-summary'], queryFn: () => api.get<InventorySummary>('/inventory/summary') })

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['products', search, categoryId, lowOnly, page],
    queryFn: () =>
      api.get<PageResult<Product>>('/products', {
        search,
        categoryId: categoryId || undefined,
        lowStock: lowOnly || undefined,
        page,
        pageSize: 24,
        includeInactive: true,
      }),
  })

  const { data: allCategories } = useQuery({
    queryKey: ['categories-all'],
    queryFn: () => api.get<Category[]>('/categories'),
  })

  const products = data?.items ?? []

  const setField = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => setForm((current) => ({ ...current, [key]: value }))

  const openCreate = () => {
    setEditing(null)
    setForm(emptyProduct)
    setProductOpen(true)
  }

  const openEdit = (product: Product) => {
    setEditing(product)
    setForm({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode ?? '',
      categoryId: product.categoryId ?? '',
      type: product.type,
      price: String(product.price),
      cost: String(product.cost),
      compareAtPrice: product.compareAtPrice ? String(product.compareAtPrice) : '',
      unit: product.unit,
      brand: product.brand ?? '',
      stock: String(product.stock),
      minStock: String(product.minStock),
      trackStock: product.trackStock,
      isActive: product.isActive,
      description: product.description ?? '',
      imageUrl: product.imageUrl ?? '',
      tags: product.tags ?? '',
    })
    setProductOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        sku: form.sku,
        barcode: form.barcode || null,
        description: form.description || null,
        categoryId: form.categoryId || null,
        type: form.type,
        price: Number(form.price) || 0,
        cost: Number(form.cost) || 0,
        compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : null,
        unit: form.unit || 'Unidad',
        imageUrl: form.imageUrl || null,
        brand: form.brand || null,
        isActive: form.isActive,
        trackStock: form.type === 'Product' && form.trackStock,
        stock: Number(form.stock) || 0,
        minStock: Number(form.minStock) || 0,
        tags: form.tags || null,
        variants: null,
      }
      return editing ? api.put<Product>(`/products/${editing.id}`, payload) : api.post<Product>('/products', payload)
    },
    onSuccess: () => {
      toast(editing ? 'Producto actualizado.' : 'Producto creado.')
      setProductOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory-summary'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] })
      void queryClient.invalidateQueries({ queryKey: ['categories'] })
      void queryClient.invalidateQueries({ queryKey: ['pos-products'] })
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo guardar el producto.', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      toast('Producto desactivado.')
      setDeleting(null)
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['pos-products'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory-summary'] })
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo desactivar el producto.', 'error'),
  })

  const openCategory = (category?: Category) => {
    setEditingCategory(category ?? null)
    setCategoryForm(category ? { name: category.name, description: category.description ?? '', color: category.color, isActive: category.isActive } : emptyCategory)
    setCategoryOpen(true)
  }

  const categoryMutation = useMutation({
    mutationFn: () => {
      const payload = categoryForm
      return editingCategory ? api.put<Category>(`/categories/${editingCategory.id}`, payload) : api.post<Category>('/categories', payload)
    },
    onSuccess: () => {
      toast(editingCategory ? 'Categoría actualizada.' : 'Categoría creada.')
      setCategoryOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['categories'] })
      void queryClient.invalidateQueries({ queryKey: ['categories-all'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['pos-products'] })
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo guardar la categoría.', 'error'),
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      toast('Categoría desactivada.')
      setDeletingCategory(null)
      void queryClient.invalidateQueries({ queryKey: ['categories'] })
      void queryClient.invalidateQueries({ queryKey: ['categories-all'] })
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo desactivar la categoría.', 'error'),
  })

  useEffect(() => {
    setPage(1)
  }, [search, categoryId, lowOnly])

  const canSubmit = form.name.trim().length > 0 && (Number(form.price) || 0) >= 0

  return (
    <div className="page">
      <PageHeader
        title="Productos"
        subtitle="Gestiona tu catálogo, precios, variantes y categorías."
        actions={
          canManageProducts ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => openCategory()}>
                <Tag className="size-3.5" /> Nueva categoría
              </Button>
              <Button size="sm" onClick={openCreate}>
                <Plus className="size-4" /> Nuevo producto
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Productos</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Package className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[20px] font-bold text-ink">{numberFormat(summary?.products ?? 0)}</p>
          <p className="mt-1 text-[10px] text-muted">Activos en el catálogo</p>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Unidades</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600"><Boxes className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[20px] font-bold text-ink">{numberFormat(summary?.stockUnits ?? 0)}</p>
          <p className="mt-1 text-[10px] text-muted">En inventario</p>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Valor costo</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><Layers className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[20px] font-bold text-ink">{money(summary?.stockValue ?? 0, symbol)}</p>
          <p className="mt-1 text-[10px] text-muted">Inversión actual</p>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Stock bajo</p>
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
            { id: 'products', label: 'Catálogo', count: data?.total, icon: <Package className="size-3.5" /> },
            { id: 'categories', label: 'Categorías', count: categories?.length, icon: <Tag className="size-3.5" /> },
          ]}
        />
      </div>

      {tab === 'products' ? (
        <>
          <div className="card mt-3 mb-4 p-3 sm:p-4">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre, SKU, marca o etiqueta…" className="flex-1" />
              <div className="flex items-center gap-2">
                <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="min-w-0 flex-1 sm:w-[170px]">
                  <option value="">Todas las categorías</option>
                  {(allCategories ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </Select>
                <button
                  type="button"
                  onClick={() => setLowOnly((value) => !value)}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2.5 text-[11.5px] font-semibold transition-colors',
                    lowOnly ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-line bg-white text-muted hover:border-brand-200',
                  )}
                >
                  <AlertTriangle className="size-3.5" /> Stock bajo
                </button>
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            {isLoading ? (
              <PageLoader label="Cargando catálogo…" />
            ) : isError ? (
              <EmptyState title="No pudimos cargar los productos" description="Intenta de nuevo en unos segundos." action={<Button onClick={() => refetch()}>Reintentar</Button>} />
            ) : products.length === 0 ? (
              <EmptyState
                title="Tu catálogo está vacío"
                description="Crea tu primer producto o servicio para empezar a vender."
                icon={<PackagePlus className="size-5" />}
                action={canManageProducts ? <Button onClick={openCreate}><Plus className="size-4" /> Nuevo producto</Button> : undefined}
              />
            ) : (
              <>
                <div className="hidden table-wrap md:block">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Categoría</th>
                        <th>Tipo</th>
                        <th className="text-right">Precio</th>
                        <th className="text-right">Costo</th>
                        <th className="text-right">Stock</th>
                        <th>Estado</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => {
                        const stock = product.variants.length > 0 ? product.variants.reduce((sum, variant) => sum + variant.stock, 0) : product.stock
                        return (
                          <tr key={product.id}>
                            <td>
                              <div className="flex items-center gap-2.5">
                                <ProductThumb src={product.imageUrl} name={product.name} size="sm" />
                                <div className="min-w-0">
                                  <p className="truncate text-[12.5px] font-semibold text-ink">{product.name}</p>
                                  <p className="truncate text-[10px] text-muted">{product.sku}{product.brand ? ` · ${product.brand}` : ''}</p>
                                </div>
                              </div>
                            </td>
                            <td>
                              {product.categoryName ? (
                                <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted">
                                  <span className="size-2 rounded-full" style={{ backgroundColor: product.categoryColor ?? '#7C3AED' }} />
                                  {product.categoryName}
                                </span>
                              ) : <span className="text-[11px] text-muted">Sin categoría</span>}
                            </td>
                            <td>
                              <Badge tone={product.type === 'Service' ? 'gray' : 'violet'}>
                                {product.type === 'Service' ? <Wrench className="size-3" /> : <Package className="size-3" />}
                                {product.type === 'Service' ? 'Servicio' : 'Producto'}
                              </Badge>
                            </td>
                            <td className="text-right text-[12.5px] font-bold text-ink">{money(product.price, symbol)}</td>
                            <td className="text-right text-[11.5px] text-muted">{money(product.cost, symbol)}</td>
                            <td className="text-right">
                              {product.trackStock ? (
                                <span className={cn('rounded-lg px-2 py-0.5 text-[10.5px] font-bold', stock <= 0 ? 'bg-rose-50 text-rose-600' : stock <= product.minStock ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700')}>
                                  {stock} uds
                                </span>
                              ) : <span className="text-[11px] text-muted">—</span>}
                            </td>
                            <td><Badge tone={product.isActive ? 'green' : 'gray'}>{product.isActive ? 'Activo' : 'Inactivo'}</Badge></td>
                            <td>
                              {canManageProducts && (
                                <div className="flex justify-end gap-1">
                                  <button onClick={() => openEdit(product)} className="icon-btn border border-line bg-white" aria-label="Editar"><Pencil className="size-3.5" /></button>
                                  <button onClick={() => setDeleting(product)} className="icon-btn border border-line bg-white text-rose-500" aria-label="Desactivar"><Trash2 className="size-3.5" /></button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-line md:hidden">
                  {products.map((product) => {
                    const stock = product.variants.length > 0 ? product.variants.reduce((sum, variant) => sum + variant.stock, 0) : product.stock
                    return (
                      <button key={product.id} onClick={() => canManageProducts && openEdit(product)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                        <ProductThumb src={product.imageUrl} name={product.name} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-semibold text-ink">{product.name}</p>
                          <p className="truncate text-[10px] text-muted">{product.sku} · {product.categoryName ?? 'Sin categoría'}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-[12px] font-bold text-brand-700">{money(product.price, symbol)}</span>
                            {product.trackStock && (
                              <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-bold', stock <= 0 ? 'bg-rose-50 text-rose-600' : stock <= product.minStock ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700')}>
                                {stock} uds
                              </span>
                            )}
                          </div>
                        </div>
                        <Pencil className="size-3.5 shrink-0 text-muted" />
                      </button>
                    )
                  })}
                </div>

                <div className="px-4 pb-4">
                  <Pagination page={data?.page ?? 1} totalPages={data?.totalPages ?? 1} onChange={setPage} />
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(categories ?? []).map((category) => (
            <div key={category.id} className="card card-hover p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="size-9 rounded-xl" style={{ backgroundColor: `${category.color}22`, color: category.color }}>
                    <span className="flex size-full items-center justify-center"><Tag className="size-4" style={{ color: category.color }} /></span>
                  </span>
                  <div>
                    <p className="text-[13px] font-bold text-ink">{category.name}</p>
                    <p className="text-[10.5px] text-muted">{category.productCount} producto{category.productCount === 1 ? '' : 's'}</p>
                  </div>
                </div>
                <Badge tone={category.isActive ? 'green' : 'gray'}>{category.isActive ? 'Activa' : 'Inactiva'}</Badge>
              </div>
              {category.description && <p className="mt-2 line-clamp-2 text-[11.5px] text-muted">{category.description}</p>}
              {canManageProducts && (
                <div className="mt-3 flex gap-2 border-t border-line pt-3">
                  <Button variant="secondary" size="sm" className="flex-1" onClick={() => openCategory(category)}><Pencil className="size-3" /> Editar</Button>
                  <Button variant="danger" size="sm" onClick={() => setDeletingCategory(category)}><Trash2 className="size-3" /></Button>
                </div>
              )}
            </div>
          ))}
          {canManageProducts && (
            <button onClick={() => openCategory()} className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-brand-200 bg-brand-50/40 text-brand-600 transition-colors hover:bg-brand-50">
              <span className="flex size-10 items-center justify-center rounded-xl bg-white"><Plus className="size-5" /></span>
              <span className="text-[12px] font-semibold">Agregar categoría</span>
            </button>
          )}
        </div>
      )}

      <Modal
        open={productOpen}
        onClose={() => setProductOpen(false)}
        title={editing ? 'Editar producto' : 'Nuevo producto'}
        subtitle="Los cambios se reflejan en el punto de venta al instante."
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setProductOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending} disabled={!canSubmit}>
              {editing ? 'Guardar cambios' : 'Crear producto'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre" required className="sm:col-span-2">
              <Input value={form.name} onChange={(event) => setField('name', event.target.value)} placeholder="Ej. Camiseta oversize" />
            </Field>
            <Field label="SKU" hint="Déjalo vacío para generarlo automáticamente.">
              <Input value={form.sku} onChange={(event) => setField('sku', event.target.value)} placeholder="PRD-0001" />
            </Field>
            <Field label="Código de barras">
              <Input value={form.barcode} onChange={(event) => setField('barcode', event.target.value)} placeholder="Opcional" />
            </Field>
            <Field label="Categoría">
              <Select value={form.categoryId} onChange={(event) => setField('categoryId', event.target.value)}>
                <option value="">Sin categoría</option>
                {(allCategories ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </Select>
            </Field>
            <Field label="Tipo">
              <Select value={form.type} onChange={(event) => setField('type', event.target.value)}>
                <option value="Product">Producto físico</option>
                <option value="Service">Servicio</option>
              </Select>
            </Field>
            <Field label="Precio de venta" required>
              <Input inputMode="decimal" value={form.price} onChange={(event) => setField('price', event.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Costo">
              <Input inputMode="decimal" value={form.cost} onChange={(event) => setField('cost', event.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Precio antes">
              <Input inputMode="decimal" value={form.compareAtPrice} onChange={(event) => setField('compareAtPrice', event.target.value)} placeholder="Opcional" />
            </Field>
            <Field label="Unidad">
              <Input value={form.unit} onChange={(event) => setField('unit', event.target.value)} placeholder="Unidad, kg, hora…" />
            </Field>
            <Field label="Marca">
              <Input value={form.brand} onChange={(event) => setField('brand', event.target.value)} placeholder="Opcional" />
            </Field>
            <Field label="Etiquetas" hint="Sepáralas con comas.">
              <Input value={form.tags} onChange={(event) => setField('tags', event.target.value)} placeholder="verano, algodón" />
            </Field>
            <Field label="Imagen (URL)">
              <Input value={form.imageUrl} onChange={(event) => setField('imageUrl', event.target.value)} placeholder="https://…" />
            </Field>
            <Field label="Stock actual">
              <Input inputMode="numeric" value={form.stock} disabled={form.type === 'Service' || !form.trackStock} onChange={(event) => setField('stock', event.target.value)} />
            </Field>
            <Field label="Stock mínimo">
              <Input inputMode="numeric" value={form.minStock} disabled={form.type === 'Service' || !form.trackStock} onChange={(event) => setField('minStock', event.target.value)} />
            </Field>
          </div>

          <div className="space-y-3 rounded-xl border border-line p-3.5">
            <Toggle
              checked={form.type === 'Product' && form.trackStock}
              onChange={(value) => setField('trackStock', value)}
              label="Controlar inventario"
              description="Descuenta stock en cada venta y genera alertas."
              disabled={form.type === 'Service'}
            />
            <Toggle checked={form.isActive} onChange={(value) => setField('isActive', value)} label="Producto activo" description="Visible en el punto de venta y el catálogo." />
          </div>

          <Field label="Descripción">
            <Textarea value={form.description} onChange={(event) => setField('description', event.target.value)} placeholder="Detalles del producto o servicio…" />
          </Field>

          {editing && editing.variants.length > 0 && (
            <p className="rounded-xl bg-brand-50/60 p-3 text-[11.5px] text-muted">
              Este producto tiene {editing.variants.length} variantes. El stock total se calcula sumando sus existencias.
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={categoryOpen}
        onClose={() => setCategoryOpen(false)}
        title={editingCategory ? 'Editar categoría' : 'Nueva categoría'}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCategoryOpen(false)}>Cancelar</Button>
            <Button onClick={() => categoryMutation.mutate()} loading={categoryMutation.isPending} disabled={!categoryForm.name.trim()}>Guardar</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="Nombre" required>
            <Input value={categoryForm.name} onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ej. Camisetas" />
          </Field>
          <Field label="Descripción">
            <Textarea value={categoryForm.description} onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))} />
          </Field>
          <Field label="Color">
            <div className="flex items-center gap-2">
              <input type="color" value={categoryForm.color} onChange={(event) => setCategoryForm((current) => ({ ...current, color: event.target.value }))} className="h-10 w-14 cursor-pointer rounded-lg border border-line bg-white p-1" />
              <Input value={categoryForm.color} onChange={(event) => setCategoryForm((current) => ({ ...current, color: event.target.value }))} />
            </div>
          </Field>
          <Toggle checked={categoryForm.isActive} onChange={(value) => setCategoryForm((current) => ({ ...current, isActive: value }))} label="Categoría activa" />
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        title="Desactivar producto"
        message={`"${deleting?.name ?? ''}" dejará de aparecer en el punto de venta. Podrás reactivarlo editándolo nuevamente.`}
        confirmLabel="Desactivar"
        loading={deleteMutation.isPending}
      />

      <ConfirmDialog
        open={deletingCategory !== null}
        onClose={() => setDeletingCategory(null)}
        onConfirm={() => deletingCategory && deleteCategoryMutation.mutate(deletingCategory.id)}
        title="Desactivar categoría"
        message={`La categoría "${deletingCategory?.name ?? ''}" se ocultará del catálogo. Los productos asociados se mantienen.`}
        confirmLabel="Desactivar"
        loading={deleteCategoryMutation.isPending}
      />
    </div>
  )
}
