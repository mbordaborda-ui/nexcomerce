export type AccessRule = {
  path: string
  label: string
  permission: string
}

export const accessRules: AccessRule[] = [
  { path: '/', label: 'Inicio', permission: 'dashboard.view' },
  { path: '/pos', label: 'Punto de venta', permission: 'sales.manage' },
  { path: '/products', label: 'Productos', permission: 'products.manage' },
  { path: '/inventory', label: 'Inventario', permission: 'inventory.manage' },
  { path: '/customers', label: 'Clientes', permission: 'customers.manage' },
  { path: '/whatsapp', label: 'WhatsApp', permission: 'whatsapp.manage' },
  { path: '/orders', label: 'Pedidos', permission: 'sales.manage' },
  { path: '/cash', label: 'Caja', permission: 'sales.manage' },
  { path: '/receivables', label: 'Cuentas por cobrar', permission: 'customers.manage' },
  { path: '/expenses', label: 'Gastos', permission: 'expenses.manage' },
  { path: '/reports', label: 'Reportes', permission: 'reports.view' },
  { path: '/team', label: 'Equipo y sedes', permission: 'employees.manage' },
  { path: '/billing', label: 'Suscripción', permission: 'settings.manage' },
]

export const permissionCatalog = [
  { key: 'dashboard.view', label: 'Ver dashboard', group: 'General' },
  { key: 'products.manage', label: 'Gestionar productos', group: 'Catálogo' },
  { key: 'inventory.manage', label: 'Gestionar inventario', group: 'Catálogo' },
  { key: 'sales.manage', label: 'Registrar y anular ventas', group: 'Ventas' },
  { key: 'customers.manage', label: 'Gestionar clientes y cartera', group: 'Contactos' },
  { key: 'suppliers.manage', label: 'Gestionar proveedores', group: 'Contactos' },
  { key: 'expenses.manage', label: 'Gestionar gastos', group: 'Finanzas' },
  { key: 'reports.view', label: 'Ver reportes', group: 'Reportes' },
  { key: 'employees.manage', label: 'Gestionar empleados', group: 'Administración' },
  { key: 'settings.manage', label: 'Configurar el negocio', group: 'Administración' },
  { key: 'whatsapp.manage', label: 'Gestionar WhatsApp', group: 'WhatsApp' },
] as const

export const permissionLabels: Record<string, string> = Object.fromEntries(
  permissionCatalog.map((permission) => [permission.key, permission.label]),
)

export function firstAllowedPath(hasPermission: (permission: string) => boolean): string {
  return accessRules.find((rule) => hasPermission(rule.permission))?.path ?? '/account'
}
