using NexComerce.Api.Contracts;
using NexComerce.Domain.Billing;
using NexComerce.Domain.Catalog;
using NexComerce.Domain.Common;
using NexComerce.Domain.Contacts;
using NexComerce.Domain.Finance;
using NexComerce.Domain.Inventory;
using NexComerce.Domain.Operations;
using NexComerce.Domain.Sales;
using NexComerce.Domain.Tenancy;
using NexComerce.Domain.WhatsApp;

namespace NexComerce.Api.Infrastructure;

public static class Map
{
    public static UserDto ToDto(this User u, string? branchName = null) => new(
        u.Id, u.FullName, u.Email, u.Phone, u.Role.ToString(), u.BranchId, branchName, u.AvatarUrl,
        u.IsActive, u.PermissionList(), u.LastLoginAt, u.CreatedAt);

    public static BranchDto ToDto(this Branch b, int usersCount = 0) => new(
        b.Id, b.Name, b.Code, b.Address, b.City, b.Phone, b.IsMain, b.IsActive, usersCount, b.CreatedAt);

    public static TenantDto ToDto(this Tenant t) => new(
        t.Id, t.Name, t.Slug, t.Email, t.Phone, t.Address, t.City, t.Country, t.Currency, t.CurrencySymbol,
        t.Locale, t.TimeZone, t.BusinessType.ToString(), t.LogoUrl, t.Description, t.TaxName, t.TaxRate,
        t.TaxIncluded, t.BusinessHours, t.PaymentMethods, t.Website, t.Instagram, t.Plan.ToString(),
        t.IsActive, t.TrialEndsAt, t.CreatedAt);

    public static CategoryDto ToDto(this Category c, int productCount = 0) => new(
        c.Id, c.Name, c.Description, c.Color, c.Icon, c.IsActive, productCount);

    public static VariantDto ToDto(this ProductVariant v) => new(v.Id, v.Name, v.Sku, v.Price, v.Stock, v.IsActive);

    public static ProductDto ToDto(this Product p)
    {
        var stock = p.Variants.Count > 0 ? p.Variants.Sum(v => v.Stock) : p.Stock;
        var margin = p.Price > 0 ? Math.Round((p.Price - p.Cost) / p.Price * 100, 1) : 0;
        return new ProductDto(
            p.Id, p.Name, p.Sku, p.Barcode, p.Description, p.CategoryId, p.Category?.Name, p.Category?.Color,
            p.Type.ToString(), p.Price, p.Cost, p.CompareAtPrice, p.Unit, p.ImageUrl, p.Brand, p.IsActive,
            p.TrackStock, stock, p.MinStock, p.Tags, margin,
            p.TrackStock && p.Type == ProductType.Product && stock <= p.MinStock,
            p.CreatedAt, p.Variants.OrderBy(v => v.Name).Select(v => v.ToDto()).ToList());
    }

    public static InventoryMovementDto ToDto(this InventoryMovement m, string? branchName = null, string? variantName = null) => new(
        m.Id, m.ProductId, m.ProductName, variantName, m.Type.ToString(), m.Quantity, m.PreviousStock,
        m.NewStock, m.Reference, m.Notes, branchName, m.UserName, m.CreatedAt);

    public static CustomerDto ToDto(this Customer c, int purchases = 0, decimal totalSpent = 0, DateTime? lastPurchase = null) => new(
        c.Id, c.Name, c.DocumentNumber, c.Email, c.Phone, c.Address, c.Notes, c.Tags, c.LoyaltyPoints,
        c.IsActive, c.CreatedAt, purchases, totalSpent, lastPurchase);

    public static SupplierDto ToDto(this Supplier s) => new(
        s.Id, s.Name, s.ContactName, s.DocumentNumber, s.Email, s.Phone, s.Address, s.Notes,
        s.IsActive, s.CreatedAt, 0);

    public static SaleItemDto ToDto(this SaleItem i) => new(
        i.Id, i.ProductId, i.VariantId, i.ProductName, i.VariantName, i.Sku, i.Quantity, i.UnitPrice,
        i.UnitCost, i.Discount, i.Total);

    public static SaleDto ToDto(this Sale s, string? branchName = null) => new(
        s.Id, s.Number, s.BranchId, branchName, s.CustomerId, s.CustomerName, s.UserId, s.UserName,
        s.Subtotal, s.Discount, s.Tax, s.Total, s.PaidAmount, s.Change, s.PaymentMethod.ToString(),
        s.Status.ToString(), s.Notes, s.Channel, s.CreatedAt, s.CancelledAt, s.CancelReason,
        s.Items.Count, s.Items.Select(i => i.ToDto()).ToList());

    public static SaleSummaryDto ToSummary(this Sale s, string? branchName = null) => new(
        s.Id, s.Number, s.CustomerName, s.UserName, branchName, s.Total, s.PaymentMethod.ToString(),
        s.Status.ToString(), s.Channel, s.Items.Count, s.CreatedAt);

    public static ExpenseDto ToDto(this Expense e, string? supplierName = null, string? branchName = null) => new(
        e.Id, e.Category, e.Description, e.Amount, e.Date, e.PaymentMethod.ToString(), e.SupplierId,
        supplierName, e.BranchId, branchName, e.Notes, e.IsRecurring, e.CreatedAt);

    public static WhatsAppAccountDto ToDto(this WhatsAppAccount a, bool aiKeyConfigured) => new(
        a.Id, a.WabaId, a.PhoneNumberId, a.DisplayPhoneNumber, !string.IsNullOrEmpty(a.AccessToken),
        a.VerifyToken, a.IsEnabled, a.AiEnabled, a.AiModel, a.WelcomeMessage, a.FallbackMessage,
        a.HandoffMessage, a.BusinessHoursText, a.LocationText, a.PaymentMethodsText, a.ServicesText,
        a.SystemPrompt, a.AutoReplyEnabled, a.ProductLookupEnabled, a.ConnectedAt, aiKeyConfigured);

    public static WhatsAppFaqDto ToDto(this WhatsAppFaq f) => new(
        f.Id, f.Question, f.Answer, f.Keywords, f.Priority, f.IsActive);

    public static WhatsAppContactDto ToDto(this WhatsAppContact c) => new(
        c.Id, c.WaId, c.Name, c.Phone, c.UnreadCount, c.IsBlocked);

    public static ConversationDto ToDto(this Conversation c) => new(
        c.Id, c.ContactId, c.Contact?.Name ?? "Contacto", c.Contact?.Phone, c.Contact?.AvatarUrl,
        c.Status.ToString(), c.AssignedUserId, c.AssignedUserName, c.LastMessagePreview,
        c.LastMessageAt, c.MessageCount, c.Contact?.UnreadCount ?? 0, c.Tags);

    public static MessageDto ToDto(this Message m) => new(
        m.Id, m.ConversationId, m.Direction.ToString(), m.Body, m.Type, m.MediaUrl, m.Status,
        m.IsAutomated, m.Intent, m.SentByName, m.CreatedAt);

    // ── Billing ─────────────────────────────────────────────────────────────
    public static SubscriptionDto ToDto(this Subscription s)
    {
        var daysLeft = Math.Max(0, (int)Math.Ceiling((s.CurrentPeriodEnd - DateTime.UtcNow).TotalDays));
        return new SubscriptionDto(
            s.Plan.ToString(), s.Status.ToString(), s.Cycle.ToString(), s.CurrentPeriodStart, s.CurrentPeriodEnd,
            s.TrialEndsAt, s.BasePrice, s.AddonsPrice, s.Discount, s.Total,
            SplitAddons(s.Addons), s.CancelAtPeriodEnd, s.PaymentMethod, s.PaymentChannel, s.LastPaymentAt,
            s.LastInvoiceNumber, daysLeft, s.Status == SubscriptionStatus.Trialing);
    }

    public static List<string> SplitAddons(string? addons) =>
        string.IsNullOrWhiteSpace(addons)
            ? []
            : addons.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();

    public static SubscriptionInvoiceDto ToDto(this SubscriptionInvoice i) => new(
        i.Id, i.Number, i.Plan, i.Cycle.ToString(), i.Subtotal, i.Addons, i.Discount, i.Tax, i.Total,
        i.Status.ToString(), i.IssuedAt, i.DueAt, i.PaidAt, i.PaymentMethod, i.PaymentChannel, i.Reference,
        i.CouponCode, i.Description, i.AddonList);

    // ── Caja ────────────────────────────────────────────────────────────────
    public static CashMovementDto ToDto(this CashMovement m) => new(
        m.Id, m.Type.ToString(), m.Concept, m.Amount, m.PaymentMethod, m.Reference, m.SaleId, m.UserName, m.Date);

    public static CashSessionDto ToDto(this CashSession s) => new(
        s.Id, s.BranchId, s.BranchName, s.UserName, s.OpenedAt, s.ClosedAt, s.OpeningAmount, s.SalesAmount,
        s.IncomeAmount, s.ExpenseAmount, s.ExpectedAmount, s.CountedAmount, s.Difference, s.Status.ToString(),
        s.Notes, s.Movements.OrderByDescending(m => m.Date).Select(m => m.ToDto()).ToList());

    // ── Cuentas por cobrar ─────────────────────────────────────────────────
    public static ReceivablePaymentDto ToDto(this ReceivablePayment p) => new(
        p.Id, p.Amount, p.Date, p.Method, p.Reference, p.Notes, p.UserName);

    public static ReceivableDto ToDto(this Receivable r)
    {
        var balance = Math.Max(0, r.Total - r.PaidAmount);
        var status = r.Status == ReceivableStatus.Cancelled
            ? ReceivableStatus.Cancelled
            : balance <= 0.009m
                ? ReceivableStatus.Paid
                : r.PaidAmount > 0 ? ReceivableStatus.Partial : ReceivableStatus.Pending;
        var daysOverdue = balance > 0 && r.DueDate.Date < DateTime.UtcNow.Date
            ? (int)(DateTime.UtcNow.Date - r.DueDate.Date).TotalDays
            : 0;
        return new ReceivableDto(
            r.Id, r.CustomerId, r.CustomerName, r.CustomerPhone, r.SaleId, r.SaleNumber, r.Concept,
            r.Total, r.PaidAmount, balance, r.IssuedAt, r.DueDate, r.PaidAt, status.ToString(), daysOverdue,
            r.Notes, r.Payments.OrderByDescending(p => p.Date).Select(p => p.ToDto()).ToList());
    }

    // ── Pedidos ─────────────────────────────────────────────────────────────
    public static OrderItemDto ToDto(this OrderItem i) => new(
        i.Id, i.ProductId, i.ProductName, i.Quantity, i.UnitPrice, i.Total, i.Notes);

    public static OrderDto ToDto(this Order o) => new(
        o.Id, o.Number, o.Channel.ToString(), o.Status.ToString(), o.CustomerId, o.CustomerName, o.CustomerPhone,
        o.Total, o.DueAt, o.DeliveredAt, o.SaleId, o.SaleNumber, o.Notes, o.CreatedAt, o.Items.Count,
        o.Items.Select(i => i.ToDto()).ToList());
}
