using Microsoft.EntityFrameworkCore;
using NexComerce.Domain.Billing;
using NexComerce.Domain.Common;
using NexComerce.Domain.Operations;
using NexComerce.Domain.Sales;
using NexComerce.Infrastructure.Persistence;

namespace NexComerce.Api.Infrastructure;

/// <summary>Small cross-module helpers so sales, cash, receivables and orders stay consistent.</summary>
public static class BusinessOperations
{
    public static async Task<Subscription> EnsureSubscriptionAsync(AppDbContext db, Guid tenantId)
    {
        var subscription = await db.Subscriptions.FirstOrDefaultAsync(s => s.TenantId == tenantId);
        if (subscription is not null) return subscription;

        var tenant = await db.Tenants.FirstAsync(t => t.Id == tenantId);
        var isTrial = tenant.TrialEndsAt.HasValue && tenant.TrialEndsAt.Value > DateTime.UtcNow;
        var price = BillingCatalog.PriceFor(tenant.Plan, BillingCycle.Monthly);
        subscription = new Subscription
        {
            TenantId = tenantId,
            Plan = tenant.Plan,
            Cycle = BillingCycle.Monthly,
            Status = isTrial ? SubscriptionStatus.Trialing : SubscriptionStatus.Active,
            TrialEndsAt = tenant.TrialEndsAt,
            CurrentPeriodStart = DateTime.UtcNow,
            CurrentPeriodEnd = tenant.TrialEndsAt ?? DateTime.UtcNow.AddDays(30),
            BasePrice = price,
            Total = price,
            PaymentMethod = "Sin método de pago",
            PaymentChannel = null,
            Notes = "Suscripción creada automáticamente. Checkout en modo demostración."
        };
        db.Subscriptions.Add(subscription);
        await db.SaveChangesAsync();
        return subscription;
    }

    /// <summary>Register a cash sale in the open cash session of the branch (or the tenant's latest one).</summary>
    public static async Task AddCashFromSaleAsync(AppDbContext db, Sale sale, Guid? userId, string? userName)
    {
        if (sale.PaymentMethod != PaymentMethod.Cash) return;
        var session = await db.CashSessions
            .Where(s => s.Status == CashSessionStatus.Open && (sale.BranchId == null || s.BranchId == sale.BranchId))
            .OrderByDescending(s => s.OpenedAt)
            .FirstOrDefaultAsync();
        if (session is null) return;

        session.SalesAmount += sale.Total;
        session.ExpectedAmount = session.OpeningAmount + session.SalesAmount + session.IncomeAmount - session.ExpenseAmount;
        db.CashMovements.Add(new CashMovement
        {
            CashSessionId = session.Id,
            Type = CashMovementType.Sale,
            Concept = $"Venta {sale.Number}",
            Amount = sale.Total,
            PaymentMethod = "Cash",
            Reference = sale.Number,
            SaleId = sale.Id,
            UserId = userId,
            UserName = userName,
            Date = DateTime.UtcNow
        });
    }

    /// <summary>Create an accounts-receivable record for a credit sale.</summary>
    public static async Task<Receivable?> CreateReceivableFromSaleAsync(AppDbContext db, Sale sale, int dueDays = 30)
    {
        if (sale.PaymentMethod != PaymentMethod.Credit) return null;
        var receivable = new Receivable
        {
            CustomerId = sale.CustomerId,
            CustomerName = sale.CustomerName ?? "Cliente ocasional",
            SaleId = sale.Id,
            SaleNumber = sale.Number,
            Concept = $"Venta a crédito {sale.Number}",
            Total = sale.Total,
            PaidAmount = Math.Max(0, sale.PaidAmount),
            IssuedAt = DateTime.UtcNow,
            DueDate = DateTime.UtcNow.AddDays(Math.Max(1, dueDays)),
            Status = ReceivableStatus.Pending,
            Notes = "Generada automáticamente desde una venta a crédito."
        };
        if (receivable.PaidAmount > 0)
            receivable.Payments.Add(new ReceivablePayment
            {
                Amount = receivable.PaidAmount,
                Method = "Credit",
                Reference = sale.Number,
                Notes = "Abono inicial registrado con la venta.",
                UserName = sale.UserName
            });
        db.Receivables.Add(receivable);
        return receivable;
    }

    public static async Task<string> NextOrderNumberAsync(AppDbContext db, Guid tenantId)
    {
        var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var sequence = await db.Orders.IgnoreQueryFilters()
            .CountAsync(o => o.TenantId == tenantId && o.CreatedAt >= monthStart) + 1;
        string number;
        do
        {
            number = $"P-{DateTime.UtcNow:yyMM}-{sequence:0000}";
            sequence++;
        } while (await db.Orders.IgnoreQueryFilters().AnyAsync(o => o.TenantId == tenantId && o.Number == number));
        return number;
    }

    public static async Task<string> NextInvoiceNumberAsync(AppDbContext db, Guid tenantId)
    {
        var sequence = await db.SubscriptionInvoices.IgnoreQueryFilters()
            .CountAsync(i => i.TenantId == tenantId) + 1;
        string number;
        do
        {
            number = $"NX-{DateTime.UtcNow:yyyyMM}-{sequence:0000}";
            sequence++;
        } while (await db.SubscriptionInvoices.IgnoreQueryFilters()
            .AnyAsync(i => i.TenantId == tenantId && i.Number == number));
        return number;
    }
}
