using NexComerce.Domain.Common;

namespace NexComerce.Domain.Sales;

public class Sale : TenantEntity
{
    public string Number { get; set; } = string.Empty;
    public Guid? BranchId { get; set; }
    public Guid? CustomerId { get; set; }
    public string? CustomerName { get; set; }
    public Guid? UserId { get; set; }
    public string? UserName { get; set; }
    public decimal Subtotal { get; set; }
    public decimal Discount { get; set; }
    public decimal Tax { get; set; }
    public decimal Total { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal Change { get; set; }
    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.Cash;
    public SaleStatus Status { get; set; } = SaleStatus.Completed;
    public string? Notes { get; set; }
    public string? Channel { get; set; } = "POS";
    public DateTime? CancelledAt { get; set; }
    public string? CancelReason { get; set; }

    public ICollection<SaleItem> Items { get; set; } = [];
}

public class SaleItem : TenantEntity
{
    public Guid SaleId { get; set; }
    public Guid ProductId { get; set; }
    public Guid? VariantId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? VariantName { get; set; }
    public string? Sku { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal UnitCost { get; set; }
    public decimal Discount { get; set; }
    public decimal Total { get; set; }

    public Sale? Sale { get; set; }
}
