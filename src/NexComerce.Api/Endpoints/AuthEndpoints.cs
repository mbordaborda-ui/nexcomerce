using Microsoft.EntityFrameworkCore;
using NexComerce.Api.Contracts;
using NexComerce.Api.Infrastructure;
using NexComerce.Domain.Audit;
using NexComerce.Domain.Catalog;
using NexComerce.Domain.Common;
using NexComerce.Domain.Tenancy;
using NexComerce.Domain.WhatsApp;
using NexComerce.Infrastructure.Persistence;
using NexComerce.Infrastructure.Security;
using NexComerce.Infrastructure.Tenancy;
using NexComerce.Infrastructure.WhatsApp;

namespace NexComerce.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth").WithTags("Auth");

        group.MapPost("/register", async (RegisterRequest request, AppDbContext db, JwtTokenService tokens,
            ITenantContext tenantContext, IConfiguration config) =>
        {
            var businessName = Guard.Require(request.BusinessName, "El nombre del negocio es obligatorio.");
            var fullName = Guard.Require(request.FullName, "Tu nombre es obligatorio.");
            var email = Guard.Require(request.Email, "El correo electrónico es obligatorio.").ToLowerInvariant();
            if (!email.Contains('@') || !email.Contains('.')) Guard.BadRequest("Ingresa un correo electrónico válido.");
            if (request.Password is null || request.Password.Length < 8)
                Guard.BadRequest("La contraseña debe tener al menos 8 caracteres.");

            if (await db.Users.IgnoreQueryFilters().AnyAsync(u => u.Email == email))
                throw new ApiException("Ya existe una cuenta con este correo electrónico.", 409, "email_taken");

            var businessType = Enum.TryParse<BusinessType>(request.BusinessType, true, out var bt) ? bt : BusinessType.Retail;
            var currency = string.IsNullOrWhiteSpace(request.Currency) ? "USD" : request.Currency.Trim().ToUpperInvariant();
            var symbol = string.IsNullOrWhiteSpace(request.CurrencySymbol) ? "$" : request.CurrencySymbol.Trim();

            var slug = SlugHelper.Create(businessName);
            var baseSlug = slug;
            var suffix = 1;
            while (await db.Tenants.AnyAsync(t => t.Slug == slug)) slug = $"{baseSlug}-{++suffix}";

            var tenant = new Tenant
            {
                Name = businessName,
                Slug = slug,
                Email = email,
                Phone = request.Phone,
                Country = request.Country ?? "Colombia",
                Currency = currency,
                CurrencySymbol = symbol,
                BusinessType = businessType,
                Plan = Plan.Starter,
                TrialEndsAt = DateTime.UtcNow.AddDays(14),
                TaxName = "IVA",
                TaxRate = 0,
                BusinessHours = "Lunes a viernes: 9:00 a.m. – 6:00 p.m.",
                PaymentMethods = "Efectivo, tarjetas y transferencia.",
                Description = $"Bienvenido a {businessName}."
            };
            db.Tenants.Add(tenant);

            var branch = new Branch
            {
                TenantId = tenant.Id,
                Name = "Sede Principal",
                Code = "MAIN",
                IsMain = true
            };
            db.Branches.Add(branch);

            var owner = new User
            {
                TenantId = tenant.Id,
                FullName = fullName,
                Email = email,
                PasswordHash = PasswordHasher.Hash(request.Password),
                Phone = request.Phone,
                Role = UserRole.Owner,
                BranchId = branch.Id,
                Permissions = string.Join(',', Permissions.All)
            };
            db.Users.Add(owner);

            db.Categories.Add(new Category
            {
                TenantId = tenant.Id,
                Name = "General",
                Color = "#7C3AED",
                Description = "Categoría general de productos"
            });

            db.WhatsAppAccounts.Add(new WhatsAppAccount
            {
                TenantId = tenant.Id,
                IsEnabled = false,
                AiEnabled = true,
                BusinessHoursText = tenant.BusinessHours,
                PaymentMethodsText = tenant.PaymentMethods
            });

            db.AuditLogs.Add(new AuditLog
            {
                TenantId = tenant.Id,
                UserId = owner.Id,
                UserName = owner.FullName,
                Action = "register",
                Entity = "Tenant",
                EntityId = tenant.Id.ToString(),
                Details = $"Negocio {tenant.Name} registrado"
            });

            await db.SaveChangesAsync();
            tenantContext.SetTenant(tenant.Id);

            var (token, expires) = tokens.Create(owner, tenant);
            return Results.Ok(new AuthResponse(token, expires, owner.ToDto(branch.Name), tenant.ToDto(), branch.ToDto(1), owner.PermissionList()));
        }).AllowAnonymous();

        group.MapPost("/login", async (LoginRequest request, AppDbContext db, JwtTokenService tokens, ITenantContext tenantContext) =>
        {
            var email = Guard.Require(request.Email, "Ingresa tu correo electrónico.").ToLowerInvariant();
            var user = await db.Users.IgnoreQueryFilters().Include(u => u.Tenant)
                .FirstOrDefaultAsync(u => u.Email == email);

            if (user is null || !PasswordHasher.Verify(request.Password ?? string.Empty, user.PasswordHash))
                throw new ApiException("Correo o contraseña incorrectos.", 401, "invalid_credentials");
            if (!user.IsActive) throw new ApiException("Tu usuario está desactivado. Contacta al administrador.", 403);
            if (user.Tenant is null || !user.Tenant.IsActive) throw new ApiException("El negocio está suspendido.", 403);

            tenantContext.SetTenant(user.TenantId);
            user.LastLoginAt = DateTime.UtcNow;
            await db.SaveChangesAsync();

            var branch = user.BranchId is null ? null : await db.Branches.FirstOrDefaultAsync(b => b.Id == user.BranchId);
            var (token, expires) = tokens.Create(user, user.Tenant);
            return Results.Ok(new AuthResponse(token, expires, user.ToDto(branch?.Name), user.Tenant.ToDto(),
                branch?.ToDto(), user.PermissionList()));
        }).AllowAnonymous();

        group.MapGet("/me", async (AppDbContext db, CurrentUser current) =>
        {
            var user = await db.Users.Include(u => u.Tenant).FirstOrDefaultAsync(u => u.Id == current.Id)
                ?? throw new ApiException("Usuario no encontrado.", 404);
            var tenant = user.Tenant ?? throw new ApiException("Negocio no encontrado.", 404);
            var branch = user.BranchId is null ? null : await db.Branches.FirstOrDefaultAsync(b => b.Id == user.BranchId);

            var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var usage = new UsageDto(
                await db.Users.CountAsync(),
                await db.Branches.CountAsync(),
                await db.Products.CountAsync(),
                await db.Customers.CountAsync(),
                await db.Sales.CountAsync(s => s.CreatedAt >= monthStart),
                await db.Messages.CountAsync(m => m.CreatedAt >= monthStart));
            return Results.Ok(new MeResponse(user.ToDto(branch?.Name), tenant.ToDto(), branch?.ToDto(),
                user.PermissionList(), BuildPlan(tenant), usage));
        }).RequireAuthorization();

        group.MapPut("/profile", async (UpdateProfileRequest request, AppDbContext db, CurrentUser current) =>
        {
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == current.Id) ?? throw new ApiException("Usuario no encontrado.", 404);
            user.FullName = Guard.Require(request.FullName, "El nombre es obligatorio.");
            user.Phone = request.Phone;
            user.AvatarUrl = request.AvatarUrl;
            await db.SaveChangesAsync();
            var branch = user.BranchId is null ? null : await db.Branches.FirstOrDefaultAsync(b => b.Id == user.BranchId);
            return Results.Ok(user.ToDto(branch?.Name));
        }).RequireAuthorization();

        group.MapPost("/change-password", async (ChangePasswordRequest request, AppDbContext db, CurrentUser current) =>
        {
            if (request.NewPassword is null || request.NewPassword.Length < 8)
                Guard.BadRequest("La nueva contraseña debe tener al menos 8 caracteres.");
            var user = await db.Users.FirstOrDefaultAsync(u => u.Id == current.Id) ?? throw new ApiException("Usuario no encontrado.", 404);
            if (!PasswordHasher.Verify(request.CurrentPassword ?? string.Empty, user.PasswordHash))
                Guard.BadRequest("La contraseña actual no es correcta.");
            user.PasswordHash = PasswordHasher.Hash(request.NewPassword);
            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Contraseña actualizada correctamente." });
        }).RequireAuthorization();
    }

    public static PlanInfoDto BuildPlan(Tenant tenant) => tenant.Plan switch
    {
        Plan.Business => new("Business", 100, 25, 100_000, tenant.TrialEndsAt),
        Plan.Growth => new("Growth", 15, 5, 5_000, tenant.TrialEndsAt),
        _ => new("Starter", 5, 2, 500, tenant.TrialEndsAt)
    };
}
