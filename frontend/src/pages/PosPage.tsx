import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  CreditCard,
  Landmark,
  Minus,
  Package,
  Plus,
  ScanLine,
  ShoppingBag,
  Smartphone,
  Trash2,
  UserRound,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Category, Customer, PageResult, Product, Sale, Variant } from '../lib/types'
import { money, numberFormat, paymentLabels } from '../lib/format'
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  PageLoader,
  ProductThumb,
  SearchInput,
  Select,
  Textarea,
  cn,
  useToast,
} from '../components/ui'

interface CartLine {
  key: string
  product: Product
  variant?: Variant
  quantity: number
  unitPrice: number
}

const paymentOptions: { id: string; label: string; icon: typeof Banknote }[] = [
  { id: 'Cash', label: 'Efectivo', icon: Banknote },
  { id: 'Card', label: 'Tarjeta', icon: CreditCard },
  { id: 'Transfer', label: 'Transferencia', icon: Landmark },
  { id: 'Nequi', label: 'Nequi', icon: Smartphone },
  { id: 'Daviplata', label: 'Daviplata', icon: Smartphone },
  { id: 'Credit', label: 'Crédito', icon: UserRound },
]

export function PosPage() {
  const { session } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const symbol = session?.tenant.currencySymbol ?? '$'
  const taxRate = session?.tenant.taxRate ?? 0
  const taxIncluded = session?.tenant.taxIncluded ?? false

  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [cart, setCart] = useState<CartLine[]>([])
  const [customerId, setCustomerId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [discount, setDiscount] = useState('')
  const [paidAmount, setPaidAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [variantProduct, setVariantProduct] = useState<Product | null>(null)
  const [lastSale, setLastSale] = useState<Sale | null>(null)

  const { data: products, isLoading } = useQuery({
    queryKey: ['pos-products', search, categoryId],
    queryFn: () =>
      api.get<PageResult<Product>>('/products', {
        search,
        categoryId: categoryId === 'all' ? undefined : categoryId,
        pageSize: 100,
      }),
  })

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/categories'),
  })

  const { data: customers } = useQuery({
    queryKey: ['pos-customers'],
    queryFn: () => api.get<PageResult<Customer>>('/customers', { pageSize: 100 }),
  })

  const items = products?.items ?? []

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)
    const globalDiscount = Math.min(Math.max(0, Number(discount) || 0), subtotal)
    const taxableBase = Math.max(0, subtotal - globalDiscount)
    const tax = taxIncluded
      ? taxRate > 0
        ? Math.round((taxableBase * taxRate) / (100 + taxRate) * 100) / 100
        : 0
      : Math.round(((taxableBase * taxRate) / 100) * 100) / 100
    const total = taxIncluded ? taxableBase : taxableBase + tax
    const paid = Number(paidAmount) || 0
    return { subtotal, subtotalWithTax: subtotal, discount: globalDiscount, tax, total, paid, change: Math.max(0, paid - total) }
  }, [cart, discount, taxRate, taxIncluded, paidAmount])

  const addLine = (product: Product, variant?: Variant) => {
    const available = variant ? variant.stock : product.stock
    if (product.trackStock && available <= 0) {
      toast('Este producto no tiene stock disponible.', 'error')
      return
    }
    const key = `${product.id}:${variant?.id ?? 'base'}`
    const price = variant?.price ?? product.price
    setCart((current) => {
      const existing = current.find((line) => line.key === key)
      if (existing) {
        if (product.trackStock && existing.quantity >= available) {
          toast(`Solo hay ${available} unidades disponibles.`, 'error')
          return current
        }
        return current.map((line) => (line.key === key ? { ...line, quantity: line.quantity + 1 } : line))
      }
      return [...current, { key, product, variant, quantity: 1, unitPrice: price }]
    })
    if (!cart.some((line) => line.key === key)) toast(`${product.name} agregado`, 'info')
  }

  const handleProduct = (product: Product) => {
    if (product.variants.length > 0) {
      setVariantProduct(product)
      return
    }
    addLine(product)
  }

  const changeQuantity = (key: string, delta: number) => {
    setCart((current) =>
      current.flatMap((line) => {
        if (line.key !== key) return [line]
        const variant = line.variant
        const available = variant ? variant.stock : line.product.stock
        const next = line.quantity + delta
        if (next <= 0) return []
        if (line.product.trackStock && next > available) {
          toast(`Solo hay ${available} unidades disponibles.`, 'error')
          return [line]
        }
        return [{ ...line, quantity: next }]
      }),
    )
  }

  const changePrice = (key: string, value: string) => {
    const price = Math.max(0, Number(value) || 0)
    setCart((current) => current.map((line) => (line.key === key ? { ...line, unitPrice: price } : line)))
  }

  const removeLine = (key: string) => setCart((current) => current.filter((line) => line.key !== key))

  const clearCart = () => {
    setCart([])
    setDiscount('')
    setPaidAmount('')
    setNotes('')
    setCustomerId('')
    setPaymentMethod('Cash')
  }

  const mutation = useMutation({
    mutationFn: () =>
      api.post<Sale>('/sales', {
        customerId: customerId || null,
        branchId: session?.branch?.id ?? null,
        items: cart.map((line) => ({
          productId: line.product.id,
          variantId: line.variant?.id ?? null,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discount: 0,
        })),
        discount: Number(discount) || 0,
        paymentMethod,
        paidAmount: paymentMethod === 'Credit' ? 0 : totals.paid > 0 ? totals.paid : totals.total,
        notes: notes || null,
        channel: 'POS',
      }),
    onSuccess: (sale) => {
      setLastSale(sale)
      setCartOpen(false)
      clearCart()
      void queryClient.invalidateQueries({ queryKey: ['pos-products'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['sales'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo registrar la venta.', 'error'),
  })

  const checkout = () => {
    if (cart.length === 0) {
      toast('Agrega al menos un producto.', 'error')
      return
    }
    mutation.mutate()
  }

  return (
    <div className="page">
      <PageHeader
        title="Punto de venta"
        subtitle="Agrega productos, cobra y gestiona el ticket en segundos."
        actions={
          <div className="flex items-center gap-2">
            <Badge tone="green">
              <span className="size-1.5 rounded-full bg-emerald-500" /> Caja abierta
            </Badge>
            <Badge tone="violet">{session?.branch?.name ?? 'Sede principal'}</Badge>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_390px]">
        <div className="min-w-0">
          <div className="card mb-3 p-3 sm:p-4">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre, SKU o código de barras…" className="flex-1" />
              <button
                type="button"
                onClick={() => toast('El lector de códigos se conecta con el campo de búsqueda.', 'info')}
                className="btn-secondary hidden shrink-0 sm:inline-flex"
              >
                <ScanLine className="size-4" /> Escanear
              </button>
            </div>
            <div className="hide-scrollbar -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1">
              <button
                onClick={() => setCategoryId('all')}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition-colors',
                  categoryId === 'all' ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-muted hover:border-brand-200',
                )}
              >
                Todos
              </button>
              {(categories ?? []).filter((category) => category.isActive).map((category) => (
                <button
                  key={category.id}
                  onClick={() => setCategoryId(category.id)}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition-colors',
                    categoryId === category.id ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-muted hover:border-brand-200',
                  )}
                >
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: category.color }} />
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <PageLoader label="Cargando catálogo…" />
          ) : items.length === 0 ? (
            <div className="card">
              <EmptyState
                title="No encontramos productos"
                description="Prueba con otra búsqueda o agrega productos a tu catálogo."
                icon={<Package className="size-5" />}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-3 2xl:grid-cols-4">
              {items.map((product) => {
                const stock = product.variants.length > 0 ? product.variants.reduce((sum, variant) => sum + variant.stock, 0) : product.stock
                const soldOut = product.trackStock && stock <= 0
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleProduct(product)}
                    disabled={soldOut}
                    className={cn(
                      'group flex flex-col overflow-hidden rounded-2xl border border-line bg-white p-2.5 text-left shadow-[var(--shadow-card)] transition-all',
                      soldOut ? 'cursor-not-allowed opacity-55' : 'hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_12px_32px_-16px_rgba(76,29,149,0.28)]',
                    )}
                  >
                    <div className="relative mb-2 w-full">
                      <ProductThumb src={product.imageUrl} name={product.name} size="lg" className="h-24 w-full sm:h-28" />
                      {product.type === 'Service' && (
                        <span className="absolute left-1.5 top-1.5 rounded-md bg-white/90 px-1.5 py-0.5 text-[8.5px] font-bold uppercase text-brand-700">Servicio</span>
                      )}
                      {product.trackStock && (
                        <span
                          className={cn(
                            'absolute right-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[8.5px] font-bold',
                            stock <= 0 ? 'bg-rose-600 text-white' : stock <= product.minStock ? 'bg-amber-500 text-white' : 'bg-white/90 text-ink',
                          )}
                        >
                          {stock <= 0 ? 'Agotado' : `${stock} uds`}
                        </span>
                      )}
                    </div>
                    <p className="line-clamp-2 min-h-[32px] text-[11.5px] font-semibold leading-tight text-ink">{product.name}</p>
                    <div className="mt-1.5 flex items-end justify-between gap-1">
                      <div>
                        <p className="font-display text-[13.5px] font-bold text-brand-700">{money(product.price, symbol)}</p>
                        {product.variants.length > 0 && <p className="text-[9px] text-muted">{product.variants.length} variantes</p>}
                      </div>
                      <span className="flex size-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                        <Plus className="size-4" />
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <aside className="hidden xl:block">
          <div className="sticky top-[88px]">
            <CartPanel
              cart={cart}
              symbol={symbol}
              customers={customers?.items ?? []}
              customerId={customerId}
              setCustomerId={setCustomerId}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              discount={discount}
              setDiscount={setDiscount}
              paidAmount={paidAmount}
              setPaidAmount={setPaidAmount}
              notes={notes}
              setNotes={setNotes}
              totals={totals}
              changeQuantity={changeQuantity}
              changePrice={changePrice}
              removeLine={removeLine}
              onCheckout={checkout}
              loading={mutation.isPending}
              onClear={clearCart}
            />
          </div>
        </aside>
      </div>

      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-[68px] z-30 px-4 xl:hidden">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="flex w-full items-center gap-3 rounded-2xl bg-brand-700 px-4 py-3 text-white shadow-[0_16px_34px_-12px_rgba(76,29,149,0.7)]"
          >
            <span className="relative flex size-9 items-center justify-center rounded-xl bg-white/15">
              <ShoppingBag className="size-4.5" />
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-white text-[9px] font-bold text-brand-700">{cart.length}</span>
            </span>
            <span className="flex-1 text-left">
              <span className="block text-[11px] text-white/70">Ver carrito</span>
              <span className="block text-[14px] font-bold">{money(totals.total, symbol)}</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[12px] font-semibold">
              Cobrar <ArrowRight className="size-4" />
            </span>
          </button>
        </div>
      )}

      <Modal
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        title="Carrito de venta"
        subtitle={`${cart.length} producto${cart.length === 1 ? '' : 's'} en el ticket`}
        size="lg"
        footer={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setCartOpen(false)}>Seguir vendiendo</Button>
            <Button className="flex-1" onClick={checkout} loading={mutation.isPending} disabled={cart.length === 0}>
              Cobrar {money(totals.total, symbol)}
            </Button>
          </div>
        }
      >
        <CartPanel
          cart={cart}
          symbol={symbol}
          customers={customers?.items ?? []}
          customerId={customerId}
          setCustomerId={setCustomerId}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          discount={discount}
          setDiscount={setDiscount}
          paidAmount={paidAmount}
          setPaidAmount={setPaidAmount}
          notes={notes}
          setNotes={setNotes}
          totals={totals}
          changeQuantity={changeQuantity}
          changePrice={changePrice}
          removeLine={removeLine}
          onCheckout={checkout}
          loading={mutation.isPending}
          onClear={clearCart}
          embedded
        />
      </Modal>

      <Modal
        open={variantProduct !== null}
        onClose={() => setVariantProduct(null)}
        title={variantProduct?.name ?? 'Variantes'}
        subtitle="Elige la presentación que vas a vender"
        size="sm"
      >
        <div className="space-y-2">
          {(variantProduct?.variants ?? []).map((variant) => {
            const price = variant.price ?? variantProduct?.price ?? 0
            const soldOut = variant.stock <= 0
            return (
              <button
                key={variant.id}
                type="button"
                disabled={soldOut}
                onClick={() => {
                  if (variantProduct) addLine(variantProduct, variant)
                  setVariantProduct(null)
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-xl border border-line p-3 text-left transition-colors',
                  soldOut ? 'opacity-50' : 'hover:border-brand-300 hover:bg-brand-50/60',
                )}
              >
                <div>
                  <p className="text-[13px] font-semibold text-ink">{variant.name}</p>
                  <p className="text-[11px] text-muted">{variant.sku ?? 'Sin SKU'} · {variant.stock} disponibles</p>
                </div>
                <span className="font-display text-[13px] font-bold text-brand-700">{money(price, symbol)}</span>
              </button>
            )
          })}
        </div>
      </Modal>

      <Modal
        open={lastSale !== null}
        onClose={() => setLastSale(null)}
        title="¡Venta registrada!"
        subtitle={lastSale ? `Ticket ${lastSale.number}` : undefined}
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setLastSale(null)}>Cerrar</Button>
            <Button className="flex-1" onClick={() => setLastSale(null)}>Nueva venta</Button>
          </div>
        }
      >
        {lastSale && (
          <div className="text-center">
            <span className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="size-7" />
            </span>
            <p className="text-[12px] text-muted">Total cobrado</p>
            <p className="font-display text-[30px] font-extrabold text-ink">{money(lastSale.total, symbol)}</p>
            <div className="mt-4 space-y-1.5 rounded-xl bg-canvas p-3 text-left text-[12px]">
              <div className="flex justify-between"><span className="text-muted">Cliente</span><span className="font-semibold text-ink">{lastSale.customerName ?? 'Cliente ocasional'}</span></div>
              <div className="flex justify-between"><span className="text-muted">Método</span><span className="font-semibold text-ink">{paymentLabels[lastSale.paymentMethod] ?? lastSale.paymentMethod}</span></div>
              <div className="flex justify-between"><span className="text-muted">Recibido</span><span className="font-semibold text-ink">{money(lastSale.paidAmount, symbol)}</span></div>
              <div className="flex justify-between border-t border-line pt-1.5"><span className="text-muted">Cambio</span><span className="font-bold text-emerald-600">{money(lastSale.change, symbol)}</span></div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function CartPanel({
  cart,
  symbol,
  customers,
  customerId,
  setCustomerId,
  paymentMethod,
  setPaymentMethod,
  discount,
  setDiscount,
  paidAmount,
  setPaidAmount,
  notes,
  setNotes,
  totals,
  changeQuantity,
  changePrice,
  removeLine,
  onCheckout,
  loading,
  onClear,
  embedded,
}: {
  cart: CartLine[]
  symbol: string
  customers: Customer[]
  customerId: string
  setCustomerId: (value: string) => void
  paymentMethod: string
  setPaymentMethod: (value: string) => void
  discount: string
  setDiscount: (value: string) => void
  paidAmount: string
  setPaidAmount: (value: string) => void
  notes: string
  setNotes: (value: string) => void
  totals: { subtotal: number; subtotalWithTax: number; discount: number; tax: number; total: number; paid: number; change: number }
  changeQuantity: (key: string, delta: number) => void
  changePrice: (key: string, value: string) => void
  removeLine: (key: string) => void
  onCheckout: () => void
  loading: boolean
  onClear: () => void
  embedded?: boolean
}) {
  const body = (
    <div className="space-y-4">
      {!embedded && (
        <div className="flex items-center justify-between">
          <h2 className="section-title">Ticket actual</h2>
          {cart.length > 0 && (
            <button onClick={onClear} className="text-[11px] font-semibold text-rose-500 hover:underline">Vaciar</button>
          )}
        </div>
      )}

      <Field label="Cliente">
        <Select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
          <option value="">Cliente ocasional</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ''}</option>
          ))}
        </Select>
      </Field>

      <div className="max-h-[32vh] space-y-2 overflow-y-auto scroll-thin xl:max-h-[26vh]">
        {cart.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center">
            <ShoppingBag className="mx-auto mb-2 size-6 text-brand-300" />
            <p className="text-[12px] font-semibold text-ink">Tu carrito está vacío</p>
            <p className="mt-0.5 text-[11px] text-muted">Toca un producto para agregarlo.</p>
          </div>
        ) : (
          cart.map((line) => (
            <div key={line.key} className="rounded-xl border border-line/80 p-2.5">
              <div className="flex items-start gap-2">
                <ProductThumb src={line.product.imageUrl} name={line.product.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11.5px] font-semibold text-ink">{line.product.name}</p>
                  <p className="truncate text-[10px] text-muted">{line.variant?.name ?? line.product.sku}</p>
                </div>
                <button onClick={() => removeLine(line.key)} className="rounded p-1 text-muted hover:bg-rose-50 hover:text-rose-500" aria-label="Quitar">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex items-center rounded-lg border border-line">
                  <button onClick={() => changeQuantity(line.key, -1)} className="p-1.5 text-muted hover:text-brand-700"><Minus className="size-3" /></button>
                  <span className="min-w-[22px] text-center text-[11px] font-bold">{line.quantity}</span>
                  <button onClick={() => changeQuantity(line.key, 1)} className="p-1.5 text-muted hover:text-brand-700"><Plus className="size-3" /></button>
                </div>
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted">{symbol}</span>
                  <input
                    className="input px-2 py-1 pl-5 text-right text-[11.5px]"
                    inputMode="decimal"
                    value={line.unitPrice}
                    onChange={(event) => changePrice(line.key, event.target.value)}
                  />
                </div>
                <span className="min-w-[64px] text-right text-[11.5px] font-bold text-ink">{money(line.unitPrice * line.quantity, symbol)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div>
        <p className="label">Método de pago</p>
        <div className="grid grid-cols-3 gap-1.5">
          {paymentOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setPaymentMethod(option.id)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[10px] font-semibold transition-colors',
                paymentMethod === option.id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-white text-muted hover:border-brand-200',
              )}
            >
              <option.icon className="size-4" />
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Descuento">
          <Input inputMode="decimal" placeholder="0" value={discount} onChange={(event) => setDiscount(event.target.value)} />
        </Field>
        <Field label="Recibido">
          <Input
            inputMode="decimal"
            placeholder={paymentMethod === 'Credit' ? 'Crédito' : totals.total.toFixed(2)}
            value={paidAmount}
            disabled={paymentMethod === 'Credit'}
            onChange={(event) => setPaidAmount(event.target.value)}
          />
        </Field>
      </div>

      <Field label="Nota (opcional)">
        <Textarea rows={2} className="min-h-[58px]" placeholder="Observaciones del pedido…" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>

      <div className="space-y-1.5 rounded-xl bg-canvas p-3 text-[12px]">
        <div className="flex justify-between"><span className="text-muted">Subtotal</span><span className="font-semibold text-ink">{money(totals.subtotal, symbol)}</span></div>
        {totals.discount > 0 && (
          <div className="flex justify-between"><span className="text-muted">Descuento</span><span className="font-semibold text-rose-500">-{money(totals.discount, symbol)}</span></div>
        )}
        <div className="flex justify-between"><span className="text-muted">Impuesto</span><span className="font-semibold text-ink">{money(totals.tax, symbol)}</span></div>
        <div className="flex items-center justify-between border-t border-line pt-2">
          <span className="font-semibold text-ink">Total</span>
          <span className="font-display text-[20px] font-extrabold text-brand-700">{money(totals.total, symbol)}</span>
        </div>
        {paymentMethod !== 'Credit' && totals.paid > 0 && (
          <div className="flex justify-between"><span className="text-muted">Cambio</span><span className="font-bold text-emerald-600">{money(totals.change, symbol)}</span></div>
        )}
      </div>

      <Button className="w-full" size="md" onClick={onCheckout} loading={loading} disabled={cart.length === 0}>
        <ShoppingBag className="size-4" /> Cobrar {money(totals.total, symbol)}
      </Button>
      <p className="text-center text-[10px] text-muted">{cart.reduce((sum, line) => sum + line.quantity, 0)} unidades · {numberFormat(cart.length)} líneas</p>
    </div>
  )

  if (embedded) return body
  return <div className="card p-4">{body}</div>
}
