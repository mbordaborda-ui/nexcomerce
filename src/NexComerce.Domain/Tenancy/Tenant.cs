using NexComerce.Domain.Common;

namespace NexComerce.Domain.Tenancy;

public class Tenant : Entity
{
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; } = "Colombia";
    public string Currency { get; set; } = "USD";
    public string CurrencySymbol { get; set; } = "$";
    public string Locale { get; set; } = "es";
    public string TimeZone { get; set; } = "America/Bogota";
    public BusinessType BusinessType { get; set; } = BusinessType.Retail;
    public string? LogoUrl { get; set; }
    public string? Description { get; set; }
    public string? TaxName { get; set; } = "IVA";
    public decimal TaxRate { get; set; }
    public bool TaxIncluded { get; set; }
    public string? BusinessHours { get; set; }
    public string? PaymentMethods { get; set; }
    public string? Website { get; set; }
    public string? Instagram { get; set; }
    public Plan Plan { get; set; } = Plan.Starter;
    public bool IsActive { get; set; } = true;
    public DateTime? TrialEndsAt { get; set; }

    public ICollection<User> Users { get; set; } = [];
    public ICollection<Branch> Branches { get; set; } = [];
}
