import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BadgeCheck,
  Building2,
  Check,
  Crown,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Palette,
  Save,
  ShieldCheck,
  Sparkles,
  Store,
  UserRound,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth, usePermissions } from '../lib/auth'
import { permissionCatalog } from '../lib/access'
import type { MeResponse, Tenant, User } from '../lib/types'
import { businessTypeLabels, money, numberFormat, planLabels, roleLabel } from '../lib/format'
import {
  Avatar,
  Badge,
  Button,
  Field,
  Input,
  PageHeader,
  PageLoader,
  ProgressBar,
  Select,
  Tabs,
  Textarea,
  Toggle,
  cn,
  useToast,
} from '../components/ui'

interface PlanOption {
  id: string
  name: string
  price: number
  users: number
  branches: number
  products: number
  features: string[]
}

type BusinessForm = {
  name: string
  phone: string
  address: string
  city: string
  country: string
  currency: string
  currencySymbol: string
  businessType: string
  logoUrl: string
  description: string
  taxName: string
  taxRate: string
  taxIncluded: boolean
  businessHours: string
  paymentMethods: string
  website: string
  instagram: string
  locale: string
  timeZone: string
}

const emptyBusiness: BusinessForm = {
  name: '', phone: '', address: '', city: '', country: '', currency: 'USD', currencySymbol: '$',
  businessType: 'Retail', logoUrl: '', description: '', taxName: 'IVA', taxRate: '0',
  taxIncluded: false, businessHours: '', paymentMethods: '', website: '', instagram: '',
  locale: 'es-CO', timeZone: 'America/Bogota',
}

export function SettingsPage({ accountOnly = false }: { accountOnly?: boolean }) {
  const { session, refresh, logout } = useAuth()
  const { canManageSettings } = usePermissions()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<'business' | 'account' | 'plan'>(accountOnly ? 'account' : 'business')
  const [business, setBusiness] = useState<BusinessForm>(emptyBusiness)
  const [profile, setProfile] = useState({ fullName: '', phone: '', avatarUrl: '' })
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })

  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ['tenant'],
    queryFn: () => api.get<Tenant>('/tenant'),
    enabled: !accountOnly,
  })

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api.get<MeResponse>('/auth/me') })
  const { data: plans } = useQuery({ queryKey: ['plans'], queryFn: () => api.get<PlanOption[]>('/plans'), enabled: !accountOnly })

  useEffect(() => {
    if (!tenant) return
    setBusiness({
      name: tenant.name,
      phone: tenant.phone ?? '',
      address: tenant.address ?? '',
      city: tenant.city ?? '',
      country: tenant.country ?? '',
      currency: tenant.currency,
      currencySymbol: tenant.currencySymbol,
      businessType: tenant.businessType,
      logoUrl: tenant.logoUrl ?? '',
      description: tenant.description ?? '',
      taxName: tenant.taxName ?? '',
      taxRate: String(tenant.taxRate),
      taxIncluded: tenant.taxIncluded,
      businessHours: tenant.businessHours ?? '',
      paymentMethods: tenant.paymentMethods ?? '',
      website: tenant.website ?? '',
      instagram: tenant.instagram ?? '',
      locale: tenant.locale,
      timeZone: tenant.timeZone,
    })
  }, [tenant])

  useEffect(() => {
    if (!me) return
    setProfile({ fullName: me.user.fullName, phone: me.user.phone ?? '', avatarUrl: me.user.avatarUrl ?? '' })
  }, [me])

  const saveBusiness = useMutation({
    mutationFn: () =>
      api.put<Tenant>('/tenant', {
        name: business.name,
        phone: business.phone || null,
        address: business.address || null,
        city: business.city || null,
        country: business.country || null,
        currency: business.currency,
        currencySymbol: business.currencySymbol,
        locale: business.locale,
        timeZone: business.timeZone,
        businessType: business.businessType,
        logoUrl: business.logoUrl || null,
        description: business.description || null,
        taxName: business.taxName || null,
        taxRate: Number(business.taxRate) || 0,
        taxIncluded: business.taxIncluded,
        businessHours: business.businessHours || null,
        paymentMethods: business.paymentMethods || null,
        website: business.website || null,
        instagram: business.instagram || null,
      }),
    onSuccess: async () => {
      toast('Datos del negocio actualizados.')
      await refresh()
      void queryClient.invalidateQueries({ queryKey: ['tenant'] })
      void queryClient.invalidateQueries({ queryKey: ['me'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudieron guardar los cambios.', 'error'),
  })

  const saveProfile = useMutation({
    mutationFn: () => api.put<User>('/auth/profile', profile),
    onSuccess: async () => {
      toast('Perfil actualizado.')
      await refresh()
      void queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo actualizar el perfil.', 'error'),
  })

  const changePassword = useMutation({
    mutationFn: () => api.post('/auth/change-password', { currentPassword: password.currentPassword, newPassword: password.newPassword }),
    onSuccess: () => {
      toast('Contraseña actualizada correctamente.')
      setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' })
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo cambiar la contraseña.', 'error'),
  })

  const usage = me?.usage
  const plan = me?.plan
  const currentPlan = plans?.find((option) => option.id === (plan?.plan ?? session?.tenant.plan))
  const activeTab = accountOnly ? 'account' : canManageSettings ? tab : 'account'
  const userPermissions = permissionCatalog.filter(
    (permission) =>
      session?.user.role === 'Owner' ||
      session?.user.role === 'Admin' ||
      Boolean(me?.user.permissions.includes(permission.key)),
  )

  if (!accountOnly && tenantLoading) return <PageLoader label="Cargando configuración…" />

  const setB = <K extends keyof BusinessForm>(key: K, value: BusinessForm[K]) => setBusiness((current) => ({ ...current, [key]: value }))

  return (
    <div className="page">
      <PageHeader
        title={accountOnly ? 'Mi cuenta' : 'Configuración'}
        subtitle={accountOnly ? 'Actualiza tu perfil, cambia tu contraseña y revisa los permisos que te asignaron.' : 'Personaliza tu negocio, tu cuenta y conoce tu plan.'}
      />

      {!accountOnly && (
        <Tabs
          value={activeTab}
          onChange={setTab}
          tabs={[
            ...(canManageSettings ? [{ id: 'business' as const, label: 'Negocio', icon: <Building2 className="size-3.5" /> }] : []),
            { id: 'account' as const, label: 'Mi cuenta', icon: <UserRound className="size-3.5" /> },
            ...(canManageSettings ? [{ id: 'plan' as const, label: 'Plan', icon: <Crown className="size-3.5" /> }] : []),
          ]}
        />
      )}

      {activeTab === 'business' && (
        <div className="mt-3 grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="card p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <Store className="size-4 text-brand-500" />
              <div>
                <p className="text-[13px] font-bold text-ink">Datos del negocio</p>
                <p className="text-[10.5px] text-muted">Esta información se usa en el dashboard, tickets y WhatsApp.</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre comercial" required className="sm:col-span-2">
                <Input value={business.name} onChange={(event) => setB('name', event.target.value)} />
              </Field>
              <Field label="Tipo de negocio">
                <Select value={business.businessType} onChange={(event) => setB('businessType', event.target.value)}>
                  {Object.entries(businessTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
              </Field>
              <Field label="Teléfono">
                <Input value={business.phone} onChange={(event) => setB('phone', event.target.value)} />
              </Field>
              <Field label="Correo de contacto">
                <Input value={session?.tenant.email ?? ''} disabled />
              </Field>
              <Field label="Sitio web">
                <Input value={business.website} onChange={(event) => setB('website', event.target.value)} placeholder="https://…" />
              </Field>
              <Field label="Dirección">
                <Input value={business.address} onChange={(event) => setB('address', event.target.value)} />
              </Field>
              <Field label="Ciudad">
                <Input value={business.city} onChange={(event) => setB('city', event.target.value)} />
              </Field>
              <Field label="País">
                <Input value={business.country} onChange={(event) => setB('country', event.target.value)} />
              </Field>
              <Field label="Instagram">
                <Input value={business.instagram} onChange={(event) => setB('instagram', event.target.value)} placeholder="@tunegocio" />
              </Field>
              <Field label="Moneda" hint="Código ISO de 3 letras.">
                <Input value={business.currency} onChange={(event) => setB('currency', event.target.value.toUpperCase().slice(0, 3))} />
              </Field>
              <Field label="Símbolo">
                <Input value={business.currencySymbol} onChange={(event) => setB('currencySymbol', event.target.value)} />
              </Field>
              <Field label="Impuesto">
                <Input value={business.taxName} onChange={(event) => setB('taxName', event.target.value)} placeholder="IVA" />
              </Field>
              <Field label="Tarifa de impuesto (%)">
                <Input inputMode="decimal" value={business.taxRate} onChange={(event) => setB('taxRate', event.target.value)} />
              </Field>
              <Field label="Zona horaria">
                <Input value={business.timeZone} onChange={(event) => setB('timeZone', event.target.value)} />
              </Field>
              <Field label="Idioma / locale">
                <Input value={business.locale} onChange={(event) => setB('locale', event.target.value)} />
              </Field>
              <Field label="Logo (URL)" className="sm:col-span-2">
                <Input value={business.logoUrl} onChange={(event) => setB('logoUrl', event.target.value)} placeholder="https://…" />
              </Field>
              <Field label="Descripción" className="sm:col-span-2">
                <Textarea value={business.description} onChange={(event) => setB('description', event.target.value)} placeholder="¿Qué hace especial a tu negocio?" />
              </Field>
              <Field label="Horario de atención" className="sm:col-span-2" hint="Se usa en las respuestas automáticas de WhatsApp.">
                <Textarea value={business.businessHours} onChange={(event) => setB('businessHours', event.target.value)} placeholder="Lun a sáb: 9:00 a 19:00" />
              </Field>
              <Field label="Métodos de pago" className="sm:col-span-2" hint="Se muestran a tus clientes en WhatsApp.">
                <Input value={business.paymentMethods} onChange={(event) => setB('paymentMethods', event.target.value)} placeholder="Efectivo, tarjeta, Nequi, transferencia" />
              </Field>
              <div className="sm:col-span-2">
                <Toggle
                  checked={business.taxIncluded}
                  onChange={(value) => setB('taxIncluded', value)}
                  label="Precios con impuesto incluido"
                  description="El impuesto se calcula dentro del precio de venta."
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end border-t border-line pt-4">
              <Button onClick={() => saveBusiness.mutate()} loading={saveBusiness.isPending} disabled={!business.name.trim()}>
                <Save className="size-4" /> Guardar cambios
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="card overflow-hidden">
              <div className="bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white">
                <div className="flex items-center gap-3">
                  <Avatar name={business.name} src={business.logoUrl} size="lg" className="rounded-2xl ring-white/20" />
                  <div className="min-w-0">
                    <p className="truncate font-display text-[16px] font-bold">{business.name || 'Tu negocio'}</p>
                    <p className="text-[11px] text-white/70">{businessTypeLabels[business.businessType] ?? business.businessType}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge tone="green" className="!bg-white/15 !text-white"><BadgeCheck className="size-3" /> Verificado</Badge>
                  <Badge tone="violet" className="!bg-white/15 !text-white">{planLabels[plan?.plan ?? ''] ?? plan?.plan}</Badge>
                </div>
              </div>
              <div className="space-y-2.5 p-4 text-[11.5px]">
                <div className="flex justify-between"><span className="text-muted">Moneda</span><span className="font-semibold text-ink">{business.currency} ({business.currencySymbol})</span></div>
                <div className="flex justify-between"><span className="text-muted">Impuesto</span><span className="font-semibold text-ink">{business.taxName || 'Sin impuesto'} · {business.taxRate || 0}%</span></div>
                <div className="flex justify-between"><span className="text-muted">Sedes</span><span className="font-semibold text-ink">{usage?.branches ?? 0}</span></div>
                <div className="flex justify-between"><span className="text-muted">Productos</span><span className="font-semibold text-ink">{numberFormat(usage?.products ?? 0)}</span></div>
              </div>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><ShieldCheck className="size-4" /></span>
                <p className="text-[12px] font-semibold text-ink">Datos aislados y seguros</p>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">
                Cada negocio tiene su propio espacio de datos. La configuración que guardes aquí solo aplica a {session?.tenant.name}.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'account' && (
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div className="card p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <UserRound className="size-4 text-brand-500" />
              <div>
                <p className="text-[13px] font-bold text-ink">Mi perfil</p>
                <p className="text-[10.5px] text-muted">Actualiza tu información personal.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-canvas p-3">
              <Avatar name={profile.fullName} src={profile.avatarUrl} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold text-ink">{profile.fullName || me?.user.fullName}</p>
                <p className="truncate text-[11px] text-muted">{me?.user.email}</p>
                <Badge tone="violet" className="mt-1">{roleLabel(me?.user.role)}</Badge>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <Field label="Nombre completo">
                <Input value={profile.fullName} onChange={(event) => setProfile((current) => ({ ...current, fullName: event.target.value }))} />
              </Field>
              <Field label="Teléfono">
                <Input value={profile.phone} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} />
              </Field>
              <Field label="Foto de perfil (URL)">
                <Input value={profile.avatarUrl} onChange={(event) => setProfile((current) => ({ ...current, avatarUrl: event.target.value }))} />
              </Field>
              <Field label="Correo">
                <Input value={me?.user.email ?? ''} disabled />
              </Field>
            </div>
            <div className="mt-4 flex justify-end border-t border-line pt-4">
              <Button onClick={() => saveProfile.mutate()} loading={saveProfile.isPending} disabled={!profile.fullName.trim()}>
                <Save className="size-4" /> Guardar perfil
              </Button>
            </div>
          </div>

          <div className="card p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <KeyRound className="size-4 text-brand-500" />
              <div>
                <p className="text-[13px] font-bold text-ink">Seguridad</p>
                <p className="text-[10.5px] text-muted">Cambia tu contraseña periódicamente.</p>
              </div>
            </div>
            <div className="space-y-3">
              <Field label="Contraseña actual" required>
                <Input type="password" value={password.currentPassword} onChange={(event) => setPassword((current) => ({ ...current, currentPassword: event.target.value }))} />
              </Field>
              <Field label="Nueva contraseña" required hint="Mínimo 8 caracteres.">
                <Input type="password" value={password.newPassword} onChange={(event) => setPassword((current) => ({ ...current, newPassword: event.target.value }))} />
              </Field>
              <Field label="Confirmar contraseña" required>
                <Input type="password" value={password.confirmPassword} onChange={(event) => setPassword((current) => ({ ...current, confirmPassword: event.target.value }))} />
              </Field>
            </div>
            {password.newPassword && password.confirmPassword && password.newPassword !== password.confirmPassword && (
              <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-600">Las contraseñas no coinciden.</p>
            )}
            <div className="mt-4 flex justify-end border-t border-line pt-4">
              <Button
                onClick={() => changePassword.mutate()}
                loading={changePassword.isPending}
                disabled={!password.currentPassword || password.newPassword.length < 8 || password.newPassword !== password.confirmPassword}
              >
                <Lock className="size-4" /> Actualizar contraseña
              </Button>
            </div>

            <div className="mt-4 rounded-xl bg-brand-50/60 p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-800"><Mail className="size-3.5" /> Inicio de sesión</p>
              <p className="mt-1 text-[10.5px] text-muted">Usas {me?.user.email} para entrar a NexComerce. El correo es único por cuenta.</p>
            </div>
          </div>

          <div className="card p-4 sm:p-5 lg:col-span-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-600" />
                <div>
                  <p className="text-[13px] font-bold text-ink">Mis permisos</p>
                  <p className="text-[10.5px] text-muted">Estas son las funciones que el propietario te asignó.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="gray">{roleLabel(me?.user.role)}</Badge>
                <Badge tone="gray">{session?.branch?.name ?? 'Todas las sedes'}</Badge>
              </div>
            </div>

            {userPermissions.length === 0 ? (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-[11px] text-amber-800">
                No tienes módulos asignados. Contacta al propietario para que ajuste tus permisos.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {userPermissions.map((permission) => (
                  <span key={permission.key} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10.5px] font-semibold text-emerald-700">
                    <Check className="size-3" /> {permission.label}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[10.5px] text-muted">Si necesitas otra función, pídele al propietario que la habilite.</p>
              <Button variant="secondary" size="sm" onClick={logout}>
                <LogOut className="size-3.5" /> Cerrar sesión
              </Button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'plan' && (
        <div className="mt-3 space-y-4">
          <div className="card p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Plan actual</p>
                <p className="font-display text-[24px] font-extrabold text-ink">{plan?.plan ?? session?.tenant.plan}</p>
                <p className="mt-0.5 text-[11.5px] text-muted">
                  {currentPlan ? `${money(currentPlan.price, '$')} / mes · hasta ${currentPlan.users} usuarios` : 'Suscripción activa'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="green"><Sparkles className="size-3" /> Activo</Badge>
                <Button variant="secondary" size="sm" onClick={() => toast('Un asesor se pondrá en contacto para ampliar tu plan.', 'info')}>
                  Hablar con ventas
                </Button>
              </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div>
                <div className="mb-1 flex justify-between text-[11.5px]"><span className="text-muted">Usuarios</span><span className="font-semibold text-ink">{usage?.users ?? 0} / {plan?.userLimit ?? '—'}</span></div>
                <ProgressBar value={plan?.userLimit ? ((usage?.users ?? 0) / plan.userLimit) * 100 : 0} />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-[11.5px]"><span className="text-muted">Sedes</span><span className="font-semibold text-ink">{usage?.branches ?? 0} / {plan?.branchLimit ?? '—'}</span></div>
                <ProgressBar value={plan?.branchLimit ? ((usage?.branches ?? 0) / plan.branchLimit) * 100 : 0} tone="green" />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-[11.5px]"><span className="text-muted">Productos</span><span className="font-semibold text-ink">{numberFormat(usage?.products ?? 0)} / {plan?.productLimit ?? '—'}</span></div>
                <ProgressBar value={plan?.productLimit ? ((usage?.products ?? 0) / plan.productLimit) * 100 : 0} tone="amber" />
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {(plans ?? []).map((option) => {
              const current = option.id === (plan?.plan ?? session?.tenant.plan)
              return (
                <div key={option.id} className={cn('card relative flex flex-col p-5', current && 'border-brand-400 ring-2 ring-brand-100')}>
                  {current && (
                    <span className="absolute -top-2.5 left-4 rounded-full bg-brand-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">Plan actual</span>
                  )}
                  <div className="flex items-center gap-2">
                    <span className={cn('flex size-9 items-center justify-center rounded-xl', current ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600')}>
                      {option.id === 'Business' ? <Crown className="size-4" /> : option.id === 'Growth' ? <Sparkles className="size-4" /> : <Palette className="size-4" />}
                    </span>
                    <p className="font-display text-[15px] font-bold text-ink">{option.name}</p>
                  </div>
                  <p className="mt-3 font-display text-[26px] font-extrabold text-ink">
                    {option.price === 0 ? 'Gratis' : money(option.price, '$')}
                    {option.price > 0 && <span className="text-[12px] font-medium text-muted"> / mes</span>}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2 text-[10.5px] text-muted">
                    <span>{option.users} usuarios</span>
                    <span>·</span>
                    <span>{option.branches} sedes</span>
                    <span>·</span>
                    <span>{numberFormat(option.products)} productos</span>
                  </div>
                  <ul className="mt-4 flex-1 space-y-2">
                    {option.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-[11.5px] text-muted">
                        <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" /> {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={current ? 'secondary' : 'primary'}
                    size="sm"
                    className="mt-4 w-full"
                    disabled={current}
                    onClick={() => toast('Solicitud registrada. Te contactaremos para activar el plan.', 'info')}
                  >
                    {current ? 'Plan activo' : option.price === 0 ? 'Usar Starter' : 'Solicitar cambio'}
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
