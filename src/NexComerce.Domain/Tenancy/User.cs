using NexComerce.Domain.Common;

namespace NexComerce.Domain.Tenancy;

public class User : TenantEntity
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? AvatarUrl { get; set; }
    public UserRole Role { get; set; } = UserRole.Cashier;
    public Guid? BranchId { get; set; }
    public string Permissions { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime? LastLoginAt { get; set; }

    public Tenant? Tenant { get; set; }
    public Branch? Branch { get; set; }

    public string[] PermissionList() =>
        Permissions.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}
