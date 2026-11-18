import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Check,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Store,
  User,
} from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { Button, Field, Input, Select } from '../../components/ui'
import { Logo } from '../../components/layout'

function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-[#2a1454] lg:flex lg:w-[46%] lg:flex-col lg:justify-between lg:p-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(139,92,246,0.55),transparent_45%),radial-gradient(circle_at_85%_75%,rgba(109,40,217,0.65),transparent_50%)]" />
      <div className="absolute -left-20 top-1/3 size-72 rounded-full border border-white/10" />
      <div className="absolute -right-16 bottom-10 size-80 rounded-full border border-white/10" />

      <div className="relative z-10">
        <Logo light />
      </div>

      <div className="relative z-10 max-w-md">
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-brand-100 backdrop-blur">
          <Sparkles className="size-3" /> Plataforma todo en uno
        </span>
        <h1 className="font-display text-[34px] font-extrabold leading-[1.12] tracking-tight text-white">
          Tu negocio completo,<br />en un solo lugar.
        </h1>
        <p className="mt-4 text-[14px] leading-relaxed text-brand-100/80">
          Inventario, ventas, clientes, equipo y atención inteligente por WhatsApp. Diseñado para cualquier tipo de comercio.
        </p>

        <div className="mt-8 space-y-2.5">
          {[
            'Ventas y facturación en segundos desde tu celular',
            'Inventario y alertas de stock en tiempo real',
            'Asistente con IA que responde por WhatsApp 24/7',
          ].map((item) => (
            <div key={item} className="flex items-center gap-2.5 text-[12.5px] text-white/90">
              <span className="flex size-5 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
                <Check className="size-3" />
              </span>
              {item}
            </div>
          ))}
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 backdrop-blur">
            <div className="flex items-center gap-2 text-brand-200">
              <BarChart3 className="size-4" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">Ventas del mes</span>
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-white">$22.340</p>
            <span className="text-[10px] font-semibold text-emerald-300">↑ 18,4% vs. mes anterior</span>
            <div className="mt-3 flex h-8 items-end gap-1">
              {[35, 55, 40, 70, 58, 82, 66, 95].map((height, index) => (
                <span key={index} className="flex-1 rounded-sm bg-gradient-to-t from-brand-400/30 to-brand-300" style={{ height: `${height}%` }} />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-emerald-300">
                <MessageCircle className="size-4" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">WhatsApp + IA</span>
              </div>
              <p className="mt-1.5 text-[11.5px] leading-snug text-white/85">“¿Tienen la camiseta en talla M?”</p>
              <p className="mt-1 text-[10.5px] leading-snug text-brand-200">“¡Sí! Está disponible por $39.90 💜”</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 backdrop-blur">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-200">Stock saludable</p>
              <p className="mt-1 font-display text-xl font-bold text-white">98,2%</p>
            </div>
          </div>
        </div>
      </div>

      <p className="relative z-10 text-[10.5px] text-white/40">
        © 2026 NexComerce · Seguridad y aislamiento de datos por negocio
      </p>
    </div>
  )
}

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-white">
      <BrandPanel />
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between px-5 pt-5 lg:hidden">
          <Logo />
          <span className="text-[10px] font-semibold text-muted">v1.0</span>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8 lg:px-12">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
        <div className="hidden items-center justify-center gap-4 px-8 pb-6 text-[10.5px] text-muted lg:flex">
          <span className="flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> Datos protegidos</span>
          <span>·</span>
          <span>Términos</span>
          <span>·</span>
          <span>Privacidad</span>
        </div>
      </div>
    </div>
  )
}

export function LoginPage() {
  const { session, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (session) return <Navigate to="/" replace />

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email.trim(), password)
      navigate('/', { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  const demoLogin = async () => {
    setError('')
    setLoading(true)
    try {
      await login('demo@nexcomerce.app', 'Demo1234!')
      navigate('/', { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo entrar a la demo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <div className="mb-7">
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-brand-700">
          <Sparkles className="size-3" /> Bienvenido de vuelta
        </span>
        <h1 className="font-display text-[27px] font-extrabold leading-tight text-ink">Inicia sesión en tu negocio</h1>
        <p className="mt-1.5 text-[13px] text-muted">Administra tus ventas, inventario y WhatsApp desde aquí.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Correo electrónico" required>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              type="email"
              className="pl-10"
              placeholder="tu@negocio.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </div>
        </Field>

        <Field label="Contraseña" required>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              type={showPassword ? 'text' : 'password'}
              className="pl-10 pr-11"
              placeholder="Tu contraseña"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:bg-brand-50"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-[11.5px] font-medium text-muted">
            <input type="checkbox" defaultChecked className="size-3.5 rounded border-line accent-brand-600" /> Recordarme
          </label>
          <button type="button" className="text-[11.5px] font-semibold text-brand-700 hover:underline">¿Olvidaste tu contraseña?</button>
        </div>

        {error && <p className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5 text-[12px] font-medium text-rose-700">{error}</p>}

        <Button type="submit" className="w-full" loading={loading} icon={<ArrowRight className="size-4" />}>
          Entrar a NexComerce
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[10.5px] font-medium uppercase tracking-wider text-muted">o explora primero</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <button
        type="button"
        onClick={demoLogin}
        disabled={loading}
        className="flex w-full items-center justify-between rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-left transition-colors hover:border-brand-200 hover:bg-brand-50"
      >
        <span className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-white text-brand-600 shadow-sm"><Store className="size-4" /></span>
          <span>
            <span className="block text-[12.5px] font-bold text-ink">Probar con negocio demo</span>
            <span className="block text-[10.5px] text-muted">Empire Store · datos de ejemplo</span>
          </span>
        </span>
        <ArrowRight className="size-4 text-brand-500" />
      </button>

      <p className="mt-6 text-center text-[12.5px] text-muted">
        ¿Aún no tienes cuenta?{' '}
        <Link to="/register" className="font-bold text-brand-700 hover:underline">Crea tu negocio gratis</Link>
      </p>
    </AuthShell>
  )
}

const currencies = [
  { code: 'USD', symbol: '$', label: 'Dólar estadounidense (USD)' },
  { code: 'COP', symbol: '$', label: 'Peso colombiano (COP)' },
  { code: 'MXN', symbol: '$', label: 'Peso mexicano (MXN)' },
  { code: 'EUR', symbol: '€', label: 'Euro (EUR)' },
  { code: 'PEN', symbol: 'S/', label: 'Sol peruano (PEN)' },
  { code: 'CLP', symbol: '$', label: 'Peso chileno (CLP)' },
  { code: 'ARS', symbol: '$', label: 'Peso argentino (ARS)' },
  { code: 'BRL', symbol: 'R$', label: 'Real brasileño (BRL)' },
]

const businessTypes = [
  { value: 'Retail', label: 'Comercio general' },
  { value: 'Clothing', label: 'Tienda de ropa' },
  { value: 'Restaurant', label: 'Restaurante' },
  { value: 'Minimarket', label: 'Minimercado' },
  { value: 'Technology', label: 'Tecnología' },
  { value: 'Beauty', label: 'Belleza' },
  { value: 'Hardware', label: 'Ferretería' },
  { value: 'Distributor', label: 'Distribuidor' },
  { value: 'Services', label: 'Servicios' },
  { value: 'Other', label: 'Otro' },
]

export function RegisterPage() {
  const { session, register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    fullName: '',
    businessName: '',
    email: '',
    phone: '',
    password: '',
    businessType: 'Retail',
    currency: 'USD',
    accept: false,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  if (session) return <Navigate to="/" replace />

  const update = (key: keyof typeof form, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }))

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!form.accept) {
      setError('Debes aceptar los términos y la política de privacidad.')
      return
    }
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    setLoading(true)
    try {
      const currency = currencies.find((item) => item.code === form.currency) ?? currencies[0]
      await register({
        fullName: form.fullName.trim(),
        businessName: form.businessName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        businessType: form.businessType,
        currency: currency.code,
        currencySymbol: currency.symbol,
        country: 'Colombia',
      })
      navigate('/', { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo crear la cuenta.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <div className="mb-6">
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-brand-700">
          <Sparkles className="size-3" /> 14 días gratis · sin tarjeta
        </span>
        <h1 className="font-display text-[27px] font-extrabold leading-tight text-ink">Crea el espacio de tu negocio</h1>
        <p className="mt-1.5 text-[13px] text-muted">Tu información es privada. Cada negocio tiene su propio espacio seguro.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Tu nombre" required>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input className="pl-10" placeholder="Valentina Ríos" value={form.fullName} onChange={(event) => update('fullName', event.target.value)} required />
            </div>
          </Field>
          <Field label="Negocio" required>
            <div className="relative">
              <Store className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input className="pl-10" placeholder="Mi tienda" value={form.businessName} onChange={(event) => update('businessName', event.target.value)} required />
            </div>
          </Field>
        </div>

        <Field label="Correo electrónico" required>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input type="email" className="pl-10" placeholder="tu@negocio.com" value={form.email} onChange={(event) => update('email', event.target.value)} required />
          </div>
        </Field>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="WhatsApp / teléfono">
            <Input placeholder="+57 300 000 0000" value={form.phone} onChange={(event) => update('phone', event.target.value)} />
          </Field>
          <Field label="Tipo de negocio">
            <Select value={form.businessType} onChange={(event) => update('businessType', event.target.value)}>
              {businessTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </Select>
          </Field>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Contraseña" hint="Mínimo 8 caracteres" required>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                type={showPassword ? 'text' : 'password'}
                className="pl-10 pr-10"
                placeholder="••••••••"
                value={form.password}
                onChange={(event) => update('password', event.target.value)}
                autoComplete="new-password"
                required
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted">
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
          <Field label="Moneda">
            <Select value={form.currency} onChange={(event) => update('currency', event.target.value)}>
              {currencies.map((currency) => <option key={currency.code} value={currency.code}>{currency.label}</option>)}
            </Select>
          </Field>
        </div>

        <label className="flex items-start gap-2 pt-1 text-[11.5px] leading-relaxed text-muted">
          <input
            type="checkbox"
            checked={form.accept}
            onChange={(event) => update('accept', event.target.checked)}
            className="mt-0.5 size-3.5 shrink-0 rounded border-line accent-brand-600"
          />
          Acepto los términos de servicio y la política de privacidad de NexComerce.
        </label>

        {error && <p className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5 text-[12px] font-medium text-rose-700">{error}</p>}

        <Button type="submit" className="w-full" loading={loading} icon={<ArrowRight className="size-4" />}>
          Crear mi negocio
        </Button>
      </form>

      <p className="mt-5 text-center text-[12.5px] text-muted">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="font-bold text-brand-700 hover:underline">Inicia sesión</Link>
      </p>
    </AuthShell>
  )
}

export function SplashScreen({ message = 'Preparando tu espacio…' }: { message?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas">
      <div className="relative">
        <span className="absolute inset-0 animate-ping rounded-2xl bg-brand-300/40" />
        <span className="relative flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-800 shadow-[var(--shadow-glow)]">
          <svg viewBox="0 0 64 64" className="size-10"><path d="M19 44V20h7l12 15V20h7v24h-7L26 29v15z" fill="white" /></svg>
        </span>
      </div>
      <p className="font-display text-sm font-bold text-ink">NexComerce</p>
      <p className="text-[11.5px] text-muted">{message}</p>
    </div>
  )
}
