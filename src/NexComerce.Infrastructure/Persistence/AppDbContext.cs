using Microsoft.EntityFrameworkCore;
using NexComerce.Domain.Audit;
using NexComerce.Domain.Billing;
using NexComerce.Domain.Catalog;
using NexComerce.Domain.Common;
using NexComerce.Domain.Contacts;
using NexComerce.Domain.Finance;
using NexComerce.Domain.Inventory;
using NexComerce.Domain.Operations;
using NexComerce.Domain.Sales;
using NexComerce.Domain.Tenancy;
using NexComerce.Domain.WhatsApp;
using NexComerce.Infrastructure.Tenancy;

namespace NexComerce.Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options, ITenantContext tenantContext) : DbContext(options)
{
    private readonly ITenantContext _tenantContext = tenantContext;

    public Guid CurrentTenantId => _tenantContext.TenantId;
    public bool TenantBypass { get; set; }

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();
    public DbSet<InventoryMovement> InventoryMovements => Set<InventoryMovement>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<Sale> Sales => Set<Sale>();
    public DbSet<SaleItem> SaleItems => Set<SaleItem>();
    public DbSet<Expense> Expenses => Set<Expense>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<WhatsAppAccount> WhatsAppAccounts => Set<WhatsAppAccount>();
    public DbSet<WhatsAppContact> WhatsAppContacts => Set<WhatsAppContact>();
    public DbSet<Conversation> Conversations => Set<Conversation>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<WhatsAppFaq> WhatsAppFaqs => Set<WhatsAppFaq>();
    public DbSet<Subscription> Subscriptions => Set<Subscription>();
    public DbSet<SubscriptionInvoice> SubscriptionInvoices => Set<SubscriptionInvoice>();
    public DbSet<CashSession> CashSessions => Set<CashSession>();
    public DbSet<CashMovement> CashMovements => Set<CashMovement>();
    public DbSet<Receivable> Receivables => Set<Receivable>();
    public DbSet<ReceivablePayment> ReceivablePayments => Set<ReceivablePayment>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Tenant>(e =>
        {
            e.HasIndex(x => x.Slug).IsUnique();
            e.Property(x => x.Name).HasMaxLength(160).IsRequired();
            e.Property(x => x.TaxRate).HasPrecision(5, 2);
        });

        modelBuilder.Entity<User>(e =>
        {
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.Email).HasMaxLength(200).IsRequired();
            e.HasOne(x => x.Tenant).WithMany(t => t.Users).HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Branch).WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Branch>(e =>
        {
            e.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
        });

        modelBuilder.Entity<Category>(e => e.HasIndex(x => new { x.TenantId, x.Name }));

        modelBuilder.Entity<Product>(e =>
        {
            e.HasIndex(x => new { x.TenantId, x.Sku });
            e.Property(x => x.Price).HasPrecision(18, 2);
            e.Property(x => x.Cost).HasPrecision(18, 2);
            e.Property(x => x.CompareAtPrice).HasPrecision(18, 2);
            e.Ignore(x => x.TotalStock);
            e.Ignore(x => x.IsLowStock);
            e.HasOne(x => x.Category).WithMany(c => c.Products).HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<ProductVariant>(e =>
        {
            e.Property(x => x.Price).HasPrecision(18, 2);
            e.HasOne(x => x.Product).WithMany(p => p.Variants).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Sale>(e =>
        {
            e.HasIndex(x => new { x.TenantId, x.Number }).IsUnique();
            e.Property(x => x.Subtotal).HasPrecision(18, 2);
            e.Property(x => x.Discount).HasPrecision(18, 2);
            e.Property(x => x.Tax).HasPrecision(18, 2);
            e.Property(x => x.Total).HasPrecision(18, 2);
            e.Property(x => x.PaidAmount).HasPrecision(18, 2);
            e.Property(x => x.Change).HasPrecision(18, 2);
        });

        modelBuilder.Entity<SaleItem>(e =>
        {
            e.Property(x => x.UnitPrice).HasPrecision(18, 2);
            e.Property(x => x.UnitCost).HasPrecision(18, 2);
            e.Property(x => x.Discount).HasPrecision(18, 2);
            e.Property(x => x.Total).HasPrecision(18, 2);
            e.HasOne(x => x.Sale).WithMany(s => s.Items).HasForeignKey(x => x.SaleId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Expense>(e => e.Property(x => x.Amount).HasPrecision(18, 2));
        modelBuilder.Entity<InventoryMovement>(e => e.HasIndex(x => new { x.TenantId, x.CreatedAt }));

        modelBuilder.Entity<WhatsAppAccount>(e => e.HasIndex(x => new { x.TenantId, x.PhoneNumberId }));
        modelBuilder.Entity<WhatsAppContact>(e => e.HasIndex(x => new { x.TenantId, x.WaId }).IsUnique());
        modelBuilder.Entity<Conversation>(e =>
        {
            e.HasOne(x => x.Contact).WithMany().HasForeignKey(x => x.ContactId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.TenantId, x.LastMessageAt });
        });
        modelBuilder.Entity<Message>(e =>
        {
            e.HasOne(x => x.Conversation).WithMany(c => c.Messages).HasForeignKey(x => x.ConversationId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.TenantId, x.CreatedAt });
        });

        modelBuilder.Entity<Subscription>(e =>
        {
            e.HasIndex(x => x.TenantId).IsUnique();
            e.Property(x => x.BasePrice).HasPrecision(18, 2);
            e.Property(x => x.AddonsPrice).HasPrecision(18, 2);
            e.Property(x => x.Discount).HasPrecision(18, 2);
            e.Property(x => x.Total).HasPrecision(18, 2);
        });

        modelBuilder.Entity<SubscriptionInvoice>(e =>
        {
            e.HasIndex(x => new { x.TenantId, x.Number }).IsUnique();
            e.Property(x => x.Subtotal).HasPrecision(18, 2);
            e.Property(x => x.Addons).HasPrecision(18, 2);
            e.Property(x => x.Discount).HasPrecision(18, 2);
            e.Property(x => x.Tax).HasPrecision(18, 2);
            e.Property(x => x.Total).HasPrecision(18, 2);
        });

        modelBuilder.Entity<CashSession>(e =>
        {
            e.Property(x => x.OpeningAmount).HasPrecision(18, 2);
            e.Property(x => x.SalesAmount).HasPrecision(18, 2);
            e.Property(x => x.IncomeAmount).HasPrecision(18, 2);
            e.Property(x => x.ExpenseAmount).HasPrecision(18, 2);
            e.Property(x => x.ExpectedAmount).HasPrecision(18, 2);
            e.Property(x => x.CountedAmount).HasPrecision(18, 2);
            e.Property(x => x.Difference).HasPrecision(18, 2);
            e.HasIndex(x => new { x.TenantId, x.Status });
        });

        modelBuilder.Entity<CashMovement>(e =>
        {
            e.Property(x => x.Amount).HasPrecision(18, 2);
            e.HasOne(x => x.CashSession).WithMany(c => c.Movements).HasForeignKey(x => x.CashSessionId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.TenantId, x.Date });
        });

        modelBuilder.Entity<Receivable>(e =>
        {
            e.Property(x => x.Total).HasPrecision(18, 2);
            e.Property(x => x.PaidAmount).HasPrecision(18, 2);
            e.HasIndex(x => new { x.TenantId, x.DueDate });
        });

        modelBuilder.Entity<ReceivablePayment>(e =>
        {
            e.Property(x => x.Amount).HasPrecision(18, 2);
            e.HasOne(x => x.Receivable).WithMany(r => r.Payments).HasForeignKey(x => x.ReceivableId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Order>(e =>
        {
            e.HasIndex(x => new { x.TenantId, x.Number }).IsUnique();
            e.Property(x => x.Total).HasPrecision(18, 2);
            e.HasIndex(x => new { x.TenantId, x.Status });
        });

        modelBuilder.Entity<OrderItem>(e =>
        {
            e.Property(x => x.UnitPrice).HasPrecision(18, 2);
            e.Property(x => x.Total).HasPrecision(18, 2);
            e.HasOne(x => x.Order).WithMany(o => o.Items).HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
        });

        // Universal tenant isolation: every tenant-owned entity is filtered automatically.
        modelBuilder.Entity<User>().HasQueryFilter(e => TenantBypass || e.TenantId == CurrentTenantId);
        modelBuilder.Entity<Branch>().HasQueryFilter(e => TenantBypass || e.TenantId == CurrentTenantId);
        modelBuilder.Entity<Category>().HasQueryFilter(e => TenantBypass || e.TenantId == CurrentTenantId);
        modelBuilder.Entity<Product>().HasQueryFilter(e => TenantBypass || e.TenantId == CurrentTenantId);
        modelBuilder.Entity<ProductVariant>().HasQueryFilter(e => TenantBypass || e.TenantId == CurrentTenantId);
        modelBuilder.Entity<InventoryMovement>().HasQueryFilter(e => TenantBypass || e.TenantId == CurrentTenantId);
        modelBuilder.Entity<Customer>().HasQueryFilter(e => TenantBypass || e.TenantId == CurrentTenantId);
        modelBuilder.Entity<Supplier>().HasQueryFilter(e => TenantBypass || e.TenantId == CurrentTenantId);
        modelBuilder.Entity<Sale>().HasQueryFilter(e => TenantBypass || e.TenantId == CurrentTenantId);
        modelBuilder.Entity<SaleItem>().HasQueryFilter(e => TenantBypass || e.TenantId == CurrentTenantId);
        modelBuilder.Entity<Expense>().HasQueryFilter(e => TenantBypass || e.TenantId == CurrentTenantId);
        modelBuilder.Entity<AuditLog>().HasQueryFilter(e => TenantBypass || e.TenantId == CurrentTenantId);
        modelBuilder.Entity<WhatsAppAccount>().HasQueryFilter(e => TenantBypass || e.TenantId == CurrentTenantId);
        modelBuilder.Entity<WhatsAppContact>().HasQueryFilter(e => TenantBypass || e.TenantId == CurrentTenantId);
        modelBuilder.Entity<Conversation>().HasQueryFilter(e => TenantBypass || e.TenantId == CurrentTenantId);
        modelBuilder.Entity<Message>().HasQueryFilter(e => TenantBypass || e.TenantId == CurrentTenantId);
        modelBuilder.Entity<WhatsAppFaq>().HasQueryFilter(e => TenantBypass || e.TenantId == CurrentTenantId);
        modelBuilder.Entity<Subscription>().HasQueryFilter(e => TenantBypass || e.TenantId == CurrentTenantId);
        modelBuilder.Entity<SubscriptionInvoice>().HasQueryFilter(e => TenantBypass || e.TenantId == CurrentTenantId);
        modelBuilder.Entity<CashSession>().HasQueryFilter(e => TenantBypass || e.TenantId == CurrentTenantId);
        modelBuilder.Entity<CashMovement>().HasQueryFilter(e => TenantBypass || e.TenantId == CurrentTenantId);
        modelBuilder.Entity<Receivable>().HasQueryFilter(e => TenantBypass || e.TenantId == CurrentTenantId);
        modelBuilder.Entity<ReceivablePayment>().HasQueryFilter(e => TenantBypass || e.TenantId == CurrentTenantId);
        modelBuilder.Entity<Order>().HasQueryFilter(e => TenantBypass || e.TenantId == CurrentTenantId);
        modelBuilder.Entity<OrderItem>().HasQueryFilter(e => TenantBypass || e.TenantId == CurrentTenantId);
    }

    public override int SaveChanges()
    {
        StampAndGuard();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        StampAndGuard();
        return base.SaveChangesAsync(cancellationToken);
    }

    /// <summary>Assigns the tenant to new rows and rejects any attempt to touch another tenant's data.</summary>
    private void StampAndGuard()
    {
        var now = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries<ITenantScoped>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    if (entry.Entity.TenantId == Guid.Empty)
                    {
                        if (!_tenantContext.HasTenant && !TenantBypass)
                            throw new InvalidOperationException("A tenant is required to create this record.");
                        entry.Entity.TenantId = _tenantContext.TenantId;
                    }
                    else if (!TenantBypass && _tenantContext.HasTenant && entry.Entity.TenantId != _tenantContext.TenantId)
                    {
                        throw new InvalidOperationException("Cross-tenant insert is not allowed.");
                    }
                    break;
                case EntityState.Modified:
                case EntityState.Deleted:
                    if (!TenantBypass && _tenantContext.HasTenant && entry.Entity.TenantId != _tenantContext.TenantId)
                        throw new InvalidOperationException("Cross-tenant modification is not allowed.");
                    break;
            }

            if (entry.Entity is Entity entity)
            {
                if (entry.State == EntityState.Added) entity.CreatedAt = now;
                if (entry.State == EntityState.Modified) entity.UpdatedAt = now;
            }
        }
    }
}
