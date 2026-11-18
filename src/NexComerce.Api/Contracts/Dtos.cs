using NexComerce.Domain.Common;
using NexComerce.Domain.Catalog;
using NexComerce.Domain.Contacts;
using NexComerce.Domain.Finance;
using NexComerce.Domain.Inventory;
using NexComerce.Domain.Sales;
using NexComerce.Domain.Tenancy;
using NexComerce.Domain.WhatsApp;

namespace NexComerce.Api.Contracts;

public record PageResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize)
{
    public int TotalPages => PageSize == 0 ? 0 : (int)Math.Ceiling(Total / (double)PageSize);
}

// ── Auth ────────────────────────────────────────────────────────────────────
public record RegisterRequest(
    string BusinessName, string FullName, string Email, string Password,
    string? Phone, string? BusinessType, string? Country, string? Currency, string? CurrencySymbol);

public record LoginRequest(string Email, string Password);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public record UpdateProfileRequest(string FullName, string? Phone, string? AvatarUrl);

public record AuthResponse(string Token, DateTime ExpiresAt, UserDto User, TenantDto Tenant, BranchDto? Branch, string[] Permissions);
public record MeResponse(UserDto User, TenantDto Tenant, BranchDto? Branch, string[] Permissions, PlanInfoDto Plan, UsageDto Usage);
public record PlanInfoDto(string Plan, int UserLimit, int BranchLimit, int ProductLimit, DateTime? TrialEndsAt);
public record UsageDto(int Users, int Branches, int Products, int Customers, int SalesThisMonth, int WhatsAppMessagesThisMonth);
public record BranchMiniDto(Guid Id, string Name);

// ── Users / team ────────────────────────────────────────────────────────────
public record UserDto(Guid Id, string FullName, string Email, string? Phone, string Role, Guid? BranchId,
    string? BranchName, string? AvatarUrl, bool IsActive, string[] Permissions, DateTime? LastLoginAt, DateTime CreatedAt);

public record CreateUserRequest(string FullName, string Email, string Password, string Role, Guid? BranchId,
    string? Phone, string[]? Permissions);

public record UpdateUserRequest(string FullName, string Role, Guid? BranchId, string? Phone, string[]? Permissions, bool IsActive);

public record BranchDto(Guid Id, string Name, string Code, string? Address, string? City, string? Phone,
    bool IsMain, bool IsActive, int UsersCount, DateTime CreatedAt);

public record SaveBranchRequest(string Name, string Code, string? Address, string? City, string? Phone, bool IsMain, bool IsActive = true);

// ── Tenant ──────────────────────────────────────────────────────────────────
public record TenantDto(Guid Id, string Name, string Slug, string Email, string? Phone, string? Address,
    string? City, string? Country, string Currency, string CurrencySymbol, string Locale, string TimeZone,
    string BusinessType, string? LogoUrl, string? Description, string? TaxName, decimal TaxRate, bool TaxIncluded,
    string? BusinessHours, string? PaymentMethods, string? Website, string? Instagram, string Plan, bool IsActive,
    DateTime? TrialEndsAt, DateTime CreatedAt);

public record UpdateTenantRequest(
    string Name, string? Phone, string? Address, string? City, string? Country, string Currency,
    string CurrencySymbol, string? Locale, string? TimeZone, string? BusinessType, string? LogoUrl,
    string? Description, string? TaxName, decimal TaxRate, bool TaxIncluded, string? BusinessHours,
    string? PaymentMethods, string? Website, string? Instagram);

// ── Catalog ─────────────────────────────────────────────────────────────────
public record CategoryDto(Guid Id, string Name, string? Description, string Color, string? Icon, bool IsActive, int ProductCount);
public record SaveCategoryRequest(string Name, string? Description, string? Color, string? Icon, bool IsActive = true);

public record VariantDto(Guid Id, string Name, string? Sku, decimal? Price, int Stock, bool IsActive);
public record SaveVariantRequest(Guid? Id, string Name, string? Sku, decimal? Price, int Stock, bool IsActive = true);

public record ProductDto(Guid Id, string Name, string Sku, string? Barcode, string? Description, Guid? CategoryId,
    string? CategoryName, string? CategoryColor, string Type, decimal Price, decimal Cost, decimal? CompareAtPrice,
    string Unit, string? ImageUrl, string? Brand, bool IsActive, bool TrackStock, int Stock, int MinStock,
    string? Tags, decimal Margin, bool IsLowStock, DateTime CreatedAt, List<VariantDto> Variants);

public record SaveProductRequest(string Name, string Sku, string? Barcode, string? Description, Guid? CategoryId,
    string? Type, decimal Price, decimal Cost, decimal? CompareAtPrice, string? Unit, string? ImageUrl,
    string? Brand, bool IsActive, bool TrackStock, int Stock, int MinStock, string? Tags,
    List<SaveVariantRequest>? Variants);

// ── Inventory ───────────────────────────────────────────────────────────────
public record InventoryMovementDto(Guid Id, Guid ProductId, string? ProductName, string? VariantName, string Type,
    int Quantity, int PreviousStock, int NewStock, string? Reference, string? Notes, string? BranchName,
    string? UserName, DateTime CreatedAt);

public record CreateMovementRequest(Guid ProductId, Guid? VariantId, string Type, int Quantity, string? Notes, Guid? BranchId);
public record InventorySummaryDto(int Products, int StockUnits, decimal StockValue, decimal RetailValue,
    int LowStock, int OutOfStock, List<StockByCategoryDto> ByCategory);
public record StockByCategoryDto(string Name, string Color, int Products, int Units, decimal Value);

// ── Customers / suppliers ───────────────────────────────────────────────────
public record CustomerDto(Guid Id, string Name, string? DocumentNumber, string? Email, string? Phone,
    string? Address, string? Notes, string? Tags, int LoyaltyPoints, bool IsActive, DateTime CreatedAt,
    int Purchases, decimal TotalSpent, DateTime? LastPurchaseAt);

public record SaveCustomerRequest(string Name, string? DocumentNumber, string? Email, string? Phone,
    string? Address, string? Notes, string? Tags, bool IsActive = true);

public record SupplierDto(Guid Id, string Name, string? ContactName, string? DocumentNumber, string? Email,
    string? Phone, string? Address, string? Notes, bool IsActive, DateTime CreatedAt, int ProductsSupplied);

public record SaveSupplierRequest(string Name, string? ContactName, string? DocumentNumber, string? Email,
    string? Phone, string? Address, string? Notes, bool IsActive = true);

// ── Sales ───────────────────────────────────────────────────────────────────
public record SaleItemDto(Guid Id, Guid ProductId, Guid? VariantId, string ProductName, string? VariantName,
    string? Sku, int Quantity, decimal UnitPrice, decimal UnitCost, decimal Discount, decimal Total);

public record SaleDto(Guid Id, string Number, Guid? BranchId, string? BranchName, Guid? CustomerId,
    string? CustomerName, Guid? UserId, string? UserName, decimal Subtotal, decimal Discount, decimal Tax,
    decimal Total, decimal PaidAmount, decimal Change, string PaymentMethod, string Status, string? Notes,
    string? Channel, DateTime CreatedAt, DateTime? CancelledAt, string? CancelReason, int ItemCount,
    List<SaleItemDto> Items);

public record SaleSummaryDto(Guid Id, string Number, string? CustomerName, string? UserName, string? BranchName,
    decimal Total, string PaymentMethod, string Status, string? Channel, int ItemCount, DateTime CreatedAt);

public record CreateSaleItemRequest(Guid ProductId, Guid? VariantId, int Quantity, decimal? UnitPrice, decimal? Discount);
public record CreateSaleRequest(Guid? CustomerId, Guid? BranchId, Guid? UserId, List<CreateSaleItemRequest> Items,
    decimal Discount, string PaymentMethod, decimal? PaidAmount, string? Notes, string? Channel);

public record CancelSaleRequest(string? Reason);
public record SalesSummaryDto(decimal Total, int Count, decimal Average, decimal Tax, decimal Discount,
    List<PaymentTotalDto> ByPayment);
public record PaymentTotalDto(string Method, decimal Total, int Count);

// ── Expenses ────────────────────────────────────────────────────────────────
public record ExpenseDto(Guid Id, string Category, string Description, decimal Amount, DateTime Date,
    string PaymentMethod, Guid? SupplierId, string? SupplierName, Guid? BranchId, string? BranchName,
    string? Notes, bool IsRecurring, DateTime CreatedAt);

public record SaveExpenseRequest(string Category, string Description, decimal Amount, DateTime? Date,
    string PaymentMethod, Guid? SupplierId, Guid? BranchId, string? Notes, bool IsRecurring);

// ── WhatsApp ────────────────────────────────────────────────────────────────
public record WhatsAppAccountDto(Guid Id, string? WabaId, string? PhoneNumberId, string? DisplayPhoneNumber,
    bool HasToken, string VerifyToken, bool IsEnabled, bool AiEnabled, string? AiModel, string WelcomeMessage,
    string FallbackMessage, string HandoffMessage, string? BusinessHoursText, string? LocationText,
    string? PaymentMethodsText, string? ServicesText, string? SystemPrompt, bool AutoReplyEnabled,
    bool ProductLookupEnabled, DateTime? ConnectedAt, bool AiKeyConfigured);

public record SaveWhatsAppAccountRequest(string? WabaId, string? PhoneNumberId, string? DisplayPhoneNumber,
    string? AccessToken, bool IsEnabled, bool AiEnabled, string? AiModel, string WelcomeMessage,
    string FallbackMessage, string HandoffMessage, string? BusinessHoursText, string? LocationText,
    string? PaymentMethodsText, string? ServicesText, string? SystemPrompt, bool AutoReplyEnabled,
    bool ProductLookupEnabled);

public record WhatsAppFaqDto(Guid Id, string Question, string Answer, string? Keywords, int Priority, bool IsActive);
public record SaveFaqRequest(string Question, string Answer, string? Keywords, int Priority, bool IsActive = true);

public record WhatsAppContactDto(Guid Id, string WaId, string? Name, string? Phone, int UnreadCount, bool IsBlocked);
public record ConversationDto(Guid Id, Guid ContactId, string ContactName, string? ContactPhone, string? AvatarUrl,
    string Status, Guid? AssignedUserId, string? AssignedUserName, string? LastMessagePreview,
    DateTime LastMessageAt, int MessageCount, int UnreadCount, string? Tags);
public record MessageDto(Guid Id, Guid ConversationId, string Direction, string Body, string? Type,
    string? MediaUrl, string? Status, bool IsAutomated, string? Intent, string? SentByName, DateTime CreatedAt);
public record ConversationDetailDto(ConversationDto Conversation, List<MessageDto> Messages);
public record SendMessageRequest(string Body);
public record HandoffRequest(Guid? UserId);

public record WhatsAppStatsDto(int TotalConversations, int OpenConversations, int HumanConversations,
    int AutomatedMessages, int InboundMessages, int OutboundMessages, decimal AutomationRate,
    int ActiveContacts, List<DailyCountDto> Daily, List<IntentCountDto> TopIntents);
public record DailyCountDto(string Date, int Inbound, int Outbound);
public record IntentCountDto(string Intent, int Count);
public record SimulateRequest(string Message);
public record BotReplyDto(string Reply, string Intent, bool Handoff, List<BotProductDto> Products);
public record BotProductDto(Guid Id, string Name, decimal Price, int Stock, string? ImageUrl, string? Sku);
public record TestSendRequest(string To, string Message);
public record WhatsAppWebhookInfoDto(string WebhookUrl, string VerifyToken, string GraphVersion, bool Connected);

// ── Reports / dashboard ─────────────────────────────────────────────────────
public record KpiDto(decimal Value, decimal? Previous, decimal? Change);
public record DashboardDto(decimal SalesToday, decimal SalesYesterday, decimal SalesMonth, decimal SalesPreviousMonth,
    int OrdersToday, int OrdersMonth, decimal AverageTicket, decimal AverageTicketPrevious, int NewCustomersMonth,
    int TotalCustomers, int LowStockCount, int OutOfStockCount, decimal InventoryValue, decimal ExpensesMonth,
    decimal ProfitMonth, decimal SalesChange, int WhatsAppOpen, int WhatsAppAutomated, int PendingSales,
    List<DailySalesDto> SalesSeries, List<CategorySalesDto> CategorySales, List<TopProductDto> TopProducts,
    List<SaleSummaryDto> RecentSales, List<LowStockItemDto> LowStock, List<PaymentTotalDto> PaymentBreakdown);
public record DailySalesDto(string Date, decimal Sales, int Orders);
public record CategorySalesDto(string Name, string Color, decimal Total, int Quantity);
public record TopProductDto(Guid Id, string Name, string? ImageUrl, string? CategoryName, int Quantity, decimal Total);
public record LowStockItemDto(Guid Id, string Name, string? ImageUrl, int Stock, int MinStock, string? CategoryName, decimal Price);

public record SalesReportDto(DateTime From, DateTime To, decimal Total, int Count, decimal Average, decimal Tax,
    decimal Discount, decimal Cost, decimal Profit, List<DailySalesDto> Series, List<PaymentTotalDto> ByPayment,
    List<CategorySalesDto> ByCategory, List<TopProductDto> TopProducts, List<SellerReportDto> BySeller,
    List<BranchReportDto> ByBranch, List<SaleSummaryDto> Sales);
public record SellerReportDto(Guid? UserId, string Name, int Orders, decimal Total);
public record BranchReportDto(Guid? BranchId, string Name, int Orders, decimal Total);

public record InventoryReportDto(InventorySummaryDto Summary, List<CategoryInventoryDto> ByCategory,
    List<LowStockItemDto> LowStock, List<InventoryMovementDto> RecentMovements,
    List<MovementTypeTotalDto> MovementTotals);
public record CategoryInventoryDto(string Name, string Color, int Units, decimal CostValue, decimal RetailValue);
public record MovementTypeTotalDto(string Type, int Count, int Units);

public record ProfitReportDto(DateTime From, DateTime To, decimal Revenue, decimal Cost, decimal GrossProfit,
    decimal Expenses, decimal NetProfit, decimal Margin, List<DailyProfitDto> Series, List<ExpenseCategoryDto> ExpenseCategories);
public record DailyProfitDto(string Date, decimal Revenue, decimal Cost, decimal Expenses);
public record ExpenseCategoryDto(string Category, decimal Total, int Count);
