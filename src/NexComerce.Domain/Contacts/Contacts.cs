using NexComerce.Domain.Common;

namespace NexComerce.Domain.Contacts;

public class Customer : TenantEntity
{
    public string Name { get; set; } = string.Empty;
    public string? DocumentNumber { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? Notes { get; set; }
    public string? Tags { get; set; }
    public int LoyaltyPoints { get; set; }
    public bool IsActive { get; set; } = true;
}

public class Supplier : TenantEntity
{
    public string Name { get; set; } = string.Empty;
    public string? ContactName { get; set; }
    public string? DocumentNumber { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
}
