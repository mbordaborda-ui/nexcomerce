using NexComerce.Domain.Common;

namespace NexComerce.Domain.Operations;

// ── Caja (cash register) ────────────────────────────────────────────────────
public enum CashSessionStatus
{
    Open = 0,
    Closed = 1
}

public enum CashMovementType
{
    Opening = 0,
    Sale = 1,
    Income = 2,
    Expense = 3,
    Withdrawal = 4,
    Adjustment = 5
}

public class CashSession : TenantEntity
{
    public Guid? BranchId { get; set; }
    public string? BranchName { get; set; }
    public Guid? UserId { get; set; }
    public string? UserName { get; set; }
    public DateTime OpenedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ClosedAt { get; set; }
    public decimal OpeningAmount { get; set; }
    public decimal SalesAmount { get; set; }
    public decimal IncomeAmount { get; set; }
    public decimal ExpenseAmount { get; set; }
    public decimal ExpectedAmount { get; set; }
    public decimal? CountedAmount { get; set; }
    public decimal Difference { get; set; }
    public CashSessionStatus Status { get; set; } = CashSessionStatus.Open;
    public string? Notes { get; set; }

    public ICollection<CashMovement> Movements { get; set; } = [];
}

public class CashMovement : TenantEntity
{
    public Guid CashSessionId { get; set; }
    public CashMovementType Type { get; set; } = CashMovementType.Income;
    public string Concept { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string? PaymentMethod { get; set; }
    public string? Reference { get; set; }
    public Guid? SaleId { get; set; }
    public Guid? UserId { get; set; }
    public string? UserName { get; set; }
    public DateTime Date { get; set; } = DateTime.UtcNow;

    public CashSession? CashSession { get; set; }
}

// ── Cuentas por cobrar (accounts receivable) ────────────────────────────────
public enum ReceivableStatus
{
    Pending = 0,
    Partial = 1,
    Paid = 2,
    Cancelled = 3
}

public class Receivable : TenantEntity
{
    public Guid? CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string? CustomerPhone { get; set; }
    public Guid? SaleId { get; set; }
    public string? SaleNumber { get; set; }
    public string Concept { get; set; } = "Venta a crédito";
    public decimal Total { get; set; }
    public decimal PaidAmount { get; set; }
    public DateTime IssuedAt { get; set; } = DateTime.UtcNow;
    public DateTime DueDate { get; set; } = DateTime.UtcNow.AddDays(30);
    public DateTime? PaidAt { get; set; }
    public ReceivableStatus Status { get; set; } = ReceivableStatus.Pending;
    public string? Notes { get; set; }

    public ICollection<ReceivablePayment> Payments { get; set; } = [];
}

public class ReceivablePayment : TenantEntity
{
    public Guid ReceivableId { get; set; }
    public decimal Amount { get; set; }
    public DateTime Date { get; set; } = DateTime.UtcNow;
    public string? Method { get; set; }
    public string? Reference { get; set; }
    public string? Notes { get; set; }
    public Guid? UserId { get; set; }
    public string? UserName { get; set; }

    public Receivable? Receivable { get; set; }
}

// ── Pedidos (orders from WhatsApp, Instagram and counter) ───────────────────
public enum OrderChannel
{
    WhatsApp = 0,
    Instagram = 1,
    Counter = 2,
    Phone = 3,
    Other = 4
}

public enum OrderStatus
{
    Pending = 0,
    Confirmed = 1,
    Preparing = 2,
    Ready = 3,
    Delivered = 4,
    Cancelled = 5
}

public class Order : TenantEntity
{
    public string Number { get; set; } = string.Empty;
    public OrderChannel Channel { get; set; } = OrderChannel.Counter;
    public OrderStatus Status { get; set; } = OrderStatus.Pending;
    public Guid? CustomerId { get; set; }
    public string CustomerName { get; set; } = "Cliente ocasional";
    public string? CustomerPhone { get; set; }
    public Guid? BranchId { get; set; }
    public decimal Total { get; set; }
    public DateTime? DueAt { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public Guid? SaleId { get; set; }
    public string? SaleNumber { get; set; }
    public string? Notes { get; set; }

    public ICollection<OrderItem> Items { get; set; } = [];
}

public class OrderItem : TenantEntity
{
    public Guid OrderId { get; set; }
    public Guid? ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public int Quantity { get; set; } = 1;
    public decimal UnitPrice { get; set; }
    public decimal Total { get; set; }
    public string? Notes { get; set; }

    public Order? Order { get; set; }
}
