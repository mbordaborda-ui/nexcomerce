using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using NexComerce.Api.Endpoints;
using NexComerce.Api.Infrastructure;
using NexComerce.Api.Middleware;
using NexComerce.Infrastructure;
using NexComerce.Infrastructure.Persistence;
using NexComerce.Infrastructure.Security;
using NexComerce.Infrastructure.Tenancy;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddNexComerceInfrastructure(builder.Configuration);
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<CurrentUser>();
builder.Services.AddProblemDetails();

var jwtOptions = builder.Configuration.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtOptions.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Key)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(2),
            NameClaimType = ClaimTypes.Name,
            RoleClaimType = ClaimTypes.Role
        };
    });
builder.Services.AddAuthorization();

var corsOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
    {
        if (corsOrigins.Length == 0) policy.AllowAnyOrigin();
        else policy.WithOrigins(corsOrigins);
        policy.AllowAnyHeader().AllowAnyMethod();
    });
});

builder.Services.AddOpenApi();
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
});

var app = builder.Build();

app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseMiddleware<ApiExceptionMiddleware>();
app.UseCors("frontend");
app.UseAuthentication();

// Resolve the tenant from the signed JWT into the ambient context used by every query filter.
app.Use(async (context, next) =>
{
    if (context.User.Identity?.IsAuthenticated == true)
    {
        var claim = context.User.FindFirstValue("tenant_id");
        if (Guid.TryParse(claim, out var tenantId))
            context.RequestServices.GetRequiredService<ITenantContext>().SetTenant(tenantId);
    }
    await next();
});

// Refresh role, branch and permissions from the database on every authenticated request.
// This makes permission changes and deactivations effective immediately, without waiting for the JWT to expire.
app.Use(async (context, next) =>
{
    if (context.User.Identity?.IsAuthenticated == true &&
        Guid.TryParse(context.User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
    {
        var db = context.RequestServices.GetRequiredService<AppDbContext>();
        var user = await db.Users.IgnoreQueryFilters().AsNoTracking()
            .Include(u => u.Tenant)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user is null || !user.IsActive || user.Tenant is null || !user.Tenant.IsActive)
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(new { message = "Tu usuario ya no está activo. Contacta al administrador." });
            return;
        }

        var claims = context.User.Claims
            .Where(c => c.Type is not ("permissions" or "branch_id" or ClaimTypes.Role or ClaimTypes.Name or ClaimTypes.Email))
            .ToList();
        claims.Add(new Claim("permissions", string.Join(',', user.PermissionList())));
        claims.Add(new Claim(ClaimTypes.Role, user.Role.ToString()));
        claims.Add(new Claim(ClaimTypes.Name, user.FullName));
        claims.Add(new Claim(ClaimTypes.Email, user.Email));
        if (user.BranchId.HasValue) claims.Add(new Claim("branch_id", user.BranchId.Value.ToString()));

        context.User = new ClaimsPrincipal(new ClaimsIdentity(claims, context.User.Identity.AuthenticationType ?? "Bearer"));
    }
    await next();
});

app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference("/docs", options => options.WithTitle("NexComerce API"));
}

app.MapGet("/", () => Results.Ok(new
{
    name = "NexComerce API",
    version = "1.0.0",
    status = "ok",
    docs = "/docs",
    health = "/health"
})).AllowAnonymous();

app.MapGet("/health", async (AppDbContext db) =>
{
    var canConnect = db.Database.IsInMemory() || await db.Database.CanConnectAsync();
    return canConnect
        ? Results.Ok(new { status = "healthy", database = db.Database.ProviderName, timestamp = DateTime.UtcNow })
        : Results.Json(new { status = "unhealthy" }, statusCode: 503);
}).AllowAnonymous();

app.MapAuthEndpoints();
app.MapTenantEndpoints();
app.MapTeamEndpoints();
app.MapCatalogEndpoints();
app.MapOperationsEndpoints();
app.MapOperationsPlusEndpoints();
app.MapBillingEndpoints();
app.MapReportEndpoints();
app.MapWhatsAppEndpoints();

// Serve the built SPA when it is published inside wwwroot (single-service deployment).
var spaRoot = Path.Combine(app.Environment.ContentRootPath, "wwwroot");
if (Directory.Exists(spaRoot) && File.Exists(Path.Combine(spaRoot, "index.html")))
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
    app.MapFallbackToFile("index.html");
}

await InitializeDatabaseAsync(app);

app.Run();

static async Task InitializeDatabaseAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Startup");

    if (db.Database.IsInMemory())
    {
        await db.Database.EnsureCreatedAsync();
        logger.LogInformation("In-memory database ready (development mode).");
    }
    else
    {
        await db.Database.MigrateAsync();
        logger.LogInformation("PostgreSQL migrations applied.");
    }

    if (app.Configuration.GetValue("Seed:Enabled", true))
    {
        await DbSeeder.SeedAsync(db);
        logger.LogInformation("Seed data verified.");
    }
}
