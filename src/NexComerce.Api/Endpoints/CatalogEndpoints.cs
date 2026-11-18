using Microsoft.EntityFrameworkCore;
using NexComerce.Api.Contracts;
using NexComerce.Api.Infrastructure;
using NexComerce.Domain.Catalog;
using NexComerce.Domain.Common;
using NexComerce.Domain.Inventory;
using NexComerce.Infrastructure.Persistence;

namespace NexComerce.Api.Endpoints;

public static class CatalogEndpoints
{
    public static void MapCatalogEndpoints(this IEndpointRouteBuilder app)
    {
        var categories = app.MapGroup("/api/categories").WithTags("Categorías").RequireAuthorization();
        var products = app.MapGroup("/api/products").WithTags("Productos").RequireAuthorization();
        var inventory = app.MapGroup("/api/inventory").WithTags("Inventario").RequireAuthorization();

        // ── Categories ──────────────────────────────────────────────────────
        categories.MapGet("", async (AppDbContext db) =>
        {
            var counts = await db.Products.GroupBy(p => p.CategoryId)
                .Select(g => new { CategoryId = g.Key, Count = g.Count() }).ToListAsync();
            var list = await db.Categories.OrderBy(c => c.Name).ToListAsync();
            return Results.Ok(list.Select(c => c.ToDto(counts.FirstOrDefault(x => x.CategoryId == c.Id)?.Count ?? 0)).ToList());
        });

        categories.MapPost("", async (SaveCategoryRequest request, AppDbContext db) =>
        {
            var name = Guard.Require(request.Name, "El nombre de la categoría es obligatorio.");
            if (await db.Categories.AnyAsync(c => c.Name.ToLower() == name.ToLower()))
                Guard.BadRequest("Ya existe una categoría con ese nombre.");
            var category = new Category
            {
                Name = name,
                Description = request.Description,
                Color = string.IsNullOrWhiteSpace(request.Color) ? "#7C3AED" : request.Color,
                Icon = request.Icon,
                IsActive = request.IsActive
            };
            db.Categories.Add(category);
            await db.SaveChangesAsync();
            return Results.Created($"/api/categories/{category.Id}", category.ToDto());
        }).RequirePermission(Permissions.ProductsManage);

        categories.MapPut("/{id:guid}", async (Guid id, SaveCategoryRequest request, AppDbContext db) =>
        {
            var category = await db.Categories.FirstOrDefaultAsync(c => c.Id == id) ?? throw new ApiException("Categoría no encontrada.", 404);
            var name = Guard.Require(request.Name, "El nombre de la categoría es obligatorio.");
            if (await db.Categories.AnyAsync(c => c.Id != id && c.Name.ToLower() == name.ToLower()))
                Guard.BadRequest("Ya existe una categoría con ese nombre.");
            category.Name = name;
            category.Description = request.Description;
            category.Color = string.IsNullOrWhiteSpace(request.Color) ? category.Color : request.Color;
            category.Icon = request.Icon;
            category.IsActive = request.IsActive;
            await db.SaveChangesAsync();
            var count = await db.Products.CountAsync(p => p.CategoryId == id);
            return Results.Ok(category.ToDto(count));
        }).RequirePermission(Permissions.ProductsManage);

        categories.MapDelete("/{id:guid}", async (Guid id, AppDbContext db) =>
        {
            var category = await db.Categories.FirstOrDefaultAsync(c => c.Id == id) ?? throw new ApiException("Categoría no encontrada.", 404);
            category.IsActive = false;
            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Categoría desactivada." });
        }).RequirePermission(Permissions.ProductsManage);

        // ── Products ────────────────────────────────────────────────────────
        products.MapGet("", async (AppDbContext db, string? search, Guid? categoryId, string? type,
            bool? lowStock, bool? includeInactive, int page = 1, int pageSize = 20) =>
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);
            var query = db.Products.AsNoTracking().Include(p => p.Category).Include(p => p.Variants).AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                query = query.Where(p => p.Name.ToLower().Contains(term) || p.Sku.ToLower().Contains(term)
                    || (p.Barcode != null && p.Barcode.Contains(term)) || (p.Brand != null && p.Brand.ToLower().Contains(term))
                    || (p.Tags != null && p.Tags.ToLower().Contains(term)));
            }
            if (categoryId.HasValue) query = query.Where(p => p.CategoryId == categoryId);
            if (!string.IsNullOrWhiteSpace(type) && Enum.TryParse<ProductType>(type, true, out var productType))
                query = query.Where(p => p.Type == productType);
            if (includeInactive != true) query = query.Where(p => p.IsActive);

            var total = await query.CountAsync();
            var list = await query.OrderByDescending(p => p.CreatedAt).ThenBy(p => p.Name)
                .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

            if (lowStock == true)
            {
                list = list.Where(p => p.TrackStock && p.Type == ProductType.Product &&
                    (p.Variants.Count > 0 ? p.Variants.Sum(v => v.Stock) : p.Stock) <= p.MinStock).ToList();
            }

            return Results.Ok(new PageResult<ProductDto>(list.Select(p => p.ToDto()).ToList(), total, page, pageSize));
        });

        products.MapGet("/{id:guid}", async (Guid id, AppDbContext db) =>
        {
            var product = await db.Products.AsNoTracking().Include(p => p.Category).Include(p => p.Variants)
                .FirstOrDefaultAsync(p => p.Id == id) ?? throw new ApiException("Producto no encontrado.", 404);
            return Results.Ok(product.ToDto());
        });

        products.MapPost("", async (SaveProductRequest request, AppDbContext db, CurrentUser current) =>
        {
            var name = Guard.Require(request.Name, "El nombre del producto es obligatorio.");
            var sku = string.IsNullOrWhiteSpace(request.Sku)
                ? $"PRD-{await db.Products.CountAsync() + 1:0000}"
                : request.Sku.Trim().ToUpperInvariant();
            if (await db.Products.AnyAsync(p => p.Sku == sku)) Guard.BadRequest($"El SKU {sku} ya está en uso.");
            if (request.Price < 0 || request.Cost < 0) Guard.BadRequest("El precio y el costo no pueden ser negativos.");

            var type = Enum.TryParse<ProductType>(request.Type, true, out var pt) ? pt : ProductType.Product;
            var product = new Product
            {
                Name = name,
                Sku = sku,
                Barcode = request.Barcode,
                Description = request.Description,
                CategoryId = request.CategoryId,
                Type = type,
                Price = request.Price,
                Cost = request.Cost,
                CompareAtPrice = request.CompareAtPrice,
                Unit = string.IsNullOrWhiteSpace(request.Unit) ? "unidad" : request.Unit,
                ImageUrl = request.ImageUrl,
                Brand = request.Brand,
                IsActive = request.IsActive,
                TrackStock = type == ProductType.Product && request.TrackStock,
                Stock = Math.Max(0, request.Stock),
                MinStock = Math.Max(0, request.MinStock),
                Tags = request.Tags
            };

            if (request.Variants is { Count: > 0 })
            {
                foreach (var v in request.Variants.Where(v => !string.IsNullOrWhiteSpace(v.Name)))
                {
                    var stock = Math.Max(0, v.Stock);
                    product.Variants.Add(new ProductVariant
                    {
                        Name = v.Name.Trim(),
                        Sku = v.Sku,
                        Price = v.Price,
                        Stock = stock,
                        IsActive = v.IsActive
                    });
                }
                product.Stock = product.Variants.Sum(v => v.Stock);
            }

            db.Products.Add(product);
            if (product.TrackStock && product.Stock > 0)
            {
                db.InventoryMovements.Add(new InventoryMovement
                {
                    ProductId = product.Id,
                    Type = MovementType.In,
                    Quantity = product.Stock,
                    PreviousStock = 0,
                    NewStock = product.Stock,
                    Notes = "Stock inicial",
                    Reference = "INICIAL",
                    ProductName = product.Name,
                    UserId = current.Id,
                    UserName = current.Name
                });
            }
            await db.SaveChangesAsync();

            var created = await db.Products.Include(p => p.Category).Include(p => p.Variants).FirstAsync(p => p.Id == product.Id);
            return Results.Created($"/api/products/{product.Id}", created.ToDto());
        }).RequirePermission(Permissions.ProductsManage);

        products.MapPut("/{id:guid}", async (Guid id, SaveProductRequest request, AppDbContext db, CurrentUser current) =>
        {
            var product = await db.Products.Include(p => p.Variants).FirstOrDefaultAsync(p => p.Id == id)
                ?? throw new ApiException("Producto no encontrado.", 404);
            var name = Guard.Require(request.Name, "El nombre del producto es obligatorio.");
            var sku = string.IsNullOrWhiteSpace(request.Sku) ? product.Sku : request.Sku.Trim().ToUpperInvariant();
            if (await db.Products.AnyAsync(p => p.Id != id && p.Sku == sku)) Guard.BadRequest($"El SKU {sku} ya está en uso.");
            if (request.Price < 0 || request.Cost < 0) Guard.BadRequest("El precio y el costo no pueden ser negativos.");

            var type = Enum.TryParse<ProductType>(request.Type, true, out var pt) ? pt : product.Type;
            var previousStock = product.Variants.Count > 0 ? product.Variants.Sum(v => v.Stock) : product.Stock;

            product.Name = name;
            product.Sku = sku;
            product.Barcode = request.Barcode;
            product.Description = request.Description;
            product.CategoryId = request.CategoryId;
            product.Type = type;
            product.Price = request.Price;
            product.Cost = request.Cost;
            product.CompareAtPrice = request.CompareAtPrice;
            product.Unit = string.IsNullOrWhiteSpace(request.Unit) ? product.Unit : request.Unit;
            product.ImageUrl = request.ImageUrl;
            product.Brand = request.Brand;
            product.IsActive = request.IsActive;
            product.TrackStock = type == ProductType.Product && request.TrackStock;
            product.MinStock = Math.Max(0, request.MinStock);
            product.Tags = request.Tags;

            if (request.Variants is not null)
            {
                foreach (var v in request.Variants.Where(v => !string.IsNullOrWhiteSpace(v.Name)))
                {
                    var existing = v.Id.HasValue ? product.Variants.FirstOrDefault(x => x.Id == v.Id) : null;
                    if (existing is null)
                    {
                        product.Variants.Add(new ProductVariant
                        {
                            Name = v.Name.Trim(), Sku = v.Sku, Price = v.Price,
                            Stock = Math.Max(0, v.Stock), IsActive = v.IsActive
                        });
                    }
                    else
                    {
                        existing.Name = v.Name.Trim();
                        existing.Sku = v.Sku;
                        existing.Price = v.Price;
                        existing.Stock = Math.Max(0, v.Stock);
                        existing.IsActive = v.IsActive;
                    }
                }
            }

            if (product.Variants.Count > 0) product.Stock = product.Variants.Sum(v => v.Stock);
            else product.Stock = Math.Max(0, request.Stock);

            var newStock = product.TrackStock ? product.Stock : previousStock;
            if (product.TrackStock && newStock != previousStock)
            {
                db.InventoryMovements.Add(new InventoryMovement
                {
                    ProductId = product.Id,
                    Type = newStock > previousStock ? MovementType.In : MovementType.Adjustment,
                    Quantity = Math.Abs(newStock - previousStock),
                    PreviousStock = previousStock,
                    NewStock = newStock,
                    Notes = "Actualización desde el producto",
                    ProductName = product.Name,
                    UserId = current.Id,
                    UserName = current.Name
                });
            }

            await db.SaveChangesAsync();
            var updated = await db.Products.Include(p => p.Category).Include(p => p.Variants).FirstAsync(p => p.Id == id);
            return Results.Ok(updated.ToDto());
        }).RequirePermission(Permissions.ProductsManage);

        products.MapDelete("/{id:guid}", async (Guid id, AppDbContext db) =>
        {
            var product = await db.Products.FirstOrDefaultAsync(p => p.Id == id) ?? throw new ApiException("Producto no encontrado.", 404);
            product.IsActive = false;
            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Producto desactivado." });
        }).RequirePermission(Permissions.ProductsManage);

        products.MapDelete("/{id:guid}/variants/{variantId:guid}", async (Guid id, Guid variantId, AppDbContext db) =>
        {
            var variant = await db.ProductVariants.FirstOrDefaultAsync(v => v.Id == variantId && v.ProductId == id)
                ?? throw new ApiException("Variante no encontrada.", 404);
            db.ProductVariants.Remove(variant);
            await db.SaveChangesAsync();
            var product = await db.Products.Include(p => p.Variants).FirstAsync(p => p.Id == id);
            product.Stock = product.Variants.Count > 0 ? product.Variants.Sum(v => v.Stock) : product.Stock;
            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Variante eliminada." });
        }).RequirePermission(Permissions.ProductsManage);

        // ── Inventory ───────────────────────────────────────────────────────
        inventory.MapGet("/movements", async (AppDbContext db, string? type, Guid? productId, DateTime? from,
            DateTime? to, int page = 1, int pageSize = 25) =>
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);
            var query = db.InventoryMovements.AsNoTracking().AsQueryable();
            if (!string.IsNullOrWhiteSpace(type) && Enum.TryParse<MovementType>(type, true, out var mt))
                query = query.Where(m => m.Type == mt);
            if (productId.HasValue) query = query.Where(m => m.ProductId == productId);
            if (from.HasValue) query = query.Where(m => m.CreatedAt >= from.Value.Date);
            if (to.HasValue) query = query.Where(m => m.CreatedAt < to.Value.Date.AddDays(1));

            var total = await query.CountAsync();
            var list = await query.OrderByDescending(m => m.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
            var branchIds = list.Where(m => m.BranchId != null).Select(m => m.BranchId!.Value).Distinct().ToList();
            var branches = await db.Branches.Where(b => branchIds.Contains(b.Id)).ToDictionaryAsync(b => b.Id, b => b.Name);
            var variantIds = list.Where(m => m.VariantId != null).Select(m => m.VariantId!.Value).Distinct().ToList();
            var variants = await db.ProductVariants.Where(v => variantIds.Contains(v.Id)).ToDictionaryAsync(v => v.Id, v => v.Name);
            var items = list.Select(m => m.ToDto(
                m.BranchId != null && branches.TryGetValue(m.BranchId.Value, out var bn) ? bn : null,
                m.VariantId != null && variants.TryGetValue(m.VariantId.Value, out var vn) ? vn : null)).ToList();
            return Results.Ok(new PageResult<InventoryMovementDto>(items, total, page, pageSize));
        });

        inventory.MapPost("/movements", async (CreateMovementRequest request, AppDbContext db, CurrentUser current) =>
        {
            if (!Enum.TryParse<MovementType>(request.Type, true, out var type) || type is MovementType.Sale)
                Guard.BadRequest("Tipo de movimiento inválido.");
            if (request.Quantity <= 0) Guard.BadRequest("La cantidad debe ser mayor a cero.");

            var product = await db.Products.Include(p => p.Variants).FirstOrDefaultAsync(p => p.Id == request.ProductId)
                ?? throw new ApiException("Producto no encontrado.", 404);
            if (!product.TrackStock) Guard.BadRequest("Este producto o servicio no maneja inventario.");

            ProductVariant? variant = null;
            if (request.VariantId.HasValue)
            {
                variant = product.Variants.FirstOrDefault(v => v.Id == request.VariantId)
                    ?? throw new ApiException("Variante no encontrada.", 404);
            }

            var previous = variant?.Stock ?? product.Stock;
            var newStock = type switch
            {
                MovementType.In or MovementType.Return => previous + request.Quantity,
                MovementType.Out => previous - request.Quantity,
                MovementType.Adjustment => request.Quantity,
                _ => previous
            };
            if (newStock < 0) Guard.BadRequest($"Stock insuficiente. Disponible: {previous} unidades.");

            if (variant is not null)
            {
                variant.Stock = newStock;
                product.Stock = product.Variants.Sum(v => v.Stock);
            }
            else
            {
                product.Stock = newStock;
            }

            var movement = new InventoryMovement
            {
                ProductId = product.Id,
                VariantId = variant?.Id,
                BranchId = request.BranchId,
                Type = type,
                Quantity = request.Quantity,
                PreviousStock = previous,
                NewStock = newStock,
                Notes = request.Notes,
                Reference = $"MOV-{DateTime.UtcNow:yyMMddHHmmss}",
                ProductName = product.Name,
                UserId = current.Id,
                UserName = current.Name
            };
            db.InventoryMovements.Add(movement);
            await db.SaveChangesAsync();
            return Results.Created($"/api/inventory/movements/{movement.Id}",
                movement.ToDto(variantName: variant?.Name));
        }).RequirePermission(Permissions.InventoryManage);

        inventory.MapGet("/alerts", async (AppDbContext db) =>
        {
            var list = await db.Products.AsNoTracking().Include(p => p.Category).Include(p => p.Variants)
                .Where(p => p.IsActive && p.TrackStock && p.Type == ProductType.Product)
                .ToListAsync();
            var low = list.Where(p => (p.Variants.Count > 0 ? p.Variants.Sum(v => v.Stock) : p.Stock) <= p.MinStock)
                .OrderBy(p => p.Variants.Count > 0 ? p.Variants.Sum(v => v.Stock) : p.Stock)
                .Select(p => new LowStockItemDto(p.Id, p.Name, p.ImageUrl,
                    p.Variants.Count > 0 ? p.Variants.Sum(v => v.Stock) : p.Stock,
                    p.MinStock, p.Category?.Name, p.Price)).ToList();
            return Results.Ok(low);
        });

        inventory.MapGet("/summary", async (AppDbContext db) =>
        {
            var products = await db.Products.AsNoTracking().Include(p => p.Category).Include(p => p.Variants)
                .Where(p => p.IsActive).ToListAsync();
            var physical = products.Where(p => p.TrackStock && p.Type == ProductType.Product).ToList();
            var units = physical.Sum(p => p.Variants.Count > 0 ? p.Variants.Sum(v => v.Stock) : p.Stock);
            var costValue = physical.Sum(p => (p.Variants.Count > 0 ? p.Variants.Sum(v => v.Stock) : p.Stock) * p.Cost);
            var retailValue = physical.Sum(p => (p.Variants.Count > 0 ? p.Variants.Sum(v => v.Stock) : p.Stock) * p.Price);
            var low = physical.Count(p => (p.Variants.Count > 0 ? p.Variants.Sum(v => v.Stock) : p.Stock) <= p.MinStock);
            var outOfStock = physical.Count(p => (p.Variants.Count > 0 ? p.Variants.Sum(v => v.Stock) : p.Stock) == 0);

            var byCategory = physical.GroupBy(p => p.Category?.Name ?? "Sin categoría").Select(g => new StockByCategoryDto(
                g.Key, g.First().Category?.Color ?? "#7C3AED", g.Count(),
                g.Sum(p => p.Variants.Count > 0 ? p.Variants.Sum(v => v.Stock) : p.Stock),
                g.Sum(p => (p.Variants.Count > 0 ? p.Variants.Sum(v => v.Stock) : p.Stock) * p.Cost))).OrderByDescending(x => x.Value).ToList();

            return Results.Ok(new InventorySummaryDto(products.Count, units, costValue, retailValue, low, outOfStock, byCategory));
        });
    }
}
