using Microsoft.EntityFrameworkCore;
using NexComerce.Api.Contracts;
using NexComerce.Api.Infrastructure;
using NexComerce.Domain.Audit;
using NexComerce.Domain.Common;
using NexComerce.Domain.Tenancy;
using NexComerce.Infrastructure.Persistence;
using NexComerce.Infrastructure.Security;

namespace NexComerce.Api.Endpoints;

public static class TenantEndpoints
{
    public static void MapTenantEndpoints(this IEndpointRouteBuilder app)
    {
        var tenant = app.MapGroup("/api/tenant").WithTags("Negocio").RequireAuthorization();
        tenant.MapGet("", async (AppDbContext db, CurrentUser current) =>
        {
            var t = await db.Tenants.FirstOrDefaultAsync(x => x.Id == current.TenantId) ?? throw new ApiException("Negocio no encontrado.", 404);
            return Results.Ok(t.ToDto());
        });

        tenant.MapPut("", async (UpdateTenantRequest request, AppDbContext db, CurrentUser current) =>
        {
            var t = await db.Tenants.FirstOrDefaultAsync(x => x.Id == current.TenantId) ?? throw new ApiException("Negocio no encontrado.", 404);
            t.Name = Guard.Require(request.Name, "El nombre del negocio es obligatorio.");
            t.Phone = request.Phone;
            t.Address = request.Address;
            t.City = request.City;
            t.Country = request.Country;
            t.Currency = string.IsNullOrWhiteSpace(request.Currency) ? t.Currency : request.Currency.ToUpperInvariant();
            t.CurrencySymbol = string.IsNullOrWhiteSpace(request.CurrencySymbol) ? t.CurrencySymbol : request.CurrencySymbol;
            t.Locale = request.Locale ?? t.Locale;
            t.TimeZone = request.TimeZone ?? t.TimeZone;
            if (Enum.TryParse<BusinessType>(request.BusinessType, true, out var bt)) t.BusinessType = bt;
            t.LogoUrl = request.LogoUrl;
            t.Description = request.Description;
            t.TaxName = request.TaxName;
            t.TaxRate = Math.Clamp(request.TaxRate, 0, 100);
            t.TaxIncluded = request.TaxIncluded;
            t.BusinessHours = request.BusinessHours;
            t.PaymentMethods = request.PaymentMethods;
            t.Website = request.Website;
            t.Instagram = request.Instagram;
            await db.SaveChangesAsync();
            return Results.Ok(t.ToDto());
        }).RequirePermission(Permissions.SettingsManage);

        app.MapGet("/api/plans", () => Results.Ok(new[]
        {
            new { id = "Starter", name = "Starter", price = 0, users = 5, branches = 2, products = 500, features = new[] { "POS y ventas", "Inventario básico", "WhatsApp con IA", "Reportes esenciales" } },
            new { id = "Growth", name = "Growth", price = 39, users = 15, branches = 5, products = 5000, features = new[] { "Todo Starter", "Multi-sucursal", "Automatizaciones WhatsApp", "Reportes avanzados" } },
            new { id = "Business", name = "Business", price = 99, users = 100, branches = 25, products = 100000, features = new[] { "Todo Growth", "IA personalizada", "Roles avanzados", "Soporte prioritario" } }
        })).RequireAuthorization();
    }
}

public static class TeamEndpoints
{
    private static readonly (string Key, string Label, string Group)[] PermissionCatalog =
    [
        (Permissions.DashboardView, "Ver dashboard", "General"),
        (Permissions.ProductsManage, "Gestionar productos", "Catálogo"),
        (Permissions.InventoryManage, "Gestionar inventario", "Catálogo"),
        (Permissions.SalesManage, "Registrar y anular ventas", "Ventas"),
        (Permissions.CustomersManage, "Gestionar clientes y cartera", "Contactos"),
        (Permissions.SuppliersManage, "Gestionar proveedores", "Contactos"),
        (Permissions.ExpensesManage, "Gestionar gastos", "Finanzas"),
        (Permissions.ReportsView, "Ver reportes", "Reportes"),
        (Permissions.EmployeesManage, "Gestionar empleados", "Administración"),
        (Permissions.SettingsManage, "Configurar el negocio", "Administración"),
        (Permissions.WhatsAppManage, "Gestionar WhatsApp", "WhatsApp")
    ];

    public static void MapTeamEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/team").WithTags("Equipo").RequireAuthorization();

        group.MapGet("/users", async (AppDbContext db) =>
        {
            var users = await db.Users.AsNoTracking().OrderBy(u => u.FullName).ToListAsync();
            var branchIds = users.Where(u => u.BranchId != null).Select(u => u.BranchId!.Value).Distinct().ToList();
            var branches = await db.Branches.Where(b => branchIds.Contains(b.Id)).ToDictionaryAsync(b => b.Id, b => b.Name);
            return Results.Ok(users.Select(u => u.ToDto(
                u.BranchId != null && branches.TryGetValue(u.BranchId.Value, out var bn) ? bn : null)).ToList());
        }).RequirePermission(Permissions.EmployeesManage);

        group.MapPost("/users", async (CreateUserRequest request, AppDbContext db, CurrentUser current) =>
        {
            var tenant = await db.Tenants.FirstAsync(t => t.Id == current.TenantId);
            var plan = AuthEndpoints.BuildPlan(tenant);
            if (await db.Users.CountAsync() >= plan.UserLimit)
                Guard.BadRequest($"Tu plan {plan.Plan} permite hasta {plan.UserLimit} usuarios. Actualiza tu plan para agregar más.");
            var email = Guard.Require(request.Email, "El correo es obligatorio.").ToLowerInvariant();
            if (await db.Users.IgnoreQueryFilters().AnyAsync(u => u.Email == email))
                throw new ApiException("Ya existe una cuenta con este correo.", 409, "email_taken");
            if (request.Password is null || request.Password.Length < 8)
                Guard.BadRequest("La contraseña debe tener al menos 8 caracteres.");
            if (!Enum.TryParse<UserRole>(request.Role, true, out var role)) role = UserRole.Cashier;
            if (role == UserRole.Owner && current.Role != UserRole.Owner) Guard.Forbidden("Solo el propietario puede crear otro propietario.");
            if (request.BranchId.HasValue && !await db.Branches.AnyAsync(b => b.Id == request.BranchId))
                Guard.BadRequest("La sucursal indicada no existe.");

            var permissions = request.Permissions is not null
                ? request.Permissions.Where(p => Permissions.All.Contains(p)).ToArray()
                : Permissions.DefaultFor(role);
            var user = new User
            {
                FullName = Guard.Require(request.FullName, "El nombre es obligatorio."),
                Email = email,
                PasswordHash = PasswordHasher.Hash(request.Password),
                Phone = request.Phone,
                Role = role,
                BranchId = request.BranchId,
                Permissions = string.Join(',', permissions)
            };
            db.Users.Add(user);
            db.AuditLogs.Add(new AuditLog
            {
                UserId = current.Id, UserName = current.Name, Action = "user.created", Entity = "User",
                EntityId = user.Id.ToString(), Details = $"Empleado {user.FullName} ({role})"
            });
            await db.SaveChangesAsync();
            var branch = user.BranchId == null ? null : await db.Branches.FirstOrDefaultAsync(b => b.Id == user.BranchId);
            return Results.Created($"/api/team/users/{user.Id}", user.ToDto(branch?.Name));
        }).RequirePermission(Permissions.EmployeesManage);

        group.MapPut("/users/{id:guid}", async (Guid id, UpdateUserRequest request, AppDbContext db, CurrentUser current) =>
        {
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id) ?? throw new ApiException("Usuario no encontrado.", 404);
            if (user.Role == UserRole.Owner && current.Role != UserRole.Owner) Guard.Forbidden("No puedes modificar al propietario.");
            if (!Enum.TryParse<UserRole>(request.Role, true, out var role)) role = user.Role;
            if (id == current.Id && !request.IsActive) Guard.BadRequest("No puedes desactivar tu propio usuario.");
            user.FullName = Guard.Require(request.FullName, "El nombre es obligatorio.");
            user.Phone = request.Phone;
            user.Role = role;
            user.BranchId = request.BranchId;
            user.IsActive = request.IsActive;
            if (request.Permissions is not null)
                user.Permissions = string.Join(',', request.Permissions.Where(p => Permissions.All.Contains(p)));
            if (!string.IsNullOrWhiteSpace(request.Password))
            {
                if (request.Password.Length < 8) Guard.BadRequest("La contraseña debe tener al menos 8 caracteres.");
                user.PasswordHash = PasswordHasher.Hash(request.Password);
            }
            await db.SaveChangesAsync();
            var branch = user.BranchId == null ? null : await db.Branches.FirstOrDefaultAsync(b => b.Id == user.BranchId);
            return Results.Ok(user.ToDto(branch?.Name));
        }).RequirePermission(Permissions.EmployeesManage);

        group.MapDelete("/users/{id:guid}", async (Guid id, AppDbContext db, CurrentUser current) =>
        {
            if (id == current.Id) Guard.BadRequest("No puedes desactivar tu propio usuario.");
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id) ?? throw new ApiException("Usuario no encontrado.", 404);
            if (user.Role == UserRole.Owner) Guard.BadRequest("No puedes desactivar al propietario del negocio.");
            user.IsActive = false;
            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Usuario desactivado." });
        }).RequirePermission(Permissions.EmployeesManage);

        group.MapGet("/roles", () => Results.Ok(new[]
        {
            new { id = "Owner", name = "Propietario", description = "Acceso total al negocio y la facturación.", permissions = Permissions.All },
            new { id = "Admin", name = "Administrador", description = "Acceso completo a la operación.", permissions = Permissions.All },
            new { id = "Manager", name = "Gerente", description = "Operación, inventario, ventas, gastos y WhatsApp.", permissions = Permissions.DefaultFor(UserRole.Manager) },
            new { id = "Cashier", name = "Cajero", description = "Ventas y clientes.", permissions = Permissions.DefaultFor(UserRole.Cashier) },
            new { id = "Warehouse", name = "Bodega", description = "Productos e inventario.", permissions = Permissions.DefaultFor(UserRole.Warehouse) },
            new { id = "Support", name = "Asesor", description = "Clientes y conversaciones de WhatsApp.", permissions = Permissions.DefaultFor(UserRole.Support) }
        })).RequirePermission(Permissions.EmployeesManage);

        group.MapGet("/permissions", () => Results.Ok(PermissionCatalog.Select(p => new { p.Key, p.Label, p.Group, assigned = false })))
            .RequirePermission(Permissions.EmployeesManage);

        group.MapGet("/branches", async (AppDbContext db) =>
        {
            var branches = await db.Branches.AsNoTracking().OrderByDescending(b => b.IsMain).ThenBy(b => b.Name).ToListAsync();
            var counts = await db.Users.GroupBy(u => u.BranchId).Select(g => new { BranchId = g.Key, Count = g.Count() }).ToListAsync();
            return Results.Ok(branches.Select(b => b.ToDto(counts.FirstOrDefault(c => c.BranchId == b.Id)?.Count ?? 0)).ToList());
        });

        group.MapPost("/branches", async (SaveBranchRequest request, AppDbContext db, CurrentUser current) =>
        {
            var tenant = await db.Tenants.FirstAsync(t => t.Id == current.TenantId);
            var plan = AuthEndpoints.BuildPlan(tenant);
            if (await db.Branches.CountAsync() >= plan.BranchLimit)
                Guard.BadRequest($"Tu plan {plan.Plan} permite hasta {plan.BranchLimit} sucursales.");
            var name = Guard.Require(request.Name, "El nombre de la sucursal es obligatorio.");
            var code = Guard.Require(request.Code, "El código de la sucursal es obligatorio.").ToUpperInvariant();
            if (await db.Branches.AnyAsync(b => b.Code == code)) Guard.BadRequest($"El código {code} ya está en uso.");
            var branch = new Branch
            {
                Name = name, Code = code, Address = request.Address, City = request.City,
                Phone = request.Phone, IsMain = false, IsActive = request.IsActive
            };
            db.Branches.Add(branch);
            await db.SaveChangesAsync();
            return Results.Created($"/api/team/branches/{branch.Id}", branch.ToDto());
        }).RequirePermission(Permissions.EmployeesManage);

        group.MapPut("/branches/{id:guid}", async (Guid id, SaveBranchRequest request, AppDbContext db) =>
        {
            var branch = await db.Branches.FirstOrDefaultAsync(b => b.Id == id) ?? throw new ApiException("Sucursal no encontrada.", 404);
            var code = Guard.Require(request.Code, "El código de la sucursal es obligatorio.").ToUpperInvariant();
            if (await db.Branches.AnyAsync(b => b.Id != id && b.Code == code)) Guard.BadRequest($"El código {code} ya está en uso.");
            branch.Name = Guard.Require(request.Name, "El nombre de la sucursal es obligatorio.");
            branch.Code = code;
            branch.Address = request.Address;
            branch.City = request.City;
            branch.Phone = request.Phone;
            branch.IsActive = request.IsActive;
            if (request.IsMain && !branch.IsMain)
            {
                var currentMain = await db.Branches.FirstOrDefaultAsync(b => b.IsMain && b.Id != id);
                if (currentMain is not null) currentMain.IsMain = false;
                branch.IsMain = true;
            }
            await db.SaveChangesAsync();
            var count = await db.Users.CountAsync(u => u.BranchId == id);
            return Results.Ok(branch.ToDto(count));
        }).RequirePermission(Permissions.EmployeesManage);

        group.MapDelete("/branches/{id:guid}", async (Guid id, AppDbContext db) =>
        {
            var branch = await db.Branches.FirstOrDefaultAsync(b => b.Id == id) ?? throw new ApiException("Sucursal no encontrada.", 404);
            if (branch.IsMain) Guard.BadRequest("No puedes desactivar la sede principal.");
            branch.IsActive = false;
            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Sucursal desactivada." });
        }).RequirePermission(Permissions.EmployeesManage);
    }
}
