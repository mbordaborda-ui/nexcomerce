import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from './components/layout'
import { useAuth } from './lib/auth'
import { firstAllowedPath } from './lib/access'
import { LoginPage, RegisterPage, SplashScreen } from './pages/auth/AuthPages'
import { AccessDeniedPage } from './pages/AccessDeniedPage'
import { DashboardPage } from './pages/DashboardPage'
import { PosPage } from './pages/PosPage'
import { SalesPage } from './pages/SalesPage'
import { ProductsPage } from './pages/ProductsPage'
import { InventoryPage } from './pages/InventoryPage'
import { CustomersPage } from './pages/CustomersPage'
import { SuppliersPage } from './pages/SuppliersPage'
import { ExpensesPage } from './pages/ExpensesPage'
import { ReportsPage } from './pages/ReportsPage'
import { TeamPage } from './pages/TeamPage'
import { SettingsPage } from './pages/SettingsPage'
import { WhatsAppPage } from './pages/WhatsAppPage'
import { BillingPage } from './pages/BillingPage'
import { CashPage } from './pages/CashPage'
import { ReceivablesPage } from './pages/ReceivablesPage'
import { OrdersPage } from './pages/OrdersPage'
import { NotFoundPage } from './pages/NotFoundPage'

function ProtectedLayout() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <SplashScreen />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <AppShell />
}

function PermissionRoute({ permission, children, redirect = false }: { permission: string; children: ReactNode; redirect?: boolean }) {
  const { hasPermission } = useAuth()
  if (hasPermission(permission)) return <>{children}</>
  if (redirect) return <Navigate to={firstAllowedPath(hasPermission)} replace />
  return <AccessDeniedPage />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedLayout />}>
        <Route
          index
          element={
            <PermissionRoute permission="dashboard.view" redirect>
              <DashboardPage />
            </PermissionRoute>
          }
        />
        <Route path="/pos" element={<PermissionRoute permission="sales.manage"><PosPage /></PermissionRoute>} />
        <Route path="/sales" element={<PermissionRoute permission="sales.manage"><SalesPage /></PermissionRoute>} />
        <Route path="/products" element={<PermissionRoute permission="products.manage"><ProductsPage /></PermissionRoute>} />
        <Route path="/inventory" element={<PermissionRoute permission="inventory.manage"><InventoryPage /></PermissionRoute>} />
        <Route path="/customers" element={<PermissionRoute permission="customers.manage"><CustomersPage /></PermissionRoute>} />
        <Route path="/suppliers" element={<PermissionRoute permission="suppliers.manage"><SuppliersPage /></PermissionRoute>} />
        <Route path="/expenses" element={<PermissionRoute permission="expenses.manage"><ExpensesPage /></PermissionRoute>} />
        <Route path="/reports" element={<PermissionRoute permission="reports.view"><ReportsPage /></PermissionRoute>} />
        <Route path="/team" element={<PermissionRoute permission="employees.manage"><TeamPage /></PermissionRoute>} />
        <Route path="/settings" element={<PermissionRoute permission="settings.manage"><SettingsPage /></PermissionRoute>} />
        <Route path="/account" element={<SettingsPage accountOnly />} />
        <Route path="/whatsapp" element={<PermissionRoute permission="whatsapp.manage"><WhatsAppPage /></PermissionRoute>} />
        <Route path="/orders" element={<PermissionRoute permission="sales.manage"><OrdersPage /></PermissionRoute>} />
        <Route path="/cash" element={<PermissionRoute permission="sales.manage"><CashPage /></PermissionRoute>} />
        <Route path="/receivables" element={<PermissionRoute permission="customers.manage"><ReceivablesPage /></PermissionRoute>} />
        <Route path="/billing" element={<PermissionRoute permission="settings.manage"><BillingPage /></PermissionRoute>} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
