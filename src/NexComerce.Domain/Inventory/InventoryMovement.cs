using NexComerce.Domain.Common;

namespace NexComerce.Domain.Inventory;

public class InventoryMovement : TenantEntity
{
    public Guid ProductId { get; set; }
    public Guid? VariantId { get; set; }
    public Guid? BranchId { get; set; }
    public MovementType Type { get; set; }
    public int Quantity { get; set; }
    public int PreviousStock { get; set; }
    public int NewStock { get; set; }
    public string? Reference { get; set; }
    public string? Notes { get; set; }
    public Guid? UserId { get; set; }
    public string? ProductName { get; set; }
    public string? UserName { get; set; }
}
