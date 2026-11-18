using Microsoft.EntityFrameworkCore;
using NexComerce.Api.Contracts;
using NexComerce.Api.Infrastructure;
using NexComerce.Domain.Catalog;
using NexComerce.Domain.Common;
using NexComerce.Domain.Sales;
using NexComerce.Domain.WhatsApp;
using NexComerce.Infrastructure.Persistence;

namespace NexComerce.Api.Endpoints;

public static class ReportEndpoints
{
    public static void MapReportEndpoints(this IEndpointRouteBuilder app)
    {
        var reports = app.MapGroup("/api/reports").WithTags("Reportes").RequireAuthorization();

        app.MapGet("/api/dashboard", async (AppDbContext db, int days = 30) =>
        {
            days = days is 7 or 90 ? days : 30;
            var today = DateTime.UtcNow.Date;
            var monthStart = new DateTime(today.Year, today.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var prevMonthStart = monthStart.AddMonths(-1);
            var seriesStart = today.AddDays(-(days - 1));

            var sales = await db.Sales.AsNoTracking().Include(s => s.Items)
                .Where(s => s.CreatedAt >= prevMonthStart && s.Status != SaleStatus.Cancelled).ToListAsync();
            var allProducts = await db.Products.AsNoTracking().Include(p => p.Category).Include(p => p.Variants)
                .Where(p => p.IsActive).ToListAsync();
            var productLookup = allProducts.ToDictionary(p => p.Id);
            var expenses = await db.Expenses.AsNoTracking().Where(e => e.Date >= monthStart).ToListAsync();
            var customers = await db.Customers.AsNoTracking().ToListAsync();
            var conversations = await db.Conversations.AsNoTracking().ToListAsync();
            var automated = await db.Messages.AsNoTracking().CountAsync(m => m.IsAutomated && m.CreatedAt >= monthStart);

            var todaySales = sales.Where(s => s.CreatedAt >= today).ToList();
            var yesterdaySales = sales.Where(s => s.CreatedAt >= today.AddDays(-1) && s.CreatedAt < today).ToList();
            var monthSales = sales.Where(s => s.CreatedAt >= monthStart).ToList();
            var prevMonthSales = sales.Where(s => s.CreatedAt >= prevMonthStart && s.CreatedAt < monthStart).ToList();

            var monthRevenue = monthSales.Sum(s => s.Total);
            var monthTax = monthSales.Sum(s => s.Tax);
            var cogs = monthSales.SelectMany(s => s.Items).Sum(i => i.UnitCost * i.Quantity);
            var expensesMonth = expenses.Sum(e => e.Amount);
            var salesChange = prevMonthSales.Sum(s => s.Total) > 0
                ? Math.Round((monthRevenue - prevMonthSales.Sum(s => s.Total)) / prevMonthSales.Sum(s => s.Total) * 100, 1)
                : 0;
            var avgTicket = monthSales.Count > 0 ? Math.Round(monthRevenue / monthSales.Count, 2) : 0;
            var avgPrev = prevMonthSales.Count > 0 ? Math.Round(prevMonthSales.Sum(s => s.Total) / prevMonthSales.Count, 2) : 0;

            var series = new List<DailySalesDto>();
            for (var d = seriesStart; d <= today; d = d.AddDays(1))
            {
                var daySales = sales.Where(s => s.CreatedAt >= d && s.CreatedAt < d.AddDays(1)).ToList();
                series.Add(new DailySalesDto(d.ToString("yyyy-MM-dd"), daySales.Sum(s => s.Total), daySales.Count));
            }

            var periodItems = sales.Where(s => s.CreatedAt >= seriesStart).SelectMany(s => s.Items).ToList();
            var byCategory = periodItems
                .GroupBy(i => productLookup.TryGetValue(i.ProductId, out var p) ? (p.Category?.Name ?? "Sin categoría") : "Otros")
                .Select(g =>
                {
                    var sample = g.Select(i => productLookup.GetValueOrDefault(i.ProductId)).FirstOrDefault(p => p?.Category != null);
                    return new CategorySalesDto(g.Key, sample?.Category?.Color ?? "#7C3AED", g.Sum(i => i.Total), g.Sum(i => i.Quantity));
                }).OrderByDescending(x => x.Total).ToList();

            var topProducts = periodItems.GroupBy(i => i.ProductId).Select(g =>
                {
                    var p = productLookup.GetValueOrDefault(g.Key);
                    var first = g.First();
                    return new TopProductDto(g.Key, p?.Name ?? first.ProductName, p?.ImageUrl, p?.Category?.Name,
                        g.Sum(i => i.Quantity), g.Sum(i => i.Total));
                }).OrderByDescending(x => x.Quantity).Take(6).ToList();

            var recent = await db.Sales.AsNoTracking().Include(s => s.Items).OrderByDescending(s => s.CreatedAt).Take(6).ToListAsync();
            var branchIds = recent.Where(s => s.BranchId != null).Select(s => s.BranchId!.Value).Distinct().ToList();
            var branches = await db.Branches.AsNoTracking().Where(b => branchIds.Contains(b.Id)).ToDictionaryAsync(b => b.Id, b => b.Name);

            var lowStock = allProducts.Where(p => p.TrackStock && p.Type == ProductType.Product)
                .Select(p => new { p, stock = p.Variants.Count > 0 ? p.Variants.Sum(v => v.Stock) : p.Stock })
                .Where(x => x.stock <= x.p.MinStock)
                .OrderBy(x => x.stock).Take(6)
                .Select(x => new LowStockItemDto(x.p.Id, x.p.Name, x.p.ImageUrl, x.stock, x.p.MinStock, x.p.Category?.Name, x.p.Price))
                .ToList();

            var physical = allProducts.Where(p => p.TrackStock && p.Type == ProductType.Product).ToList();
            var inventoryValue = physical.Sum(p => (p.Variants.Count > 0 ? p.Variants.Sum(v => v.Stock) : p.Stock) * p.Cost);

            return Results.Ok(new DashboardDto(
                todaySales.Sum(s => s.Total), yesterdaySales.Sum(s => s.Total), monthRevenue, prevMonthSales.Sum(s => s.Total),
                todaySales.Count, monthSales.Count, avgTicket, avgPrev,
                customers.Count(c => c.CreatedAt >= monthStart), customers.Count,
                lowStock.Count(x => x.Stock > 0), physical.Count(p => (p.Variants.Count > 0 ? p.Variants.Sum(v => v.Stock) : p.Stock) == 0),
                inventoryValue, expensesMonth, monthRevenue - monthTax - cogs - expensesMonth, salesChange,
                conversations.Count(c => c.Status != ConversationStatus.Closed), automated,
                monthSales.Count(s => s.Status == SaleStatus.Pending),
                series, byCategory, topProducts,
                recent.Select(s => s.ToSummary(s.BranchId != null && branches.TryGetValue(s.BranchId.Value, out var bn) ? bn : null)).ToList(),
                lowStock,
                monthSales.GroupBy(s => s.PaymentMethod).Select(g => new PaymentTotalDto(g.Key.ToString(), g.Sum(s => s.Total), g.Count()))
                    .OrderByDescending(x => x.Total).ToList()));
        }).RequireAuthorization().RequirePermission(Permissions.DashboardView);

        reports.MapGet("/sales", async (AppDbContext db, DateTime? from, DateTime? to, string? groupBy) =>
        {
            var start = from?.Date ?? DateTime.UtcNow.Date.AddDays(-29);
            var end = (to?.Date ?? DateTime.UtcNow.Date).AddDays(1);
            var sales = await db.Sales.AsNoTracking().Include(s => s.Items)
                .Where(s => s.CreatedAt >= start && s.CreatedAt < end && s.Status != SaleStatus.Cancelled).ToListAsync();
            var products = await db.Products.AsNoTracking().Include(p => p.Category).ToListAsync();
            var lookup = products.ToDictionary(p => p.Id);
            var branches = await db.Branches.AsNoTracking().ToDictionaryAsync(b => b.Id, b => b.Name);

            var revenue = sales.Sum(s => s.Total);
            var tax = sales.Sum(s => s.Tax);
            var cost = sales.SelectMany(s => s.Items).Sum(i => i.UnitCost * i.Quantity);
            var items = sales.SelectMany(s => s.Items).ToList();

            var series = new List<DailySalesDto>();
            for (var d = start; d < end; d = d.AddDays(1))
            {
                var day = sales.Where(s => s.CreatedAt >= d && s.CreatedAt < d.AddDays(1)).ToList();
                series.Add(new DailySalesDto(d.ToString("yyyy-MM-dd"), day.Sum(s => s.Total), day.Count));
            }

            var top = items.GroupBy(i => i.ProductId).Select(g =>
            {
                var p = lookup.GetValueOrDefault(g.Key);
                return new TopProductDto(g.Key, p?.Name ?? g.First().ProductName, p?.ImageUrl, p?.Category?.Name,
                    g.Sum(i => i.Quantity), g.Sum(i => i.Total));
            }).OrderByDescending(x => x.Quantity).Take(10).ToList();

            var byCategory = items.GroupBy(i => lookup.TryGetValue(i.ProductId, out var p) ? (p.Category?.Name ?? "Sin categoría") : "Otros")
                .Select(g => new CategorySalesDto(g.Key,
                    g.Select(i => lookup.GetValueOrDefault(i.ProductId)).FirstOrDefault(p => p?.Category != null)?.Category?.Color ?? "#7C3AED",
                    g.Sum(i => i.Total), g.Sum(i => i.Quantity))).OrderByDescending(x => x.Total).ToList();

            return Results.Ok(new SalesReportDto(start, end.AddDays(-1), revenue, sales.Count,
                sales.Count > 0 ? Math.Round(revenue / sales.Count, 2) : 0, tax, sales.Sum(s => s.Discount),
                cost, revenue - tax - cost, series,
                sales.GroupBy(s => s.PaymentMethod).Select(g => new PaymentTotalDto(g.Key.ToString(), g.Sum(s => s.Total), g.Count()))
                    .OrderByDescending(x => x.Total).ToList(),
                byCategory, top,
                sales.GroupBy(s => s.UserId).Select(g => new SellerReportDto(g.Key, g.First().UserName ?? "Sin asignar", g.Count(), g.Sum(s => s.Total)))
                    .OrderByDescending(x => x.Total).ToList(),
                sales.GroupBy(s => s.BranchId).Select(g => new BranchReportDto(g.Key,
                    g.Key != null && branches.TryGetValue(g.Key.Value, out var bn) ? bn : "Sin sucursal", g.Count(), g.Sum(s => s.Total)))
                    .OrderByDescending(x => x.Total).ToList(),
                sales.OrderByDescending(s => s.CreatedAt).Take(50)
                    .Select(s => s.ToSummary(s.BranchId != null && branches.TryGetValue(s.BranchId.Value, out var bn) ? bn : null)).ToList()));
        }).RequirePermission(Permissions.ReportsView);

        reports.MapGet("/inventory", async (AppDbContext db) =>
        {
            var products = await db.Products.AsNoTracking().Include(p => p.Category).Include(p => p.Variants)
                .Where(p => p.IsActive).ToListAsync();
            var physical = products.Where(p => p.TrackStock && p.Type == ProductType.Product).ToList();
            int Stock(Product p) => p.Variants.Count > 0 ? p.Variants.Sum(v => v.Stock) : p.Stock;

            var summary = new InventorySummaryDto(products.Count, physical.Sum(Stock),
                physical.Sum(p => Stock(p) * p.Cost), physical.Sum(p => Stock(p) * p.Price),
                physical.Count(p => Stock(p) <= p.MinStock), physical.Count(p => Stock(p) == 0),
                physical.GroupBy(p => p.Category?.Name ?? "Sin categoría")
                    .Select(g => new StockByCategoryDto(g.Key, g.First().Category?.Color ?? "#7C3AED", g.Count(), g.Sum(Stock), g.Sum(p => Stock(p) * p.Cost)))
                    .OrderByDescending(x => x.Value).ToList());

            var byCategory = physical.GroupBy(p => p.Category?.Name ?? "Sin categoría").Select(g => new CategoryInventoryDto(
                g.Key, g.First().Category?.Color ?? "#7C3AED", g.Sum(Stock), g.Sum(p => Stock(p) * p.Cost), g.Sum(p => Stock(p) * p.Price)))
                .OrderByDescending(x => x.RetailValue).ToList();

            var low = physical.Where(p => Stock(p) <= p.MinStock).OrderBy(Stock)
                .Select(p => new LowStockItemDto(p.Id, p.Name, p.ImageUrl, Stock(p), p.MinStock, p.Category?.Name, p.Price))
                .ToList();

            var movements = await db.InventoryMovements.AsNoTracking().OrderByDescending(m => m.CreatedAt).Take(25).ToListAsync();
            var totals = movements.GroupBy(m => m.Type).Select(g => new MovementTypeTotalDto(g.Key.ToString(), g.Count(), g.Sum(m => m.Quantity))).ToList();

            return Results.Ok(new InventoryReportDto(summary, byCategory, low,
                movements.Select(m => m.ToDto()).ToList(), totals));
        }).RequirePermission(Permissions.ReportsView);

        reports.MapGet("/profit", async (AppDbContext db, DateTime? from, DateTime? to) =>
        {
            var start = from?.Date ?? DateTime.UtcNow.Date.AddDays(-29);
            var end = (to?.Date ?? DateTime.UtcNow.Date).AddDays(1);
            var sales = await db.Sales.AsNoTracking().Include(s => s.Items)
                .Where(s => s.CreatedAt >= start && s.CreatedAt < end && s.Status != SaleStatus.Cancelled).ToListAsync();
            var expenses = await db.Expenses.AsNoTracking().Where(e => e.Date >= start && e.Date < end).ToListAsync();

            var revenue = sales.Sum(s => s.Total) - sales.Sum(s => s.Tax);
            var cost = sales.SelectMany(s => s.Items).Sum(i => i.UnitCost * i.Quantity);
            var gross = revenue - cost;
            var expensesTotal = expenses.Sum(e => e.Amount);
            var net = gross - expensesTotal;

            var series = new List<DailyProfitDto>();
            for (var d = start; d < end; d = d.AddDays(1))
            {
                var daySales = sales.Where(s => s.CreatedAt >= d && s.CreatedAt < d.AddDays(1)).ToList();
                var dayExpenses = expenses.Where(e => e.Date >= d && e.Date < d.AddDays(1)).ToList();
                series.Add(new DailyProfitDto(d.ToString("yyyy-MM-dd"),
                    daySales.Sum(s => s.Total) - daySales.Sum(s => s.Tax),
                    daySales.SelectMany(s => s.Items).Sum(i => i.UnitCost * i.Quantity),
                    dayExpenses.Sum(e => e.Amount)));
            }

            return Results.Ok(new ProfitReportDto(start, end.AddDays(-1), revenue, cost, gross, expensesTotal, net,
                revenue > 0 ? Math.Round(net / revenue * 100, 1) : 0, series,
                expenses.GroupBy(e => e.Category).Select(g => new ExpenseCategoryDto(g.Key, g.Sum(e => e.Amount), g.Count()))
                    .OrderByDescending(x => x.Total).ToList()));
        }).RequirePermission(Permissions.ReportsView);
    }
}
