using Microsoft.EntityFrameworkCore;
using NexComerce.Api.Contracts;
using NexComerce.Api.Infrastructure;
using NexComerce.Domain.Audit;
using NexComerce.Domain.Common;
using NexComerce.Domain.Inventory;
using NexComerce.Domain.Operations;
using NexComerce.Domain.Sales;
using NexComerce.Infrastructure.Persistence;

namespace NexComerce.Api.Endpoints;

public static class OperationsPlusEndpoints
{
    public static void MapOperationsPlusEndpoints(this IEndpointRouteBuilder app)
    {
        MapCash(app);
        MapReceivables(app);
        MapOrders(app);
    }

    // ── Caja ───────────────────────────────────────────────────────────────
    private static void MapCash(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/cash").WithTags("Caja").RequireAuthorization()
            .RequirePermission(Permissions.SalesManage);

        group.MapGet("", async (AppDbContext db) =>
        {
            var current = await db.CashSessions.Include(s => s.Movements)
                .Where(s => s.Status == CashSessionStatus.Open)
                .OrderByDescending(s => s.OpenedAt)
                .FirstOrDefaultAsync();
            var sessions = await db.CashSessions.AsNoTracking()
                .OrderByDescending(s => s.OpenedAt).Take(15).ToListAsync();
            var today = DateTime.UtcNow.Date;
            var tomorrow = today.AddDays(1);
            var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);

            var cashSalesToday = await db.Sales.AsNoTracking()
                .Where(s => s.Status != SaleStatus.Cancelled && s.PaymentMethod == PaymentMethod.Cash
                            && s.CreatedAt >= today && s.CreatedAt < tomorrow)
                .SumAsync(s => (decimal?)s.Total) ?? 0;
            var movementToday = await db.CashMovements.AsNoTracking()
                .Where(m => m.Date >= today && m.Date < tomorrow)
                .Select(m => new { m.Type, m.Amount })
                .ToListAsync();
            var incomeToday = movementToday.Where(m => m.Type == CashMovementType.Income).Sum(m => m.Amount);
            var expenseToday = movementToday.Where(m => m.Type is CashMovementType.Expense or CashMovementType.Withdrawal).Sum(m => m.Amount);
            var lastClosed = await db.CashSessions.AsNoTracking()
                .Where(s => s.Status == CashSessionStatus.Closed)
                .OrderByDescending(s => s.ClosedAt).FirstOrDefaultAsync();
            var sessionsThisMonth = await db.CashSessions.CountAsync(s => s.OpenedAt >= monthStart);

            return Results.Ok(new CashOverviewDto(
                current?.ToDto(),
                sessions.Select(s => s.ToDto()).ToList(),
                new CashSummaryDto(cashSalesToday, incomeToday, expenseToday,
                    await db.CashSessions.CountAsync(s => s.Status == CashSessionStatus.Open),
                    lastClosed?.Difference ?? 0, sessionsThisMonth)));
        });

        group.MapGet("/{id:guid}", async (Guid id, AppDbContext db) =>
        {
            var session = await db.CashSessions.AsNoTracking().Include(s => s.Movements)
                .FirstOrDefaultAsync(s => s.Id == id) ?? throw new ApiException("Sesión de caja no encontrada.", 404);
            return Results.Ok(session.ToDto());
        });

        group.MapPost("/open", async (OpenCashRequest request, AppDbContext db, CurrentUser current) =>
        {
            if (request.OpeningAmount < 0) Guard.BadRequest("El monto de apertura no puede ser negativo.");
            var branchId = request.BranchId ?? current.BranchId;
            var alreadyOpen = await db.CashSessions.AnyAsync(s =>
                s.Status == CashSessionStatus.Open && (branchId == null || s.BranchId == branchId));
            if (alreadyOpen) Guard.BadRequest("Ya tienes una caja abierta. Ciérrala antes de abrir otra.");

            var branch = branchId == null ? null : await db.Branches.FirstOrDefaultAsync(b => b.Id == branchId);
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == current.Id);
            var session = new CashSession
            {
                BranchId = branchId,
                BranchName = branch?.Name,
                UserId = current.Id,
                UserName = user?.FullName ?? current.Name,
                OpeningAmount = request.OpeningAmount,
                ExpectedAmount = request.OpeningAmount,
                Notes = request.Notes
            };
            session.Movements.Add(new CashMovement
            {
                Type = CashMovementType.Opening,
                Concept = "Apertura de caja",
                Amount = request.OpeningAmount,
                PaymentMethod = "Cash",
                UserId = current.Id,
                UserName = session.UserName
            });
            db.CashSessions.Add(session);
            db.AuditLogs.Add(new AuditLog
            {
                UserId = current.Id, UserName = current.Name, Action = "cash.opened", Entity = "CashSession",
                EntityId = session.Id.ToString(), Details = $"Caja abierta con {request.OpeningAmount:N2}"
            });
            await db.SaveChangesAsync();
            return Results.Created($"/api/cash/{session.Id}", session.ToDto());
        });

        group.MapPost("/movements", async (CashMovementRequest request, AppDbContext db, CurrentUser current) =>
        {
            var session = await db.CashSessions.Include(s => s.Movements)
                .Where(s => s.Status == CashSessionStatus.Open)
                .OrderByDescending(s => s.OpenedAt).FirstOrDefaultAsync()
                ?? throw new ApiException("Abre la caja antes de registrar movimientos.", 400);
            if (request.Amount <= 0) Guard.BadRequest("El monto debe ser mayor a cero.");
            if (!Enum.TryParse<CashMovementType>(request.Type, true, out var type) ||
                type is not (CashMovementType.Income or CashMovementType.Expense or CashMovementType.Withdrawal))
                Guard.BadRequest("Selecciona un tipo de movimiento válido.");

            var movement = new CashMovement
            {
                CashSessionId = session.Id,
                Type = type,
                Concept = Guard.Require(request.Concept, "El concepto es obligatorio."),
                Amount = request.Amount,
                PaymentMethod = request.PaymentMethod,
                Reference = request.Reference,
                UserId = current.Id,
                UserName = current.Name,
                Date = DateTime.UtcNow
            };
            if (type == CashMovementType.Income) session.IncomeAmount += request.Amount;
            else session.ExpenseAmount += request.Amount;
            session.ExpectedAmount = session.OpeningAmount + session.SalesAmount + session.IncomeAmount - session.ExpenseAmount;
            db.CashMovements.Add(movement);
            await db.SaveChangesAsync();
            return Results.Created($"/api/cash/{session.Id}", session.ToDto());
        });

        group.MapPost("/close", async (CloseCashRequest request, AppDbContext db, CurrentUser current) =>
        {
            var session = await db.CashSessions.Include(s => s.Movements)
                .Where(s => s.Status == CashSessionStatus.Open)
                .OrderByDescending(s => s.OpenedAt).FirstOrDefaultAsync()
                ?? throw new ApiException("No hay una caja abierta para cerrar.", 400);
            if (request.CountedAmount < 0) Guard.BadRequest("El monto contado no puede ser negativo.");

            session.ExpectedAmount = session.OpeningAmount + session.SalesAmount + session.IncomeAmount - session.ExpenseAmount;
            session.CountedAmount = request.CountedAmount;
            session.Difference = Math.Round(request.CountedAmount - session.ExpectedAmount, 2);
            session.ClosedAt = DateTime.UtcNow;
            session.Status = CashSessionStatus.Closed;
            if (!string.IsNullOrWhiteSpace(request.Notes))
                session.Notes = string.IsNullOrWhiteSpace(session.Notes) ? request.Notes : $"{session.Notes} · {request.Notes}";

            db.AuditLogs.Add(new AuditLog
            {
                UserId = current.Id, UserName = current.Name, Action = "cash.closed", Entity = "CashSession",
                EntityId = session.Id.ToString(),
                Details = $"Cierre de caja · esperado {session.ExpectedAmount:N2} · contado {request.CountedAmount:N2} · diferencia {session.Difference:N2}"
            });
            await db.SaveChangesAsync();
            return Results.Ok(session.ToDto());
        }).RequirePermission(Permissions.SalesManage);
    }

    // ── Cuentas por cobrar ─────────────────────────────────────────────────
    private static void MapReceivables(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/receivables").WithTags("Cuentas por cobrar").RequireAuthorization()
            .RequirePermission(Permissions.CustomersManage);

        group.MapGet("", async (AppDbContext db, string? status, string? search) =>
        {
            var query = db.Receivables.AsNoTracking().Include(r => r.Payments).AsQueryable();
            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                query = query.Where(r => r.CustomerName.ToLower().Contains(term)
                    || (r.CustomerPhone != null && r.CustomerPhone.Contains(term))
                    || (r.SaleNumber != null && r.SaleNumber.ToLower().Contains(term)));
            }

            var all = await query.OrderByDescending(r => r.IssuedAt).ToListAsync();
            var dtos = all.Select(r => r.ToDto()).ToList();

            if (!string.IsNullOrWhiteSpace(status) && !string.Equals(status, "all", StringComparison.OrdinalIgnoreCase))
            {
                dtos = status.ToLowerInvariant() switch
                {
                    "overdue" => dtos.Where(r => r.DaysOverdue > 0 && r.Balance > 0).ToList(),
                    "pending" => dtos.Where(r => r.Status == "Pending" && r.Balance > 0).ToList(),
                    "partial" => dtos.Where(r => r.Status == "Partial" && r.Balance > 0).ToList(),
                    "paid" => dtos.Where(r => r.Status == "Paid").ToList(),
                    "cancelled" => dtos.Where(r => r.Status == "Cancelled").ToList(),
                    _ => dtos
                };
            }

            var open = dtos.Where(r => r.Balance > 0 && r.Status != "Cancelled").ToList();
            var today = DateTime.UtcNow.Date;
            var weekEnd = today.AddDays(7);
            var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var paymentsMonth = await db.ReceivablePayments.AsNoTracking()
                .Where(p => p.Date >= monthStart).SumAsync(p => (decimal?)p.Amount) ?? 0;

            var summary = new ReceivablesSummaryDto(
                open.Sum(r => r.Balance),
                open.Where(r => r.DaysOverdue > 0).Sum(r => r.Balance),
                open.Where(r => r.DueDate >= today && r.DueDate < weekEnd).Sum(r => r.Balance),
                paymentsMonth,
                open.Select(r => r.CustomerName).Distinct().Count(),
                open.Where(r => r.DaysOverdue == 0).Sum(r => r.Balance),
                open.Where(r => r.DaysOverdue is >= 1 and <= 30).Sum(r => r.Balance),
                open.Where(r => r.DaysOverdue is >= 31 and <= 60).Sum(r => r.Balance),
                open.Where(r => r.DaysOverdue > 60).Sum(r => r.Balance));

            return Results.Ok(new ReceivablesOverviewDto(dtos, summary, dtos.Count));
        });

        group.MapGet("/{id:guid}", async (Guid id, AppDbContext db) =>
        {
            var receivable = await db.Receivables.AsNoTracking().Include(r => r.Payments)
                .FirstOrDefaultAsync(r => r.Id == id) ?? throw new ApiException("Cuenta por cobrar no encontrada.", 404);
            return Results.Ok(receivable.ToDto());
        });

        group.MapPost("", async (SaveReceivableRequest request, AppDbContext db, CurrentUser current) =>
        {
            if (request.Total <= 0) Guard.BadRequest("El monto debe ser mayor a cero.");
            var name = request.CustomerName;
            string? phone = request.CustomerPhone;
            if (request.CustomerId.HasValue)
            {
                var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == request.CustomerId)
                    ?? throw new ApiException("Cliente no encontrado.", 404);
                name = customer.Name;
                phone ??= customer.Phone;
            }
            name = Guard.Require(name, "El nombre del cliente es obligatorio.");
            var issued = request.IssuedAt?.Date ?? DateTime.UtcNow.Date;
            var due = request.DueDate?.Date ?? issued.AddDays(30);
            if (due < issued) Guard.BadRequest("La fecha de vencimiento no puede ser anterior a la emisión.");

            var receivable = new Receivable
            {
                CustomerId = request.CustomerId,
                CustomerName = name,
                CustomerPhone = phone,
                Concept = Guard.Require(request.Concept, "El concepto es obligatorio."),
                Total = request.Total,
                IssuedAt = issued,
                DueDate = due,
                Notes = request.Notes,
                Status = ReceivableStatus.Pending
            };
            db.Receivables.Add(receivable);
            db.AuditLogs.Add(new AuditLog
            {
                UserId = current.Id, UserName = current.Name, Action = "receivable.created", Entity = "Receivable",
                EntityId = receivable.Id.ToString(), Details = $"{name} · {request.Total:N2}"
            });
            await db.SaveChangesAsync();
            return Results.Created($"/api/receivables/{receivable.Id}", receivable.ToDto());
        });

        group.MapPost("/{id:guid}/payments", async (Guid id, RegisterReceivablePaymentRequest request, AppDbContext db, CurrentUser current) =>
        {
            var receivable = await db.Receivables.Include(r => r.Payments).FirstOrDefaultAsync(r => r.Id == id)
                ?? throw new ApiException("Cuenta por cobrar no encontrada.", 404);
            if (receivable.Status == ReceivableStatus.Cancelled) Guard.BadRequest("Esta cuenta está anulada.");
            var balance = Math.Max(0, receivable.Total - receivable.PaidAmount);
            if (balance <= 0) Guard.BadRequest("Esta cuenta ya está pagada.");
            if (request.Amount <= 0) Guard.BadRequest("El abono debe ser mayor a cero.");
            if (request.Amount > balance) Guard.BadRequest($"El abono supera el saldo pendiente ({balance:N2}).");

            var payment = new ReceivablePayment
            {
                TenantId = receivable.TenantId,
                ReceivableId = receivable.Id,
                Amount = request.Amount,
                Method = request.Method,
                Reference = request.Reference,
                Notes = request.Notes,
                UserId = current.Id,
                UserName = current.Name,
                Date = DateTime.UtcNow
            };
            db.ReceivablePayments.Add(payment);
            receivable.Payments.Add(payment);
            receivable.PaidAmount += request.Amount;
            var newBalance = receivable.Total - receivable.PaidAmount;
            receivable.Status = newBalance <= 0.009m ? ReceivableStatus.Paid : ReceivableStatus.Partial;
            if (receivable.Status == ReceivableStatus.Paid) receivable.PaidAt = DateTime.UtcNow;

            db.AuditLogs.Add(new AuditLog
            {
                UserId = current.Id, UserName = current.Name, Action = "receivable.payment", Entity = "Receivable",
                EntityId = receivable.Id.ToString(), Details = $"Abono {request.Amount:N2} a {receivable.CustomerName}"
            });
            await db.SaveChangesAsync();
            return Results.Ok(receivable.ToDto());
        }).RequirePermission(Permissions.CustomersManage);

        group.MapPost("/{id:guid}/cancel", async (Guid id, AppDbContext db) =>
        {
            var receivable = await db.Receivables.Include(r => r.Payments).FirstOrDefaultAsync(r => r.Id == id)
                ?? throw new ApiException("Cuenta por cobrar no encontrada.", 404);
            if (receivable.PaidAmount > 0) Guard.BadRequest("No puedes anular una cuenta con abonos registrados.");
            receivable.Status = ReceivableStatus.Cancelled;
            receivable.Notes = string.IsNullOrWhiteSpace(receivable.Notes) ? "Anulada" : $"{receivable.Notes} · Anulada";
            await db.SaveChangesAsync();
            return Results.Ok(receivable.ToDto());
        }).RequirePermission(Permissions.CustomersManage);
    }

    // ── Pedidos ────────────────────────────────────────────────────────────
    private static void MapOrders(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/orders").WithTags("Pedidos").RequireAuthorization()
            .RequirePermission(Permissions.SalesManage);

        group.MapGet("", async (AppDbContext db, string? status, string? channel, string? search) =>
        {
            var query = db.Orders.AsNoTracking().Include(o => o.Items).AsQueryable();
            if (!string.IsNullOrWhiteSpace(status) && !string.Equals(status, "all", StringComparison.OrdinalIgnoreCase)
                && Enum.TryParse<OrderStatus>(status, true, out var st))
                query = query.Where(o => o.Status == st);
            if (!string.IsNullOrWhiteSpace(channel) && !string.Equals(channel, "all", StringComparison.OrdinalIgnoreCase)
                && Enum.TryParse<OrderChannel>(channel, true, out var ch))
                query = query.Where(o => o.Channel == ch);
            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                query = query.Where(o => o.Number.ToLower().Contains(term)
                    || o.CustomerName.ToLower().Contains(term)
                    || (o.CustomerPhone != null && o.CustomerPhone.Contains(term)));
            }

            var items = await query.OrderByDescending(o => o.CreatedAt).Take(150).ToListAsync();
            var today = DateTime.UtcNow.Date;
            var tomorrow = today.AddDays(1);
            var all = await db.Orders.AsNoTracking().ToListAsync();
            var stats = new OrderStatsDto(
                all.Count(o => o.Status == OrderStatus.Pending),
                all.Count(o => o.Status == OrderStatus.Confirmed),
                all.Count(o => o.Status == OrderStatus.Preparing),
                all.Count(o => o.Status == OrderStatus.Ready),
                all.Count(o => o.Status == OrderStatus.Delivered && o.DeliveredAt >= today && o.DeliveredAt < tomorrow),
                all.Where(o => o.Status == OrderStatus.Delivered && o.DeliveredAt >= today && o.DeliveredAt < tomorrow).Sum(o => o.Total),
                all.Count(o => o.Channel == OrderChannel.WhatsApp && o.Status is OrderStatus.Pending or OrderStatus.Confirmed or OrderStatus.Preparing or OrderStatus.Ready),
                all.Count(o => o.Channel == OrderChannel.Instagram && o.Status is OrderStatus.Pending or OrderStatus.Confirmed or OrderStatus.Preparing or OrderStatus.Ready));

            return Results.Ok(new OrdersOverviewDto(items.Select(o => o.ToDto()).ToList(), stats));
        });

        group.MapPost("", async (SaveOrderRequest request, AppDbContext db, CurrentUser current) =>
        {
            if (request.Items is null || request.Items.Count == 0) Guard.BadRequest("Agrega al menos un producto al pedido.");
            var requestedItems = request.Items!;
            if (!Enum.TryParse<OrderChannel>(request.Channel, true, out var channel)) channel = OrderChannel.Counter;

            var productIds = requestedItems.Where(i => i.ProductId.HasValue).Select(i => i.ProductId!.Value).Distinct().ToList();
            var products = await db.Products.Where(p => productIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id);
            var customer = request.CustomerId.HasValue
                ? await db.Customers.FirstOrDefaultAsync(c => c.Id == request.CustomerId)
                : null;
            var order = new Order
            {
                Number = await BusinessOperations.NextOrderNumberAsync(db, current.TenantId),
                Channel = channel,
                Status = OrderStatus.Pending,
                CustomerId = customer?.Id,
                CustomerName = customer?.Name ?? (string.IsNullOrWhiteSpace(request.CustomerName) ? "Cliente ocasional" : request.CustomerName.Trim()),
                CustomerPhone = request.CustomerPhone ?? customer?.Phone,
                BranchId = current.BranchId,
                DueAt = request.DueAt,
                Notes = request.Notes
            };

            foreach (var item in requestedItems)
            {
                if (item.Quantity <= 0) Guard.BadRequest("Las cantidades deben ser mayores a cero.");
                products.TryGetValue(item.ProductId ?? Guid.Empty, out var product);
                var name = !string.IsNullOrWhiteSpace(item.ProductName) ? item.ProductName.Trim() : product?.Name;
                name = Guard.Require(name, "Cada pedido necesita el nombre del producto.");
                var price = item.UnitPrice ?? product?.Price ?? 0;
                if (price < 0) Guard.BadRequest("El precio no puede ser negativo.");
                order.Items.Add(new OrderItem
                {
                    ProductId = product?.Id,
                    ProductName = name,
                    Quantity = item.Quantity,
                    UnitPrice = price,
                    Total = price * item.Quantity,
                    Notes = item.Notes
                });
            }

            order.Total = order.Items.Sum(i => i.Total);
            db.Orders.Add(order);
            db.AuditLogs.Add(new AuditLog
            {
                UserId = current.Id, UserName = current.Name, Action = "order.created", Entity = "Order",
                EntityId = order.Id.ToString(), Details = $"Pedido {order.Number} · {channel} · {order.Total:N2}"
            });
            await db.SaveChangesAsync();
            return Results.Created($"/api/orders/{order.Id}", order.ToDto());
        }).RequirePermission(Permissions.SalesManage);

        group.MapPut("/{id:guid}/status", async (Guid id, UpdateOrderStatusRequest request, AppDbContext db) =>
        {
            var order = await db.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == id)
                ?? throw new ApiException("Pedido no encontrado.", 404);
            if (!Enum.TryParse<OrderStatus>(request.Status, true, out var status))
                Guard.BadRequest("Estado de pedido inválido.");
            if (order.SaleId.HasValue && status == OrderStatus.Cancelled)
                Guard.BadRequest("Este pedido ya generó una venta. Anula la venta desde Ventas.");

            order.Status = status;
            if (status == OrderStatus.Delivered)
            {
                order.DeliveredAt ??= DateTime.UtcNow;
                if (!order.SaleId.HasValue) order.DeliveredAt = DateTime.UtcNow;
            }
            await db.SaveChangesAsync();
            return Results.Ok(order.ToDto());
        }).RequirePermission(Permissions.SalesManage);

        group.MapPost("/{id:guid}/convert", async (Guid id, ConvertOrderRequest request, AppDbContext db, CurrentUser current) =>
        {
            var order = await db.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == id)
                ?? throw new ApiException("Pedido no encontrado.", 404);
            if (order.SaleId.HasValue) Guard.BadRequest($"Este pedido ya generó la venta {order.SaleNumber}.");
            if (order.Status == OrderStatus.Cancelled) Guard.BadRequest("No puedes convertir un pedido cancelado.");

            var tenant = await db.Tenants.FirstAsync(t => t.Id == current.TenantId);
            if (!Enum.TryParse<PaymentMethod>(request.PaymentMethod, true, out var paymentMethod))
                paymentMethod = PaymentMethod.Cash;

            var branchId = current.BranchId ?? order.BranchId;
            var seller = await db.Users.FirstOrDefaultAsync(u => u.Id == current.Id);
            var sale = new Sale
            {
                BranchId = branchId,
                CustomerId = order.CustomerId,
                CustomerName = order.CustomerName,
                UserId = current.Id,
                UserName = seller?.FullName ?? current.Name,
                PaymentMethod = paymentMethod,
                Status = paymentMethod == PaymentMethod.Credit ? SaleStatus.Pending : SaleStatus.Completed,
                Channel = order.Channel.ToString(),
                Notes = $"Generada desde el pedido {order.Number}"
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

            var productIds = order.Items.Where(i => i.ProductId.HasValue).Select(i => i.ProductId!.Value).Distinct().ToList();
            var products = await db.Products.Include(p => p.Variants)
                .Where(p => productIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id);

            foreach (var item in order.Items)
            {
                products.TryGetValue(item.ProductId ?? Guid.Empty, out var product);
                decimal unitCost = product?.Cost ?? 0;
                if (product is not null && product.TrackStock)
                {
                    var available = product.Variants.Count > 0 ? product.Variants.Sum(v => v.Stock) : product.Stock;
                    if (available < item.Quantity)
                        Guard.BadRequest($"Stock insuficiente de {product.Name}. Disponible: {available} unidades.");
                    var previous = available;
                    if (product.Variants.Count > 0)
                    {
                        var variant = product.Variants.FirstOrDefault(v => v.Stock >= item.Quantity) ?? product.Variants.First();
                        variant.Stock -= item.Quantity;
                        product.Stock = product.Variants.Sum(v => v.Stock);
                        db.InventoryMovements.Add(new InventoryMovement
                        {
                            ProductId = product.Id,
                            VariantId = variant.Id,
                            BranchId = branchId,
                            Type = MovementType.Sale,
                            Quantity = item.Quantity,
                            PreviousStock = variant.Stock + item.Quantity,
                            NewStock = variant.Stock,
                            Reference = sale.Number,
                            ProductName = product.Name,
                            UserId = current.Id,
                            UserName = sale.UserName
                        });
                    }
                    else
                    {
                        product.Stock -= item.Quantity;
                        db.InventoryMovements.Add(new InventoryMovement
                        {
                            ProductId = product.Id,
                            BranchId = branchId,
                            Type = MovementType.Sale,
                            Quantity = item.Quantity,
                            PreviousStock = previous,
                            NewStock = product.Stock,
                            Reference = sale.Number,
                            ProductName = product.Name,
                            UserId = current.Id,
                            UserName = sale.UserName
                        });
                    }
                }

                sale.Items.Add(new SaleItem
                {
                    ProductId = product?.Id ?? Guid.Empty,
                    ProductName = item.ProductName,
                    Sku = product?.Sku,
                    Quantity = item.Quantity,
                    UnitPrice = item.UnitPrice,
                    UnitCost = unitCost,
                    Discount = 0,
                    Total = item.Total
                });
            }

            var subtotal = sale.Items.Sum(i => i.Total);
            var tax = tenant.TaxIncluded
                ? Math.Round(subtotal * tenant.TaxRate / (100 + tenant.TaxRate), 2)
                : Math.Round(subtotal * tenant.TaxRate / 100, 2);
            sale.Subtotal = subtotal;
            sale.Discount = 0;
            sale.Tax = tax;
            sale.Total = tenant.TaxIncluded ? subtotal : subtotal + tax;
            if (paymentMethod == PaymentMethod.Credit && request.PaidAmount is > 0 && request.PaidAmount > sale.Total)
                Guard.BadRequest($"El abono inicial no puede superar el total de la venta ({sale.Total:N2}).");
            sale.PaidAmount = request.PaidAmount ?? (paymentMethod == PaymentMethod.Credit ? 0 : sale.Total);
            sale.Change = Math.Max(0, sale.PaidAmount - sale.Total);

            db.Sales.Add(sale);
            if (order.CustomerId.HasValue)
            {
                var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == order.CustomerId);
                if (customer is not null) customer.LoyaltyPoints += (int)Math.Floor(sale.Total / 10);
            }
            await BusinessOperations.AddCashFromSaleAsync(db, sale, current.Id, sale.UserName);
            await BusinessOperations.CreateReceivableFromSaleAsync(db, sale, request.DueDays ?? 30);

            order.Status = OrderStatus.Delivered;
            order.DeliveredAt = DateTime.UtcNow;
            order.SaleId = sale.Id;
            order.SaleNumber = sale.Number;

            db.AuditLogs.Add(new AuditLog
            {
                UserId = current.Id, UserName = current.Name, Action = "order.converted", Entity = "Order",
                EntityId = order.Id.ToString(), Details = $"Pedido {order.Number} convertido en venta {sale.Number}"
            });
            await db.SaveChangesAsync();

            return Results.Ok(new { order = order.ToDto(), saleNumber = sale.Number });
        }).RequirePermission(Permissions.SalesManage);
    }
}
