namespace NexComerce.Domain.Common;

public enum BusinessType
{
    Retail = 0,
    Clothing = 1,
    Restaurant = 2,
    Minimarket = 3,
    Technology = 4,
    Beauty = 5,
    Hardware = 6,
    Distributor = 7,
    Services = 8,
    Other = 9
}

public enum UserRole
{
    Owner = 0,
    Admin = 1,
    Manager = 2,
    Cashier = 3,
    Warehouse = 4,
    Support = 5
}

public static class Permissions
{
    public const string DashboardView = "dashboard.view";
    public const string ProductsManage = "products.manage";
    public const string InventoryManage = "inventory.manage";
    public const string SalesManage = "sales.manage";
    public const string CustomersManage = "customers.manage";
    public const string SuppliersManage = "suppliers.manage";
    public const string ExpensesManage = "expenses.manage";
    public const string EmployeesManage = "employees.manage";
    public const string ReportsView = "reports.view";
    public const string SettingsManage = "settings.manage";
    public const string WhatsAppManage = "whatsapp.manage";

    public static readonly string[] All =
    [
        DashboardView, ProductsManage, InventoryManage, SalesManage, CustomersManage,
        SuppliersManage, ExpensesManage, EmployeesManage, ReportsView, SettingsManage, WhatsAppManage
    ];

    public static string[] DefaultFor(UserRole role) => role switch
    {
        UserRole.Owner or UserRole.Admin => All,
        UserRole.Manager => [DashboardView, ProductsManage, InventoryManage, SalesManage, CustomersManage, SuppliersManage, ExpensesManage, ReportsView, WhatsAppManage],
        UserRole.Cashier => [DashboardView, SalesManage, CustomersManage],
        UserRole.Warehouse => [DashboardView, ProductsManage, InventoryManage],
        UserRole.Support => [DashboardView, CustomersManage, WhatsAppManage],
        _ => [DashboardView]
    };
}

public enum ProductType
{
    Product = 0,
    Service = 1
}

public enum MovementType
{
    In = 0,
    Out = 1,
    Adjustment = 2,
    Sale = 3,
    Return = 4,
    Transfer = 5
}

public enum SaleStatus
{
    Completed = 0,
    Pending = 1,
    Cancelled = 2
}

public enum PaymentMethod
{
    Cash = 0,
    Card = 1,
    Transfer = 2,
    Nequi = 3,
    Daviplata = 4,
    Credit = 5,
    Other = 6
}

public enum ConversationStatus
{
    Bot = 0,
    Human = 1,
    Closed = 2
}

public enum MessageDirection
{
    Inbound = 0,
    Outbound = 1
}

public enum Plan
{
    Starter = 0,
    Growth = 1,
    Business = 2
}
