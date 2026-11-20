const locale = 'es-CO'

export function money(value: number | null | undefined, symbol = '$'): string {
  const n = Number(value ?? 0)
  return `${symbol}${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`
}

export function moneyShort(value: number | null | undefined, symbol = '$'): string {
  const n = Number(value ?? 0)
  if (Math.abs(n) >= 1_000_000) return `${symbol}${(n / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (Math.abs(n) >= 10_000) return `${symbol}${(n / 1_000).toFixed(1).replace('.', ',')}k`
  return money(n, symbol)
}

export function numberFormat(value: number | null | undefined): string {
  return new Intl.NumberFormat(locale).format(Number(value ?? 0))
}

export function percent(value: number | null | undefined): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Number(value ?? 0))}%`
}

export function parseDate(value?: string | null): Date | null {
  if (!value) return null
  const hasZone = /Z$|[+-]\d{2}:?\d{2}$/.test(value)
  return new Date(hasZone ? value : `${value}Z`)
}

export function dateShort(value?: string | null): string {
  const date = parseDate(value)
  if (!date) return '—'
  return date.toLocaleDateString(locale, { day: '2-digit', month: 'short' })
}

export function dateLong(value?: string | null): string {
  const date = parseDate(value)
  if (!date) return '—'
  return date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
}

export function dateTime(value?: string | null): string {
  const date = parseDate(value)
  if (!date) return '—'
  return date.toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function timeOnly(value?: string | null): string {
  const date = parseDate(value)
  if (!date) return ''
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

export function timeAgo(value?: string | null): string {
  const date = parseDate(value)
  if (!date) return '—'
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Ahora'
  if (minutes < 60) return `Hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Ayer'
  if (days < 7) return `Hace ${days} días`
  return dateShort(value)
}

export function initials(name?: string | null): string {
  if (!name) return 'N'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function toInputDate(date: Date): string {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

export function todayInput(): string {
  return toInputDate(new Date())
}

export function daysAgoInput(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return toInputDate(date)
}

export function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 18) return 'Buenas tardes'
  return 'Buenas noches'
}

export const paymentLabels: Record<string, string> = {
  Cash: 'Efectivo',
  Card: 'Tarjeta',
  Transfer: 'Transferencia',
  Nequi: 'Nequi',
  Daviplata: 'Daviplata',
  Credit: 'Crédito',
  Other: 'Otro',
}

export const statusLabels: Record<string, string> = {
  Completed: 'Completada',
  Pending: 'Pendiente',
  Cancelled: 'Anulada',
}

export const roleLabels: Record<string, string> = {
  Owner: 'Propietario',
  Admin: 'Administrador',
  Manager: 'Gerente',
  Cashier: 'Cajero',
  Warehouse: 'Bodega',
  Support: 'Asesor',
}

export const movementLabels: Record<string, string> = {
  In: 'Entrada',
  Out: 'Salida',
  Adjustment: 'Ajuste',
  Sale: 'Venta',
  Return: 'Devolución',
  Transfer: 'Traslado',
}

export const conversationStatusLabels: Record<string, string> = {
  Bot: 'Bot',
  Human: 'Asesor',
  Closed: 'Cerrada',
}

export const intentLabels: Record<string, string> = {
  product: 'Producto',
  price: 'Precio',
  faq: 'Pregunta frecuente',
  hours: 'Horario',
  location: 'Ubicación',
  payments: 'Pagos',
  services: 'Servicios',
  greeting: 'Saludo',
  handoff: 'Transferencia',
  fallback: 'Sin coincidencia',
  ai: 'IA',
  thanks: 'Agradecimiento',
}

export const businessTypeLabels: Record<string, string> = {
  Retail: 'Comercio general',
  Clothing: 'Tienda de ropa',
  Restaurant: 'Restaurante',
  Minimarket: 'Minimercado',
  Technology: 'Tecnología',
  Beauty: 'Belleza',
  Hardware: 'Ferretería',
  Distributor: 'Distribuidor',
  Services: 'Servicios',
  Other: 'Otro',
}

export const planLabels: Record<string, string> = {
  Starter: 'Starter',
  Growth: 'Growth',
  Business: 'Business',
}

export function paymentLabel(value?: string | null): string {
  return value ? (paymentLabels[value] ?? value) : '—'
}

export function roleLabel(value?: string | null): string {
  return value ? (roleLabels[value] ?? value) : '—'
}

export function statusLabel(value?: string | null): string {
  return value ? (statusLabels[value] ?? value) : '—'
}

export const orderStatusLabels: Record<string, string> = {
  Pending: 'Nuevo',
  Confirmed: 'Confirmado',
  Preparing: 'En preparación',
  Ready: 'Listo',
  Delivered: 'Entregado',
  Cancelled: 'Cancelado',
}

export const orderChannelLabels: Record<string, string> = {
  WhatsApp: 'WhatsApp',
  Instagram: 'Instagram',
  Counter: 'Mostrador',
  Phone: 'Teléfono',
  Other: 'Otro',
}

export const receivableStatusLabels: Record<string, string> = {
  Pending: 'Pendiente',
  Partial: 'Abono parcial',
  Paid: 'Pagada',
  Cancelled: 'Anulada',
}

export const cashTypeLabels: Record<string, string> = {
  Opening: 'Apertura',
  Sale: 'Venta',
  Income: 'Ingreso',
  Expense: 'Egreso',
  Withdrawal: 'Retiro',
  Adjustment: 'Ajuste',
}

export const subscriptionStatusLabels: Record<string, string> = {
  Trialing: 'Prueba gratuita',
  Active: 'Activa',
  PastDue: 'Pago pendiente',
  Cancelled: 'Cancelada',
}

export function orderStatusLabel(value?: string | null): string {
  return value ? (orderStatusLabels[value] ?? value) : '—'
}

export function orderChannelLabel(value?: string | null): string {
  return value ? (orderChannelLabels[value] ?? value) : '—'
}

export function receivableStatusLabel(value?: string | null): string {
  return value ? (receivableStatusLabels[value] ?? value) : '—'
}
