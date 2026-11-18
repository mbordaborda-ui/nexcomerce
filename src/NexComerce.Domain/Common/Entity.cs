namespace NexComerce.Domain.Common;

public abstract class Entity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

/// <summary>
/// Base class for every entity that belongs to a tenant. The TenantId is enforced
/// by the DbContext (query filters + write guards) so data can never leak between businesses.
/// </summary>
public abstract class TenantEntity : Entity, ITenantScoped
{
    public Guid TenantId { get; set; }
}

public interface ITenantScoped
{
    Guid TenantId { get; set; }
}
