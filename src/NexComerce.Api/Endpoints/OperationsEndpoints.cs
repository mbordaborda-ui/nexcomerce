using Microsoft.EntityFrameworkCore;
using NexComerce.Api.Contracts;
using NexComerce.Api.Infrastructure;
using NexComerce.Domain.Audit;
using NexComerce.Domain.Common;
using NexComerce.Domain.Contacts;
using NexComerce.Domain.Finance;
using NexComerce.Domain.Inventory;
using NexComerce.Domain.Sales;
using NexComerce.Domain.Tenancy;
using NexComerce.Infrastructure.Persistence;

namespace NexComerce.Api.Endpoints;

public static class OperationsEndpoints
{
    public static void MapOperationsEndpoints(this IEndpointRouteBuilder app)
    {
        MapSales(app);
        MapCustomers(app);
        MapSuppliers(app);
        MapExpenses(app);
    }

    // ── Sales ───────────────────────────────────────────────────────────────
    private static void MapSales(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/sales").WithTags("Ventas").RequireAuthorization();

        group.MapGet("", async (AppDbContext db, string? search, string? status, string? paymentMethod,
            DateTime? from, DateTime? to, Guid? branchId, int page = 1, int pageSize = 20) =>
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);
            var query = db.Sales.AsNoTracking().Include(s => s.Items).AsQueryable();
            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                query = query.Where(s => s.Number.ToLower().Contains(term)
                    || (s.CustomerName != null && s.CustomerName.ToLower().Contains(term))
                    || (s.UserName != null && s.UserName.ToLower().Contains(term)));
            }
            if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<SaleStatus>(status, true, out var st))
                query = query.Where(s => s.Status == st);
            if (!string.IsNullOrWhiteSpace(paymentMethod) && Enum.TryParse<PaymentMethod>(paymentMethod, true, out var pm))
                query = query.Where(s => s.PaymentMethod == pm);
            if (from.HasValue) query = query.Where(s => s.CreatedAt >= from.Value.Date);
            if (to.HasValue) query = query.Where(s => s.CreatedAt < to.Value.Date.AddDays(1));
            if (branchId.HasValue) query = query.Where(s => s.BranchId == branchId);

            var total = await query.CountAsync();
            var list = await query.OrderByDescending(s => s.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
            var branchIds = list.Where(s => s.BranchId != null).Select(s => s.BranchId!.Value).Distinct().ToList();
            var branches = await db.Branches.Where(b => branchIds.Contains(b.Id)).ToDictionaryAsync(b => b.Id, b => b.Name);
            var items = list.Select(s => s.ToSummary(s.BranchId != null && branches.TryGetValue(s.BranchId.Value, out var bn) ? bn : null)).ToList();
            return Results.Ok(new PageResult<SaleSummaryDto>(items, total, page, pageSize));
        });

        group.MapGet("/{id:guid}", async (Guid id, AppDbContext db) =>
        {
            var sale = await db.Sales.AsNoTracking().Include(s => s.Items).FirstOrDefaultAsync(s => s.Id == id)
                ?? throw new ApiException("Venta no encontrada.", 404);
            var branch = sale.BranchId == null ? null : await db.Branches.FirstOrDefaultAsync(b => b.Id == sale.BranchId);
            return Results.Ok(sale.ToDto(branch?.Name));
        });

        group.MapPost("", async (CreateSaleRequest request, AppDbContext db, CurrentUser current) =>
        {
            if (request.Items is null || request.Items.Count == 0) Guard.BadRequest("Agrega al menos un producto a la venta.");
            if (request.Items.Any(i => i.Quantity <= 0)) Guard.BadRequest("Las cantidades deben ser mayores a cero.");
            var tenant = await db.Tenants.FirstAsync(t => t.Id == current.TenantId);
            if (!Enum.TryParse<PaymentMethod>(request.PaymentMethod, true, out var paymentMethod))
                paymentMethod = PaymentMethod.Cash;

            var productIds = request.Items.Select(i => i.ProductId).Distinct().ToList();
            var products = await db.Products.Include(p => p.Variants).Where(p => productIds.Contains(p.Id)).ToListAsync();
            if (products.Count != productIds.Count) Guard.BadRequest("Uno o más productos no existen.");

            var branchId = request.BranchId ?? current.BranchId ?? (await db.Branches.OrderBy(b => b.CreatedAt).FirstOrDefaultAsync())?.Id;
            var sellerId = request.UserId ?? current.Id;
            var seller = await db.Users.FirstOrDefaultAsync(u => u.Id == sellerId);
            Customer? customer = null;
            if (request.CustomerId.HasValue)
                customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == request.CustomerId)
                    ?? throw new ApiException("Cliente no encontrado.", 404);

            var sale = new Sale
            {
                BranchId = branchId,
                CustomerId = customer?.Id,
                CustomerName = customer?.Name ?? "Cliente ocasional",
                UserId = sellerId,
                UserName = seller?.FullName ?? current.Name,
                PaymentMethod = paymentMethod,
                Notes = request.Notes,
                Channel = string.IsNullOrWhiteSpace(request.Channel) ? "POS" : request.Channel,
                Status = paymentMethod == PaymentMethod.Credit ? SaleStatus.Pending : SaleStatus.Completed
            };

            var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var sequence = await db.Sales.IgnoreQueryFilters().CountAsync(s => s.TenantId == current.TenantId && s.CreatedAt >= monthStart) + 1;
            string number;
            do
            {
                number = $"V-{DateTime.UtcNow:yyMM}-{sequence:0000}";
                sequence++;
            } while (await db.Sales.IgnoreQueryFilters().AnyAsync(s => s.TenantId == current.TenantId && s.Number == number));
            sale.Number = number;

            foreach (var item in request.Items)
            {
                var product = products.First(p => p.Id == item.ProductId);
                if (!product.IsActive) Guard.BadRequest($"El producto {product.Name} no está disponible.");
                var variant = item.VariantId.HasValue ? product.Variants.FirstOrDefault(v => v.Id == item.VariantId) : null;
                if (item.VariantId.HasValue && variant is null) Guard.BadRequest("Una variante seleccionada no existe.");

                var unitPrice = item.UnitPrice ?? variant?.Price ?? product.Price;
                if (unitPrice < 0) Guard.BadRequest("El precio no puede ser negativo.");
                var lineDiscount = Math.Max(0, item.Discount ?? 0);
                var lineTotal = Math.Max(0, unitPrice * item.Quantity - lineDiscount);

                if (product.TrackStock)
                {
                    var available = variant?.Stock ?? product.Stock;
                    if (available < item.Quantity)
                        Guard.BadRequest($"Stock insuficiente de {product.Name}. Disponible: {available} unidades.");
                    var newStock = available - item.Quantity;
                    var previous = available;
                    if (variant is not null)
                    {
                        variant.Stock = newStock;
                        product.Stock = product.Variants.Sum(v => v.Stock);
                    }
                    else
                    {
                        product.Stock = newStock;
                    }

                    db.InventoryMovements.Add(new InventoryMovement
                    {
                        ProductId = product.Id,
                        VariantId = variant?.Id,
                        BranchId = branchId,
                        Type = MovementType.Sale,
                        Quantity = item.Quantity,
                        PreviousStock = previous,
                        NewStock = newStock,
                        Reference = sale.Number,
                        ProductName = product.Name,
                        UserId = sellerId,
                        UserName = sale.UserName
                    });
                }

                sale.Items.Add(new SaleItem
                {
                    ProductId = product.Id,
                    VariantId = variant?.Id,
                    ProductName = product.Name,
                    VariantName = variant?.Name,
                    Sku = variant?.Sku ?? product.Sku,
                    Quantity = item.Quantity,
                    UnitPrice = unitPrice,
                    UnitCost = product.Cost,
                    Discount = lineDiscount,
                    Total = lineTotal
                });
            }

            var itemSubtotal = sale.Items.Sum(i => i.UnitPrice * i.Quantity);
            var lineDiscounts = sale.Items.Sum(i => i.Discount);
            var globalDiscount = Math.Max(0, request.Discount);
            var taxableBase = Math.Max(0, itemSubtotal - lineDiscounts - globalDiscount);
            var tax = tenant.TaxIncluded
                ? Math.Round(taxableBase * tenant.TaxRate / (100 + tenant.TaxRate), 2)
                : Math.Round(taxableBase * tenant.TaxRate / 100, 2);

            sale.Subtotal = itemSubtotal;
            sale.Discount = lineDiscounts + globalDiscount;
            sale.Tax = tax;
            sale.Total = tenant.TaxIncluded ? taxableBase : taxableBase + tax;
            sale.PaidAmount = request.PaidAmount ?? sale.Total;
            sale.Change = Math.Max(0, sale.PaidAmount - sale.Total);

            db.Sales.Add(sale);
            if (customer is not null)
            {
                customer.LoyaltyPoints += (int)Math.Floor(sale.Total / 10);
                db.Customers.Update(customer);
            }
            db.AuditLogs.Add(new AuditLog
            {
                UserId = current.Id,
                UserName = current.Name,
                Action = "sale.created",
                Entity = "Sale",
                EntityId = sale.Id.ToString(),
                Details = $"Venta {number} por {tenant.CurrencySymbol}{sale.Total:N2}",
                IpAddress = current.IpAddress
            });

            await db.SaveChangesAsync();
            var branch = branchId == null ? null : await db.Branches.FirstOrDefaultAsync(b => b.Id == branchId);
            return Results.Created($"/api/sales/{sale.Id}", sale.ToDto(branch?.Name));
        }).RequirePermission(Permissions.SalesManage);

        group.MapPost("/{id:guid}/cancel", async (Guid id, CancelSaleRequest request, AppDbContext db, CurrentUser current) =>
        {
            var sale = await db.Sales.Include(s => s.Items).FirstOrDefaultAsync(s => s.Id == id)
                ?? throw new ApiException("Venta no encontrada.", 404);
            if (sale.Status == SaleStatus.Cancelled) Guard.BadRequest("Esta venta ya fue anulada.");

            foreach (var item in sale.Items)
            {
                var product = await db.Products.Include(p => p.Variants).FirstOrDefaultAsync(p => p.Id == item.ProductId);
                if (product is null || !product.TrackStock) continue;
                var variant = item.VariantId.HasValue ? product.Variants.FirstOrDefault(v => v.Id == item.VariantId) : null;
                var previous = variant?.Stock ?? product.Stock;
                if (variant is not null) variant.Stock += item.Quantity;
                else product.Stock += item.Quantity;
                if (product.Variants.Count > 0) product.Stock = product.Variants.Sum(v => v.Stock);
                db.InventoryMovements.Add(new InventoryMovement
                {
                    ProductId = product.Id,
                    VariantId = variant?.Id,
                    BranchId = sale.BranchId,
                    Type = MovementType.Return,
                    Quantity = item.Quantity,
                    PreviousStock = previous,
                    NewStock = variant?.Stock ?? product.Stock,
                    Reference = sale.Number,
                    Notes = "Anulación de venta",
                    ProductName = product.Name,
                    UserId = current.Id,
                    UserName = current.Name
                });
            }

            sale.Status = SaleStatus.Cancelled;
            sale.CancelledAt = DateTime.UtcNow;
            sale.CancelReason = request.Reason;
            await db.SaveChangesAsync();
            var branch = sale.BranchId == null ? null : await db.Branches.FirstOrDefaultAsync(b => b.Id == sale.BranchId);
            return Results.Ok(sale.ToDto(branch?.Name));
        }).RequirePermission(Permissions.SalesManage);

        group.MapGet("/summary", async (AppDbContext db, DateTime? from, DateTime? to) =>
        {
            var start = from?.Date ?? new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);
            var end = (to?.Date ?? DateTime.UtcNow.Date).AddDays(1);
            var sales = await db.Sales.AsNoTracking().Where(s => s.Status != SaleStatus.Cancelled && s.CreatedAt >= start && s.CreatedAt < end).ToListAsync();
            var total = sales.Sum(s => s.Total);
            var summary = new SalesSummaryDto(total, sales.Count, sales.Count > 0 ? Math.Round(total / sales.Count, 2) : 0,
                sales.Sum(s => s.Tax), sales.Sum(s => s.Discount),
                sales.GroupBy(s => s.PaymentMethod).Select(g => new PaymentTotalDto(g.Key.ToString(), g.Sum(s => s.Total), g.Count()))
                    .OrderByDescending(x => x.Total).ToList());
            return Results.Ok(summary);
        });
    }

    // ── Customers ───────────────────────────────────────────────────────────
    private static void MapCustomers(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/customers").WithTags("Clientes").RequireAuthorization();

        group.MapGet("", async (AppDbContext db, string? search, int page = 1, int pageSize = 20) =>
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);
            var query = db.Customers.AsNoTracking().AsQueryable();
            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                query = query.Where(c => c.Name.ToLower().Contains(term) || (c.Email != null && c.Email.ToLower().Contains(term))
                    || (c.Phone != null && c.Phone.Contains(term)) || (c.DocumentNumber != null && c.DocumentNumber.Contains(term)));
            }
            var total = await query.CountAsync();
            var list = await query.OrderByDescending(c => c.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
            var ids = list.Select(c => c.Id).ToList();
            var stats = await db.Sales.AsNoTracking().Where(s => s.CustomerId != null && ids.Contains(s.CustomerId.Value) && s.Status != SaleStatus.Cancelled)
                .GroupBy(s => s.CustomerId)
                .Select(g => new { CustomerId = g.Key, Count = g.Count(), Total = g.Sum(x => x.Total), Last = g.Max(x => x.CreatedAt) })
                .ToListAsync();
            var items = list.Select(c =>
            {
                var st = stats.FirstOrDefault(s => s.CustomerId == c.Id);
                return c.ToDto(st?.Count ?? 0, st?.Total ?? 0, st?.Last);
            }).ToList();
            return Results.Ok(new PageResult<CustomerDto>(items, total, page, pageSize));
        });

        group.MapGet("/{id:guid}", async (Guid id, AppDbContext db) =>
        {
            var customer = await db.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id)
                ?? throw new ApiException("Cliente no encontrado.", 404);
            var sales = await db.Sales.AsNoTracking().Include(s => s.Items)
                .Where(s => s.CustomerId == id).OrderByDescending(s => s.CreatedAt).Take(20).ToListAsync();
            var spent = sales.Where(s => s.Status != SaleStatus.Cancelled).Sum(s => s.Total);
            return Results.Ok(new { customer = customer.ToDto(sales.Count, spent, sales.FirstOrDefault()?.CreatedAt), sales = sales.Select(s => s.ToSummary()).ToList() });
        });

        group.MapPost("", async (SaveCustomerRequest request, AppDbContext db) =>
        {
            var customer = new Customer
            {
                Name = Guard.Require(request.Name, "El nombre del cliente es obligatorio."),
                DocumentNumber = request.DocumentNumber,
                Email = request.Email,
                Phone = request.Phone,
                Address = request.Address,
                Notes = request.Notes,
                Tags = request.Tags,
                IsActive = request.IsActive
            };
            db.Customers.Add(customer);
            await db.SaveChangesAsync();
            return Results.Created($"/api/customers/{customer.Id}", customer.ToDto());
        }).RequirePermission(Permissions.CustomersManage);

        group.MapPut("/{id:guid}", async (Guid id, SaveCustomerRequest request, AppDbContext db) =>
        {
            var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == id) ?? throw new ApiException("Cliente no encontrado.", 404);
            customer.Name = Guard.Require(request.Name, "El nombre del cliente es obligatorio.");
            customer.DocumentNumber = request.DocumentNumber;
            customer.Email = request.Email;
            customer.Phone = request.Phone;
            customer.Address = request.Address;
            customer.Notes = request.Notes;
            customer.Tags = request.Tags;
            customer.IsActive = request.IsActive;
            await db.SaveChangesAsync();
            return Results.Ok(customer.ToDto());
        }).RequirePermission(Permissions.CustomersManage);

        group.MapDelete("/{id:guid}", async (Guid id, AppDbContext db) =>
        {
            var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == id) ?? throw new ApiException("Cliente no encontrado.", 404);
            customer.IsActive = false;
            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Cliente desactivado." });
        }).RequirePermission(Permissions.CustomersManage);
    }

    // ── Suppliers ───────────────────────────────────────────────────────────
    private static void MapSuppliers(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/suppliers").WithTags("Proveedores").RequireAuthorization();

        group.MapGet("", async (AppDbContext db, string? search) =>
        {
            var query = db.Suppliers.AsNoTracking().AsQueryable();
            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                query = query.Where(s => s.Name.ToLower().Contains(term) || (s.ContactName != null && s.ContactName.ToLower().Contains(term))
                    || (s.Phone != null && s.Phone.Contains(term)));
            }
            var list = await query.OrderBy(s => s.Name).ToListAsync();
            var supplierIds = list.Select(s => s.Id).ToList();
            var supplied = await db.Expenses.Where(e => e.SupplierId != null && supplierIds.Contains(e.SupplierId.Value))
                .GroupBy(e => e.SupplierId).Select(g => new { SupplierId = g.Key, Count = g.Count() }).ToListAsync();
            var items = list.Select(s =>
            {
                var dto = s.ToDto();
                return dto with { ProductsSupplied = supplied.FirstOrDefault(x => x.SupplierId == s.Id)?.Count ?? 0 };
            }).ToList();
            return Results.Ok(items);
        });

        group.MapPost("", async (SaveSupplierRequest request, AppDbContext db) =>
        {
            var supplier = new Supplier
            {
                Name = Guard.Require(request.Name, "El nombre del proveedor es obligatorio."),
                ContactName = request.ContactName,
                DocumentNumber = request.DocumentNumber,
                Email = request.Email,
                Phone = request.Phone,
                Address = request.Address,
                Notes = request.Notes,
                IsActive = request.IsActive
            };
            db.Suppliers.Add(supplier);
            await db.SaveChangesAsync();
            return Results.Created($"/api/suppliers/{supplier.Id}", supplier.ToDto());
        }).RequirePermission(Permissions.SuppliersManage);

        group.MapPut("/{id:guid}", async (Guid id, SaveSupplierRequest request, AppDbContext db) =>
        {
            var supplier = await db.Suppliers.FirstOrDefaultAsync(s => s.Id == id) ?? throw new ApiException("Proveedor no encontrado.", 404);
            supplier.Name = Guard.Require(request.Name, "El nombre del proveedor es obligatorio.");
            supplier.ContactName = request.ContactName;
            supplier.DocumentNumber = request.DocumentNumber;
            supplier.Email = request.Email;
            supplier.Phone = request.Phone;
            supplier.Address = request.Address;
            supplier.Notes = request.Notes;
            supplier.IsActive = request.IsActive;
            await db.SaveChangesAsync();
            return Results.Ok(supplier.ToDto());
        }).RequirePermission(Permissions.SuppliersManage);

        group.MapDelete("/{id:guid}", async (Guid id, AppDbContext db) =>
        {
            var supplier = await db.Suppliers.FirstOrDefaultAsync(s => s.Id == id) ?? throw new ApiException("Proveedor no encontrado.", 404);
            supplier.IsActive = false;
            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Proveedor desactivado." });
        }).RequirePermission(Permissions.SuppliersManage);
    }

    // ── Expenses ────────────────────────────────────────────────────────────
    private static void MapExpenses(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/expenses").WithTags("Gastos").RequireAuthorization();

        group.MapGet("", async (AppDbContext db, string? category, DateTime? from, DateTime? to, int page = 1, int pageSize = 30) =>
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);
            var query = db.Expenses.AsNoTracking().AsQueryable();
            if (!string.IsNullOrWhiteSpace(category)) query = query.Where(e => e.Category == category);
            if (from.HasValue) query = query.Where(e => e.Date >= from.Value.Date);
            if (to.HasValue) query = query.Where(e => e.Date < to.Value.Date.AddDays(1));
            var total = await query.CountAsync();
            var list = await query.OrderByDescending(e => e.Date).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
            var supplierIds = list.Where(e => e.SupplierId != null).Select(e => e.SupplierId!.Value).Distinct().ToList();
            var suppliers = await db.Suppliers.Where(s => supplierIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id, s => s.Name);
            var branchIds = list.Where(e => e.BranchId != null).Select(e => e.BranchId!.Value).Distinct().ToList();
            var branches = await db.Branches.Where(b => branchIds.Contains(b.Id)).ToDictionaryAsync(b => b.Id, b => b.Name);
            var items = list.Select(e => e.ToDto(
                e.SupplierId != null && suppliers.TryGetValue(e.SupplierId.Value, out var sn) ? sn : null,
                e.BranchId != null && branches.TryGetValue(e.BranchId.Value, out var bn) ? bn : null)).ToList();
            var sum = await query.SumAsync(e => (decimal?)e.Amount) ?? 0;
            return Results.Ok(new { items, total, page, pageSize, totalPages = (int)Math.Ceiling(total / (double)pageSize), sum });
        });

        group.MapGet("/categories", async (AppDbContext db) =>
        {
            var defaults = new[] { "Arriendo", "Nómina", "Marketing", "Servicios", "Logística", "Insumos", "Software", "Mantenimiento", "Impuestos", "Otros" };
            var used = await db.Expenses.Select(e => e.Category).Distinct().ToListAsync();
            return Results.Ok(defaults.Union(used).OrderBy(x => x).ToList());
        });

        group.MapPost("", async (SaveExpenseRequest request, AppDbContext db, CurrentUser current) =>
        {
            if (request.Amount <= 0) Guard.BadRequest("El monto debe ser mayor a cero.");
            if (!Enum.TryParse<PaymentMethod>(request.PaymentMethod, true, out var pay)) pay = PaymentMethod.Cash;
            var expense = new Expense
            {
                Category = Guard.Require(request.Category, "La categoría es obligatoria."),
                Description = Guard.Require(request.Description, "La descripción es obligatoria."),
                Amount = request.Amount,
                Date = request.Date ?? DateTime.UtcNow,
                PaymentMethod = pay,
                SupplierId = request.SupplierId,
                BranchId = request.BranchId ?? current.BranchId,
                Notes = request.Notes,
                IsRecurring = request.IsRecurring,
                UserId = current.Id
            };
            db.Expenses.Add(expense);
            await db.SaveChangesAsync();
            return Results.Created($"/api/expenses/{expense.Id}", expense.ToDto());
        }).RequirePermission(Permissions.ExpensesManage);

        group.MapPut("/{id:guid}", async (Guid id, SaveExpenseRequest request, AppDbContext db) =>
        {
            var expense = await db.Expenses.FirstOrDefaultAsync(e => e.Id == id) ?? throw new ApiException("Gasto no encontrado.", 404);
            if (request.Amount <= 0) Guard.BadRequest("El monto debe ser mayor a cero.");
            if (!Enum.TryParse<PaymentMethod>(request.PaymentMethod, true, out var pay)) pay = expense.PaymentMethod;
            expense.Category = Guard.Require(request.Category, "La categoría es obligatoria.");
            expense.Description = Guard.Require(request.Description, "La descripción es obligatoria.");
            expense.Amount = request.Amount;
            expense.Date = request.Date ?? expense.Date;
            expense.PaymentMethod = pay;
            expense.SupplierId = request.SupplierId;
            expense.BranchId = request.BranchId ?? expense.BranchId;
            expense.Notes = request.Notes;
            expense.IsRecurring = request.IsRecurring;
            await db.SaveChangesAsync();
            return Results.Ok(expense.ToDto());
        }).RequirePermission(Permissions.ExpensesManage);

        group.MapDelete("/{id:guid}", async (Guid id, AppDbContext db) =>
        {
            var expense = await db.Expenses.FirstOrDefaultAsync(e => e.Id == id) ?? throw new ApiException("Gasto no encontrado.", 404);
            db.Expenses.Remove(expense);
            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Gasto eliminado." });
        }).RequirePermission(Permissions.ExpensesManage);
    }
}
