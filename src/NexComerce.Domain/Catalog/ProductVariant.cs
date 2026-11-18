using NexComerce.Domain.Common;

namespace NexComerce.Domain.Catalog;

public class ProductVariant : TenantEntity
{
    public Guid ProductId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Sku { get; set; }
    public decimal? Price { get; set; }
    public int Stock { get; set; }
    public bool IsActive { get; set; } = true;

    public Product? Product { get; set; }
}
