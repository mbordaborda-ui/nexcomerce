import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  CheckCircle2,
  CreditCard,
  Crown,
  Landmark,
  Lock,
  QrCode,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
  Zap,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { BillingCheckoutResult, BillingOverview, BillingPlan } from '../lib/types'
import { dateLong, money, numberFormat } from '../lib/format'
import {
  Badge,
  Button,
  Field,
  Input,
  Modal,
  PageHeader,
  PageLoader,
  ProgressBar,
  Tabs,
  cn,
  useToast,
} from '../components/ui'

const addonIcons: Record<string, typeof TrendingUp> = {
  chart: TrendingUp,
  whatsapp: Zap,
  users: Users,
  store: Store,
  sparkles: Sparkles,
}

type PaymentMethodTab = 'Card' | 'Transfer' | 'Qr'

export function BillingPage() {
  const { session, refresh } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const symbol = session?.tenant.currencySymbol ?? '$'

  const [cycle, setCycle] = useState<'Monthly' | 'Annual'>('Monthly')
  const [selectedAddons, setSelectedAddons] = useState<string[]>([])
  const [appliedCoupon, setAppliedCoupon] = useState('')

  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutPlanId, setCheckoutPlanId] = useState('Growth')
  const [checkoutCycle, setCheckoutCycle] = useState<'Monthly' | 'Annual'>('Monthly')
  const [checkoutAddons, setCheckoutAddons] = useState<string[]>([])
  const [checkoutCoupon, setCheckoutCoupon] = useState('')
  const [step, setStep] = useState<'review' | 'payment' | 'success'>('review')
  const [paymentTab, setPaymentTab] = useState<PaymentMethodTab>('Card')
  const [card, setCard] = useState({ number: '', holder: '', expiry: '', cvc: '' })
  const [transferReference, setTransferReference] = useState('')
  const [qrReference, setQrReference] = useState('')
  const [result, setResult] = useState<BillingCheckoutResult | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['billing'],
    queryFn: () => api.get<BillingOverview>('/billing/overview'),
  })

  const sub = data?.subscription
  const plans = data?.plans ?? []
  const addons = data?.addons ?? []
  const invoices = data?.invoices ?? []

  const currentPlan = plans.find((plan) => plan.id === sub?.plan)
  const checkoutPlan = plans.find((plan) => plan.id === checkoutPlanId)

  const checkoutTotals = useMemo(() => {
    if (!checkoutPlan) return { subtotal: 0, addons: 0, discount: 0, total: 0 }
    const subtotal = checkoutCycle === 'Annual' ? checkoutPlan.annualPrice : checkoutPlan.monthlyPrice
    const addonsTotal = checkoutAddons.reduce((sum, id) => {
      const addon = addons.find((item) => item.id === id)
      return sum + (addon?.price ?? 0)
    }, 0) * (checkoutCycle === 'Annual' ? 10 : 1)
    const gross = subtotal + addonsTotal
    const discount = checkoutCoupon.trim().toUpperCase() === 'BIENVENIDA' ? Math.round(gross * 0.1 * 100) / 100 : 0
    return { subtotal, addons: addonsTotal, discount, total: Math.max(0, gross - discount) }
  }, [checkoutPlan, checkoutCycle, checkoutAddons, addons, checkoutCoupon])

  useEffect(() => {
    if (!data) return
    setCycle(data.subscription.cycle === 'Annual' ? 'Annual' : 'Monthly')
    setSelectedAddons(data.subscription.addons ?? [])
  }, [data])

  const openCheckout = (plan: BillingPlan, options?: { cycle?: 'Monthly' | 'Annual'; addons?: string[]; coupon?: string }) => {
    setCheckoutPlanId(plan.id)
    setCheckoutCycle(options?.cycle ?? (cycle === 'Annual' ? 'Annual' : 'Monthly'))
    setCheckoutAddons(options?.addons ?? (plan.id === 'Starter' ? [] : selectedAddons))
    setCheckoutCoupon(options?.coupon ?? appliedCoupon)
    setStep('review')
    setResult(null)
    setPaymentTab('Card')
    setCard({ number: '', holder: '', expiry: '', cvc: '' })
    setTransferReference('')
    setQrReference('')
    setCheckoutOpen(true)
  }

  const checkout = useMutation({
    mutationFn: () =>
      api.post<BillingCheckoutResult>('/billing/checkout', {
        plan: checkoutPlanId,
        cycle: checkoutCycle,
        addons: checkoutAddons,
        couponCode: checkoutCoupon || null,
        channel: checkoutTotals.total === 0 ? 'Card' : paymentTab,
        cardNumber: card.number || null,
        cardHolder: card.holder || null,
        cardExpiry: card.expiry || null,
        cardCvc: card.cvc || null,
        transferReference: transferReference || null,
        qrReference: qrReference || null,
      }),
    onSuccess: async (response) => {
      setResult(response)
      if (response.success) {
        setStep('success')
        toast('Suscripción actualizada correctamente.')
        await refresh()
        void queryClient.invalidateQueries({ queryKey: ['billing'] })
        void queryClient.invalidateQueries({ queryKey: ['me'] })
        void queryClient.invalidateQueries({ queryKey: ['plans'] })
        void queryClient.invalidateQueries({ queryKey: ['tenant'] })
      } else {
        toast(response.message, 'error')
      }
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo procesar el pago.', 'error'),
  })

  const cancelMutation = useMutation({
    mutationFn: () => api.post('/billing/cancel'),
    onSuccess: () => {
      toast('Tu suscripción no se renovará al final del periodo.', 'info')
      void queryClient.invalidateQueries({ queryKey: ['billing'] })
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo cancelar la renovación.', 'error'),
  })

  const resumeMutation = useMutation({
    mutationFn: () => api.post('/billing/resume'),
    onSuccess: () => {
      toast('Renovación automática reactivada.')
      void queryClient.invalidateQueries({ queryKey: ['billing'] })
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo reactivar la renovación.', 'error'),
  })

  const toggleAddon = (id: string) => {
    setSelectedAddons((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  const toggleCheckoutAddon = (id: string) => {
    setCheckoutAddons((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  if (isLoading || !data || !sub) return <PageLoader label="Cargando tu suscripción…" />

  const planUsage = currentPlan ?? plans[0]
  const activeAddons = addons.filter((addon) => selectedAddons.includes(addon.id))
  const addonPreview = activeAddons.reduce((sum, addon) => sum + addon.price, 0)

  const paymentValid =
    checkoutTotals.total === 0 ||
    (paymentTab === 'Card'
      ? card.number.replace(/\D/g, '').length >= 15 && card.holder.trim().length > 2 && card.expiry.length >= 4 && card.cvc.length >= 3
      : paymentTab === 'Transfer'
        ? transferReference.trim().length >= 4
        : qrReference.trim().length >= 4)

  return (
    <div className="page">
      <PageHeader
        title="Suscripción"
        subtitle="Elige cómo crece tu negocio. Puedes cambiar de plan, contratar módulos y renovar cuando quieras."
        actions={
          <Badge tone="amber" className="w-fit">
            <Sparkles className="size-3" /> Modo demo · sin cobros reales
          </Badge>
        }
      />

      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <ShieldCheck className="size-4" />
        </span>
        <div>
          <p className="text-[12px] font-bold text-amber-900">Estás viendo el flujo de pago en modo demostración</p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-amber-800/80">
            El checkout simula la aprobación del banco y emite una factura de prueba. Cuando conectemos la pasarela real, la
            experiencia será la misma sin guardar datos sensibles de tarjeta.
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="card overflow-hidden">
          <div className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-5 text-white sm:p-6">
            <div className="absolute -right-10 -top-16 size-56 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/60">Plan actual</p>
                <div className="mt-1 flex items-center gap-2">
                  <h2 className="font-display text-[28px] font-extrabold leading-none">{sub.plan}</h2>
                  {sub.isTrial ? <Badge className="!bg-white/15 !text-white">Prueba</Badge> : <Badge tone="green" className="!bg-emerald-400/15 !text-emerald-100"><BadgeCheck className="size-3" /> Activa</Badge>}
                </div>
                <p className="mt-2 max-w-md text-[12px] leading-relaxed text-white/75">
                  {planUsage?.tagline ?? 'Todo tu negocio en un solo lugar.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {currentPlan && currentPlan.id !== 'Starter' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="!border-white/20 !bg-white/10 !text-white hover:!bg-white/20"
                    onClick={() => openCheckout(currentPlan, { cycle: sub.cycle === 'Annual' ? 'Annual' : 'Monthly', addons: sub.addons, coupon: appliedCoupon })}
                  >
                    <CreditCard className="size-3.5" /> Renovar
                  </Button>
                )}
                <Button
                  size="sm"
                  className="!bg-white !text-brand-800 hover:!bg-brand-50"
                  onClick={() => {
                    const target = plans.find((plan) => plan.id !== sub.plan && plan.recommended) ?? plans.find((plan) => plan.id !== sub.plan) ?? plans[0]
                    openCheckout(target)
                  }}
                >
                  Cambiar plan <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </div>

            <div className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-white/10 px-3 py-2.5">
                <p className="text-[10px] text-white/60">Facturación</p>
                <p className="mt-0.5 text-[13px] font-bold">{sub.cycle === 'Annual' ? 'Anual' : 'Mensual'}</p>
              </div>
              <div className="rounded-xl bg-white/10 px-3 py-2.5">
                <p className="text-[10px] text-white/60">Valor</p>
                <p className="mt-0.5 text-[13px] font-bold">{money(sub.total, symbol)}</p>
              </div>
              <div className="rounded-xl bg-white/10 px-3 py-2.5">
                <p className="text-[10px] text-white/60">Vence</p>
                <p className="mt-0.5 text-[13px] font-bold">{sub.daysLeft} días</p>
              </div>
              <div className="rounded-xl bg-white/10 px-3 py-2.5">
                <p className="text-[10px] text-white/60">Método</p>
                <p className="mt-0.5 truncate text-[13px] font-bold">{sub.paymentMethod ?? 'Sin método'}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
            <div>
              <div className="mb-1 flex items-center justify-between text-[11.5px]">
                <span className="flex items-center gap-1 text-muted"><Users className="size-3.5" /> Usuarios</span>
                <span className="font-semibold text-ink">{data.usage.users} / {planUsage?.userLimit ?? '—'}</span>
              </div>
              <ProgressBar value={planUsage?.userLimit ? (data.usage.users / planUsage.userLimit) * 100 : 0} />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-[11.5px]">
                <span className="flex items-center gap-1 text-muted"><Building2 className="size-3.5" /> Sedes</span>
                <span className="font-semibold text-ink">{data.usage.branches} / {planUsage?.branchLimit ?? '—'}</span>
              </div>
              <ProgressBar value={planUsage?.branchLimit ? (data.usage.branches / planUsage.branchLimit) * 100 : 0} tone="green" />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-[11.5px]">
                <span className="flex items-center gap-1 text-muted"><Store className="size-3.5" /> Productos</span>
                <span className="font-semibold text-ink">{numberFormat(data.usage.products)} / {numberFormat(planUsage?.productLimit ?? 0)}</span>
              </div>
              <ProgressBar value={planUsage?.productLimit ? (data.usage.products / planUsage.productLimit) * 100 : 0} tone="amber" />
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-line bg-canvas/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-[11px] text-muted">
              {sub.cancelAtPeriodEnd
                ? `Se cancelará el ${dateLong(sub.currentPeriodEnd)}. Puedes reactivarla cuando quieras.`
                : `Se renueva automáticamente el ${dateLong(sub.currentPeriodEnd)}.`}
            </p>
            {sub.cancelAtPeriodEnd ? (
              <Button size="sm" variant="secondary" onClick={() => resumeMutation.mutate()} loading={resumeMutation.isPending}>
                Reactivar renovación
              </Button>
            ) : (
              <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => cancelMutation.mutate()} loading={cancelMutation.isPending}>
                Cancelar renovación
              </Button>
            )}
          </div>
        </section>

        <section className="card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="section-title">Módulos adicionales</h2>
              <p className="mt-0.5 text-[11px] text-muted">Potencia tu plan con lo que realmente usas.</p>
            </div>
            <Badge tone="violet">{activeAddons.length} activos</Badge>
          </div>
          <div className="mt-3 space-y-2">
            {addons.map((addon) => {
              const Icon = addonIcons[addon.icon] ?? Sparkles
              const active = selectedAddons.includes(addon.id)
              return (
                <button
                  key={addon.id}
                  type="button"
                  onClick={() => toggleAddon(addon.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors',
                    active ? 'border-brand-300 bg-brand-50/70' : 'border-line bg-white hover:border-brand-200 hover:bg-brand-50/40',
                  )}
                >
                  <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', active ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600')}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-semibold text-ink">{addon.name}</span>
                    <span className="block text-[10.5px] leading-snug text-muted">{addon.description}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-[12px] font-bold text-ink">{money(addon.price, symbol)}</span>
                    <span className="block text-[9.5px] text-muted">/ mes</span>
                  </span>
                  <span className={cn('flex size-5 items-center justify-center rounded-full border', active ? 'border-brand-600 bg-brand-600 text-white' : 'border-line text-transparent')}>
                    <Check className="size-3" />
                  </span>
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-canvas px-3 py-2.5">
            <div>
              <p className="text-[10.5px] text-muted">Total módulos</p>
              <p className="text-[13px] font-bold text-ink">{money(addonPreview, symbol)} / mes</p>
            </div>
            <Button
              size="sm"
              disabled={selectedAddons.length === 0 && (sub.addons ?? []).length === 0}
              onClick={() =>
                openCheckout(
                  plans.find((plan) => plan.id === sub.plan) ?? plans[0],
                  { cycle: sub.cycle === 'Annual' ? 'Annual' : 'Monthly', addons: selectedAddons, coupon: appliedCoupon },
                )
              }
            >
              Guardar módulos
            </Button>
          </div>
        </section>
      </div>

      <section className="mt-5">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="page-title text-[19px] sm:text-[21px]">Planes</h2>
            <p className="page-subtitle">Cambia cuando quieras. El cobro se prorratea en la versión real.</p>
          </div>
          <div className="inline-flex rounded-xl bg-white p-1 shadow-[var(--shadow-card)] ring-1 ring-line">
            {(['Monthly', 'Annual'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setCycle(option)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-[11.5px] font-semibold transition-colors',
                  cycle === option ? 'bg-brand-600 text-white' : 'text-muted hover:text-brand-700',
                )}
              >
                {option === 'Monthly' ? 'Mensual' : 'Anual · 2 meses gratis'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = plan.id === sub.plan
            return (
              <article
                key={plan.id}
                className={cn(
                  'card relative flex flex-col p-5 transition-all',
                  plan.recommended && 'border-brand-300 shadow-[0_18px_40px_-24px_rgba(124,58,237,0.45)]',
                  isCurrent && 'ring-2 ring-brand-200',
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      {plan.id === 'Business' ? <Crown className="size-4 text-amber-500" /> : plan.id === 'Growth' ? <Sparkles className="size-4 text-brand-500" /> : <Wallet className="size-4 text-muted" />}
                      <h3 className="font-display text-[17px] font-bold text-ink">{plan.name}</h3>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-muted">{plan.tagline}</p>
                  </div>
                  {plan.recommended && <Badge tone="violet" className="shrink-0">Recomendado</Badge>}
                  {isCurrent && <Badge tone="green" className="shrink-0">Actual</Badge>}
                </div>

                <div className="mt-4 flex items-end gap-1">
                  <p className="font-display text-[30px] font-extrabold leading-none text-ink">
                    {plan.monthlyPrice === 0 ? 'Gratis' : money(cycle === 'Annual' ? plan.annualPrice : plan.monthlyPrice, symbol)}
                  </p>
                  {plan.monthlyPrice > 0 && <p className="pb-1 text-[11px] text-muted">/{cycle === 'Annual' ? 'año' : 'mes'}</p>}
                </div>
                {cycle === 'Annual' && plan.monthlyPrice > 0 && (
                  <p className="mt-1 text-[10.5px] font-medium text-emerald-600">Ahorras {money(plan.monthlyPrice * 12 - plan.annualPrice, symbol)} al año</p>
                )}

                <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-muted">
                  <span className="rounded-full bg-canvas px-2 py-1">{plan.userLimit} usuarios</span>
                  <span className="rounded-full bg-canvas px-2 py-1">{plan.branchLimit} sedes</span>
                  <span className="rounded-full bg-canvas px-2 py-1">{numberFormat(plan.productLimit)} productos</span>
                </div>

                <ul className="mt-4 flex-1 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-[11.5px] text-muted">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" /> {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  variant={isCurrent ? 'secondary' : plan.recommended ? 'primary' : 'soft'}
                  className="mt-4 w-full"
                  onClick={() => openCheckout(plan, { cycle, addons: selectedAddons, coupon: appliedCoupon })}
                >
                  {isCurrent ? 'Renovar o ajustar' : plan.monthlyPrice === 0 ? 'Usar Starter' : `Elegir ${plan.name}`}
                  {!isCurrent && <ArrowRight className="size-3.5" />}
                </Button>
              </article>
            )
          })}
        </div>
      </section>

      <section className="card mt-5 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 sm:px-5 sm:pt-5">
          <div>
            <h2 className="section-title">Facturas</h2>
            <p className="mt-0.5 text-[11px] text-muted">Historial de pagos y comprobantes de la suscripción.</p>
          </div>
          <Badge tone="gray"><ReceiptText className="size-3" /> {invoices.length}</Badge>
        </div>
        {invoices.length === 0 ? (
          <p className="px-5 py-8 text-center text-[12px] text-muted">Aún no hay facturas. Elige un plan para generar la primera.</p>
        ) : (
          <div className="mt-3 divide-y divide-line">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', invoice.status === 'Paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500')}>
                  {invoice.status === 'Paid' ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-ink">{invoice.number} · {invoice.plan}</p>
                  <p className="truncate text-[10.5px] text-muted">{dateLong(invoice.issuedAt)} · {invoice.paymentMethod ?? 'Sin método'}{invoice.couponCode ? ` · cupón ${invoice.couponCode}` : ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-[12.5px] font-bold text-ink">{money(invoice.total, symbol)}</p>
                  <Badge tone={invoice.status === 'Paid' ? 'green' : 'rose'} className="mt-0.5 !px-1.5 !py-0.5 !text-[9.5px]">
                    {invoice.status === 'Paid' ? 'Pagada' : 'Fallida'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        title={step === 'success' ? '¡Listo!' : step === 'payment' ? 'Método de pago' : 'Confirmar suscripción'}
        subtitle={step === 'success' ? 'Tu plan quedó actualizado en modo demo.' : 'Checkout seguro · simulación de pasarela'}
        size="md"
        footer={
          step === 'success' ? (
            <div className="flex justify-end">
              <Button onClick={() => setCheckoutOpen(false)}>Volver a mi suscripción</Button>
            </div>
          ) : step === 'review' ? (
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10.5px] text-muted">Total a pagar</p>
                <p className="font-display text-[18px] font-extrabold text-ink">{money(checkoutTotals.total, symbol)}</p>
              </div>
              <Button
                onClick={() => {
                  if (checkoutTotals.total === 0) checkout.mutate()
                  else setStep('payment')
                }}
                loading={checkout.isPending}
              >
                {checkoutTotals.total === 0 ? 'Activar plan gratis' : 'Continuar al pago'} <ArrowRight className="size-4" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row-reverse sm:items-center sm:justify-between">
              <Button onClick={() => checkout.mutate()} loading={checkout.isPending} disabled={!paymentValid} className="w-full sm:w-auto">
                <Lock className="size-4" /> Pagar {money(checkoutTotals.total, symbol)}
              </Button>
              <Button variant="ghost" onClick={() => setStep('review')} className="w-full sm:w-auto">Volver al resumen</Button>
            </div>
          )
        }
      >
        {step === 'review' && checkoutPlan && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-brand-100 bg-brand-50/50 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-700">Plan seleccionado</p>
                  <p className="mt-1 font-display text-[20px] font-extrabold text-ink">{checkoutPlan.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted">{checkoutPlan.tagline}</p>
                </div>
                <Badge tone="violet">{checkoutCycle === 'Annual' ? 'Anual' : 'Mensual'}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-white px-2 py-2">
                  <p className="text-[15px] font-bold text-ink">{checkoutPlan.userLimit}</p>
                  <p className="text-[9.5px] text-muted">usuarios</p>
                </div>
                <div className="rounded-xl bg-white px-2 py-2">
                  <p className="text-[15px] font-bold text-ink">{checkoutPlan.branchLimit}</p>
                  <p className="text-[9.5px] text-muted">sedes</p>
                </div>
                <div className="rounded-xl bg-white px-2 py-2">
                  <p className="text-[15px] font-bold text-ink">{numberFormat(checkoutPlan.productLimit)}</p>
                  <p className="text-[9.5px] text-muted">productos</p>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[12px] font-bold text-ink">Módulos adicionales</p>
                <span className="text-[10.5px] text-muted">Opcional</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {addons.map((addon) => {
                  const active = checkoutAddons.includes(addon.id)
                  const Icon = addonIcons[addon.icon] ?? Sparkles
                  return (
                    <button
                      key={addon.id}
                      type="button"
                      onClick={() => toggleCheckoutAddon(addon.id)}
                      className={cn(
                        'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors',
                        active ? 'border-brand-300 bg-brand-50/70' : 'border-line hover:border-brand-200',
                      )}
                    >
                      <Icon className={cn('size-4 shrink-0', active ? 'text-brand-600' : 'text-muted')} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-semibold text-ink">{addon.name}</span>
                        <span className="block text-[9.5px] text-muted">{money(addon.price, symbol)}/mes</span>
                      </span>
                      <span className={cn('flex size-4 items-center justify-center rounded-full border', active ? 'border-brand-600 bg-brand-600 text-white' : 'border-line text-transparent')}>
                        <Check className="size-2.5" />
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <Input
                value={checkoutCoupon}
                onChange={(event) => setCheckoutCoupon(event.target.value.toUpperCase())}
                placeholder="Cupón (prueba BIENVENIDA)"
                className="flex-1"
              />
              <Button variant="secondary" onClick={() => setAppliedCoupon(checkoutCoupon)}>Aplicar</Button>
            </div>

            <div className="rounded-xl bg-canvas p-3.5 text-[11.5px]">
              <div className="flex justify-between py-0.5"><span className="text-muted">Plan {checkoutPlan.name}</span><span className="font-semibold text-ink">{money(checkoutTotals.subtotal, symbol)}</span></div>
              <div className="flex justify-between py-0.5"><span className="text-muted">Módulos</span><span className="font-semibold text-ink">{money(checkoutTotals.addons, symbol)}</span></div>
              {checkoutTotals.discount > 0 && <div className="flex justify-between py-0.5 text-emerald-600"><span>Descuento BIENVENIDA</span><span className="font-semibold">− {money(checkoutTotals.discount, symbol)}</span></div>}
              <div className="mt-1.5 flex justify-between border-t border-line pt-1.5"><span className="font-bold text-ink">Total</span><span className="font-display text-[15px] font-extrabold text-ink">{money(checkoutTotals.total, symbol)}</span></div>
              <p className="mt-1 text-[10px] text-muted">{checkoutCycle === 'Annual' ? 'Cobro anual' : 'Cobro mensual'} · impuestos incluidos · demo</p>
            </div>
          </div>
        )}

        {step === 'payment' && (
          <div className="space-y-4">
            <Tabs
              value={paymentTab}
              onChange={setPaymentTab}
              tabs={[
                { id: 'Card', label: 'Tarjeta', icon: <CreditCard className="size-3.5" /> },
                { id: 'Transfer', label: 'Transferencia', icon: <Landmark className="size-3.5" /> },
                { id: 'Qr', label: 'QR', icon: <QrCode className="size-3.5" /> },
              ]}
            />

            {paymentTab === 'Card' && (
              <div className="space-y-3">
                <div className="rounded-2xl bg-gradient-to-br from-ink to-brand-900 p-4 text-white">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">NexComerce Pay · demo</span>
                    <CreditCard className="size-5 text-white/70" />
                  </div>
                  <p className="mt-5 font-mono text-[17px] tracking-[0.14em]">{card.number || '•••• •••• •••• ••••'}</p>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <p className="text-[8.5px] uppercase tracking-wide text-white/40">Titular</p>
                      <p className="text-[11px] font-semibold">{card.holder || 'NOMBRE DEL TITULAR'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8.5px] uppercase tracking-wide text-white/40">Vence</p>
                      <p className="text-[11px] font-semibold">{card.expiry || 'MM/AA'}</p>
                    </div>
                  </div>
                </div>
                <Field label="Número de tarjeta" required hint="Demo: 4242 4242 4242 4242 · rechazo: 4000 0000 0000 0002">
                  <Input
                    inputMode="numeric"
                    autoComplete="cc-number"
                    value={card.number}
                    onChange={(event) => {
                      const digits = event.target.value.replace(/\D/g, '').slice(0, 16)
                      setCard((current) => ({ ...current, number: digits.replace(/(.{4})/g, '$1 ').trim() }))
                    }}
                    placeholder="4242 4242 4242 4242"
                  />
                </Field>
                <Field label="Nombre del titular" required>
                  <Input autoComplete="cc-name" value={card.holder} onChange={(event) => setCard((current) => ({ ...current, holder: event.target.value }))} placeholder="Como aparece en la tarjeta" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Vencimiento" required>
                    <Input
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      value={card.expiry}
                      onChange={(event) => {
                        const digits = event.target.value.replace(/\D/g, '').slice(0, 4)
                        setCard((current) => ({ ...current, expiry: digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits }))
                      }}
                      placeholder="MM/AA"
                    />
                  </Field>
                  <Field label="CVC" required>
                    <Input
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      value={card.cvc}
                      onChange={(event) => setCard((current) => ({ ...current, cvc: event.target.value.replace(/\D/g, '').slice(0, 4) }))}
                      placeholder="123"
                    />
                  </Field>
                </div>
                <p className="flex items-start gap-1.5 rounded-xl bg-canvas px-3 py-2 text-[10.5px] leading-snug text-muted">
                  <Lock className="mt-0.5 size-3 shrink-0 text-emerald-600" />
                  Esta demo no guarda el número completo ni el CVC. Solo se conservan marca y últimos 4 dígitos.
                </p>
              </div>
            )}

            {paymentTab === 'Transfer' && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-line bg-canvas p-4 text-[11.5px]">
                  <p className="font-bold text-ink">Datos para transferencia (demo)</p>
                  <div className="mt-2 space-y-1 text-muted">
                    <p>Banco: <span className="font-semibold text-ink">Banco Demo</span></p>
                    <p>Cuenta: <span className="font-mono font-semibold text-ink">000-123456-78</span></p>
                    <p>Titular: <span className="font-semibold text-ink">NexComerce SAS</span></p>
                    <p>Monto: <span className="font-semibold text-ink">{money(checkoutTotals.total, symbol)}</span></p>
                  </div>
                </div>
                <Field label="Número de comprobante" required hint="Escribe cualquier referencia de 4 o más caracteres para simular la validación.">
                  <Input value={transferReference} onChange={(event) => setTransferReference(event.target.value)} placeholder="TRX-2026-0001" />
                </Field>
                <p className="text-[10.5px] text-muted">En producción validaríamos el comprobante con el banco o un webhook antes de activar el plan.</p>
              </div>
            )}

            {paymentTab === 'Qr' && (
              <div className="space-y-3">
                <div className="flex flex-col items-center rounded-2xl border border-line bg-white p-5">
                  <div className="grid size-40 grid-cols-7 gap-1 rounded-xl bg-ink p-3">
                    {Array.from({ length: 49 }).map((_, index) => {
                      const filled = (index * 7 + Math.floor(index / 7) * 3) % 5 !== 0
                      return <span key={index} className={cn('rounded-[2px]', filled ? 'bg-white' : 'bg-ink')} />
                    })}
                  </div>
                  <p className="mt-3 text-[12px] font-bold text-ink">{money(checkoutTotals.total, symbol)}</p>
                  <p className="text-[10.5px] text-muted">Escanea con tu app bancaria (QR de demostración)</p>
                </div>
                <Field label="Referencia del pago" required hint="Simula la confirmación del banco con cualquier código.">
                  <Input value={qrReference} onChange={(event) => setQrReference(event.target.value)} placeholder="QR-889201" />
                </Field>
              </div>
            )}
          </div>
        )}

        {step === 'success' && result?.invoice && (
          <div className="flex flex-col items-center py-4 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="size-8" />
            </span>
            <h3 className="mt-3 font-display text-[20px] font-extrabold text-ink">Pago aprobado</h3>
            <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-muted">{result.message}</p>
            <div className="mt-4 w-full rounded-2xl border border-line bg-canvas p-4 text-left text-[11.5px]">
              <div className="flex justify-between py-0.5"><span className="text-muted">Factura</span><span className="font-mono font-semibold text-ink">{result.invoice.number}</span></div>
              <div className="flex justify-between py-0.5"><span className="text-muted">Plan</span><span className="font-semibold text-ink">{result.invoice.plan} · {result.invoice.cycle === 'Annual' ? 'anual' : 'mensual'}</span></div>
              <div className="flex justify-between py-0.5"><span className="text-muted">Método</span><span className="font-semibold text-ink">{result.invoice.paymentMethod}</span></div>
              <div className="flex justify-between py-0.5"><span className="text-muted">Referencia</span><span className="font-mono text-[10.5px] text-ink">{result.invoice.reference}</span></div>
              <div className="mt-1.5 flex justify-between border-t border-line pt-1.5"><span className="font-bold text-ink">Total pagado</span><span className="font-display text-[15px] font-extrabold text-ink">{money(result.invoice.total, symbol)}</span></div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-[10.5px] font-semibold text-amber-800">
              <ShieldCheck className="size-3.5" /> Simulación: no se realizó ningún cargo real
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
