namespace NexComerce.Infrastructure.Tenancy;

/// <summary>Ambient tenant for the current request/scope. Set from the JWT or by the WhatsApp webhook.</summary>
public interface ITenantContext
{
    Guid TenantId { get; }
    bool HasTenant { get; }
    void SetTenant(Guid tenantId);
}

public sealed class TenantContext : ITenantContext
{
    public Guid TenantId { get; private set; }
    public bool HasTenant => TenantId != Guid.Empty;

    public void SetTenant(Guid tenantId) => TenantId = tenantId;
}
