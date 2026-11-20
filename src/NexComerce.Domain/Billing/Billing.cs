using NexComerce.Domain.Common;

namespace NexComerce.Domain.Billing;

public enum SubscriptionStatus
{
    Trialing = 0,
    Active = 1,
    PastDue = 2,
    Cancelled = 3
}

public enum BillingCycle
{
    Monthly = 0,
    Annual = 1
}

public enum InvoiceStatus
{
    Pending = 0,
    Paid = 1,
    Failed = 2,
    Refunded = 3
}

public enum PaymentChannel
{
    Card = 0,
    Transfer = 1,
    Qr = 2,
    Cash = 3
}

/// <summary>
/// Subscription state for the current tenant. The demo checkout flow writes here;
/// a real PSP integration can keep the same shape and only replace the simulation.
/// </summary>
public class Subscription : TenantEntity
{
    public Plan Plan { get; set; } = Plan.Starter;
    public BillingCycle Cycle { get; set; } = BillingCycle.Monthly;
    public SubscriptionStatus Status { get; set; } = SubscriptionStatus.Trialing;
    public DateTime CurrentPeriodStart { get; set; } = DateTime.UtcNow;
    public DateTime CurrentPeriodEnd { get; set; } = DateTime.UtcNow.AddDays(30);
    public DateTime? TrialEndsAt { get; set; }
    public DateTime? CancelledAt { get; set; }
    public DateTime? LastPaymentAt { get; set; }

    public decimal BasePrice { get; set; }
    public decimal AddonsPrice { get; set; }
    public decimal Discount { get; set; }
    public decimal Total { get; set; }

    /// <summary>Comma separated add-on ids (profitability, whatsapp, users, branches, ai).</summary>
    public string? Addons { get; set; }
    public string? PaymentMethod { get; set; }
    public string? PaymentChannel { get; set; }
    public string? LastInvoiceNumber { get; set; }
    public bool CancelAtPeriodEnd { get; set; }
    public string? Notes { get; set; }

    public ICollection<SubscriptionInvoice> Invoices { get; set; } = [];
}

public class SubscriptionInvoice : TenantEntity
{
    public string Number { get; set; } = string.Empty;
    public string Plan { get; set; } = "Starter";
    public BillingCycle Cycle { get; set; } = BillingCycle.Monthly;
    public decimal Subtotal { get; set; }
    public decimal Addons { get; set; }
    public decimal Discount { get; set; }
    public decimal Tax { get; set; }
    public decimal Total { get; set; }
    public InvoiceStatus Status { get; set; } = InvoiceStatus.Pending;
    public DateTime IssuedAt { get; set; } = DateTime.UtcNow;
    public DateTime DueAt { get; set; } = DateTime.UtcNow;
    public DateTime? PaidAt { get; set; }
    public string? PaymentMethod { get; set; }
    public string? PaymentChannel { get; set; }
    public string? Reference { get; set; }
    public string? CouponCode { get; set; }
    public string? Description { get; set; }
    public string? AddonList { get; set; }
}
