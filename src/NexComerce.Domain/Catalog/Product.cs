using NexComerce.Domain.Common;

namespace NexComerce.Domain.Catalog;

public class Product : TenantEntity
{
    public string Name { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public string? Barcode { get; set; }
    public string? Description { get; set; }
    public Guid? CategoryId { get; set; }
    public ProductType Type { get; set; } = ProductType.Product;
    public decimal Price { get; set; }
    public decimal Cost { get; set; }
    public decimal? CompareAtPrice { get; set; }
    public string Unit { get; set; } = "unidad";
    public string? ImageUrl { get; set; }
    public string? Brand { get; set; }
    public bool IsActive { get; set; } = true;
    public bool TrackStock { get; set; } = true;
    public int Stock { get; set; }
    public int MinStock { get; set; } = 5;
    public string? Tags { get; set; }

    public Category? Category { get; set; }
    public ICollection<ProductVariant> Variants { get; set; } = [];

    public int TotalStock => Variants.Count > 0 ? Variants.Sum(v => v.Stock) : Stock;
    public bool IsLowStock => TrackStock && Type == ProductType.Product && TotalStock <= MinStock;
}
