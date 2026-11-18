export interface User {
  id: string
  fullName: string
  email: string
  phone?: string | null
  role: string
  branchId?: string | null
  branchName?: string | null
  avatarUrl?: string | null
  isActive: boolean
  permissions: string[]
  lastLoginAt?: string | null
  createdAt: string
}

export interface Branch {
  id: string
  name: string
  code: string
  address?: string | null
  city?: string | null
  phone?: string | null
  isMain: boolean
  isActive: boolean
  usersCount: number
  createdAt: string
}

export interface Tenant {
  id: string
  name: string
  slug: string
  email: string
  phone?: string | null
  address?: string | null
  city?: string | null
  country?: string | null
  currency: string
  currencySymbol: string
  locale: string
  timeZone: string
  businessType: string
  logoUrl?: string | null
  description?: string | null
  taxName?: string | null
  taxRate: number
  taxIncluded: boolean
  businessHours?: string | null
  paymentMethods?: string | null
  website?: string | null
  instagram?: string | null
  plan: string
  isActive: boolean
  trialEndsAt?: string | null
  createdAt: string
}

export interface AuthResponse {
  token: string
  expiresAt: string
  user: User
  tenant: Tenant
  branch: Branch | null
  permissions: string[]
}

export interface PlanInfo {
  plan: string
  userLimit: number
  branchLimit: number
  productLimit: number
  trialEndsAt?: string | null
}

export interface Usage {
  users: number
  branches: number
  products: number
  customers: number
  salesThisMonth: number
  whatsAppMessagesThisMonth: number
}

export interface MeResponse {
  user: User
  tenant: Tenant
  branch: Branch | null
  permissions: string[]
  plan: PlanInfo
  usage: Usage
}

export interface Session {
  token: string
  user: User
  tenant: Tenant
  branch: Branch | null
  permissions: string[]
}

export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface Category {
  id: string
  name: string
  description?: string | null
  color: string
  icon?: string | null
  isActive: boolean
  productCount: number
}

export interface Variant {
  id: string
  name: string
  sku?: string | null
  price?: number | null
  stock: number
  isActive: boolean
}

export interface Product {
  id: string
  name: string
  sku: string
  barcode?: string | null
  description?: string | null
  categoryId?: string | null
  categoryName?: string | null
  categoryColor?: string | null
  type: 'Product' | 'Service'
  price: number
  cost: number
  compareAtPrice?: number | null
  unit: string
  imageUrl?: string | null
  brand?: string | null
  isActive: boolean
  trackStock: boolean
  stock: number
  minStock: number
  tags?: string | null
  margin: number
  isLowStock: boolean
  createdAt: string
  variants: Variant[]
}

export interface InventoryMovement {
  id: string
  productId: string
  productName?: string | null
  variantName?: string | null
  type: string
  quantity: number
  previousStock: number
  newStock: number
  reference?: string | null
  notes?: string | null
  branchName?: string | null
  userName?: string | null
  createdAt: string
}

export interface InventorySummary {
  products: number
  stockUnits: number
  stockValue: number
  retailValue: number
  lowStock: number
  outOfStock: number
  byCategory: { name: string; color: string; products: number; units: number; value: number }[]
}

export interface Customer {
  id: string
  name: string
  documentNumber?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  notes?: string | null
  tags?: string | null
  loyaltyPoints: number
  isActive: boolean
  createdAt: string
  purchases: number
  totalSpent: number
  lastPurchaseAt?: string | null
}

export interface Supplier {
  id: string
  name: string
  contactName?: string | null
  documentNumber?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  notes?: string | null
  isActive: boolean
  createdAt: string
  productsSupplied: number
}

export interface SaleItem {
  id: string
  productId: string
  variantId?: string | null
  productName: string
  variantName?: string | null
  sku?: string | null
  quantity: number
  unitPrice: number
  unitCost: number
  discount: number
  total: number
}

export interface SaleSummary {
  id: string
  number: string
  customerName?: string | null
  userName?: string | null
  branchName?: string | null
  total: number
  paymentMethod: string
  status: string
  channel?: string | null
  itemCount: number
  createdAt: string
}

export interface SalesSummaryDto {
  total: number
  count: number
  average: number
  tax: number
  discount: number
  byPayment: PaymentTotal[]
}

export interface Sale extends SaleSummary {
  branchId?: string | null
  customerId?: string | null
  userId?: string | null
  subtotal: number
  discount: number
  tax: number
  paidAmount: number
  change: number
  notes?: string | null
  cancelledAt?: string | null
  cancelReason?: string | null
  items: SaleItem[]
}

export interface Expense {
  id: string
  category: string
  description: string
  amount: number
  date: string
  paymentMethod: string
  supplierId?: string | null
  supplierName?: string | null
  branchId?: string | null
  branchName?: string | null
  notes?: string | null
  isRecurring: boolean
  createdAt: string
}

export interface Role {
  id: string
  name: string
  description: string
  permissions: string[]
}

export interface PermissionItem {
  key: string
  label: string
  group: string
  assigned: boolean
}

export interface DailySales {
  date: string
  sales: number
  orders: number
}

export interface CategorySales {
  name: string
  color: string
  total: number
  quantity: number
}

export interface TopProduct {
  id: string
  name: string
  imageUrl?: string | null
  categoryName?: string | null
  quantity: number
  total: number
}

export interface LowStockItem {
  id: string
  name: string
  imageUrl?: string | null
  stock: number
  minStock: number
  categoryName?: string | null
  price: number
}

export interface PaymentTotal {
  method: string
  total: number
  count: number
}

export interface Dashboard {
  salesToday: number
  salesYesterday: number
  salesMonth: number
  salesPreviousMonth: number
  ordersToday: number
  ordersMonth: number
  averageTicket: number
  averageTicketPrevious: number
  newCustomersMonth: number
  totalCustomers: number
  lowStockCount: number
  outOfStockCount: number
  inventoryValue: number
  expensesMonth: number
  profitMonth: number
  salesChange: number
  whatsAppOpen: number
  whatsAppAutomated: number
  pendingSales: number
  salesSeries: DailySales[]
  categorySales: CategorySales[]
  topProducts: TopProduct[]
  recentSales: SaleSummary[]
  lowStock: LowStockItem[]
  paymentBreakdown: PaymentTotal[]
}

export interface SalesReport {
  from: string
  to: string
  total: number
  count: number
  average: number
  tax: number
  discount: number
  cost: number
  profit: number
  series: DailySales[]
  byPayment: PaymentTotal[]
  byCategory: CategorySales[]
  topProducts: TopProduct[]
  bySeller: { userId?: string | null; name: string; orders: number; total: number }[]
  byBranch: { branchId?: string | null; name: string; orders: number; total: number }[]
  sales: SaleSummary[]
}

export interface InventoryReport {
  summary: InventorySummary
  byCategory: { name: string; color: string; units: number; costValue: number; retailValue: number }[]
  lowStock: LowStockItem[]
  recentMovements: InventoryMovement[]
  movementTotals: { type: string; count: number; units: number }[]
}

export interface ProfitReport {
  from: string
  to: string
  revenue: number
  cost: number
  grossProfit: number
  expenses: number
  netProfit: number
  margin: number
  series: { date: string; revenue: number; cost: number; expenses: number }[]
  expenseCategories: { category: string; total: number; count: number }[]
}

export interface WhatsAppAccount {
  id: string
  wabaId?: string | null
  phoneNumberId?: string | null
  displayPhoneNumber?: string | null
  hasToken: boolean
  verifyToken: string
  isEnabled: boolean
  aiEnabled: boolean
  aiModel?: string | null
  welcomeMessage: string
  fallbackMessage: string
  handoffMessage: string
  businessHoursText?: string | null
  locationText?: string | null
  paymentMethodsText?: string | null
  servicesText?: string | null
  systemPrompt?: string | null
  autoReplyEnabled: boolean
  productLookupEnabled: boolean
  connectedAt?: string | null
  aiKeyConfigured: boolean
}

export interface FAQ {
  id: string
  question: string
  answer: string
  keywords?: string | null
  priority: number
  isActive: boolean
}

export interface Conversation {
  id: string
  contactId: string
  contactName: string
  contactPhone?: string | null
  avatarUrl?: string | null
  status: string
  assignedUserId?: string | null
  assignedUserName?: string | null
  lastMessagePreview?: string | null
  lastMessageAt: string
  messageCount: number
  unreadCount: number
  tags?: string | null
}

export interface Message {
  id: string
  conversationId: string
  direction: string
  body: string
  type?: string | null
  mediaUrl?: string | null
  status?: string | null
  isAutomated: boolean
  intent?: string | null
  sentByName?: string | null
  createdAt: string
}

export interface ConversationDetail {
  conversation: Conversation
  messages: Message[]
}

export interface WhatsAppStats {
  totalConversations: number
  openConversations: number
  humanConversations: number
  automatedMessages: number
  inboundMessages: number
  outboundMessages: number
  automationRate: number
  activeContacts: number
  daily: { date: string; inbound: number; outbound: number }[]
  topIntents: { intent: string; count: number }[]
}

export interface BotReply {
  reply: string
  intent: string
  handoff: boolean
  products: { id: string; name: string; price: number; stock: number; imageUrl?: string | null; sku?: string | null }[]
}

export interface WebhookInfo {
  webhookUrl: string
  verifyToken: string
  graphVersion: string
  connected: boolean
}
