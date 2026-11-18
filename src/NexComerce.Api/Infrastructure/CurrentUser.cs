using System.Security.Claims;
using NexComerce.Domain.Common;

namespace NexComerce.Api.Infrastructure;

public sealed class CurrentUser(IHttpContextAccessor accessor)
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    public Guid Id => Guid.TryParse(Principal?.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : Guid.Empty;
    public Guid TenantId => Guid.TryParse(Principal?.FindFirstValue("tenant_id"), out var id) ? id : Guid.Empty;
    public Guid? BranchId => Guid.TryParse(Principal?.FindFirstValue("branch_id"), out var id) ? id : null;
    public string Name => Principal?.FindFirstValue(ClaimTypes.Name) ?? "Usuario";
    public string Email => Principal?.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
    public UserRole Role => Enum.TryParse<UserRole>(Principal?.FindFirstValue(ClaimTypes.Role), out var role) ? role : UserRole.Cashier;
    public string[] Permissions => (Principal?.FindFirstValue("permissions") ?? string.Empty)
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    public bool HasPermission(string permission) => Role is UserRole.Owner or UserRole.Admin || Permissions.Contains(permission);
    public string? IpAddress => accessor.HttpContext?.Connection.RemoteIpAddress?.ToString();
}

public static class PermissionEndpointExtensions
{
    public static TBuilder RequirePermission<TBuilder>(this TBuilder builder, string permission) where TBuilder : IEndpointConventionBuilder
    {
        builder.AddEndpointFilter(async (context, next) =>
        {
            var user = context.HttpContext.User;
            var role = user.FindFirstValue(ClaimTypes.Role);
            var permissions = (user.FindFirstValue("permissions") ?? string.Empty)
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (role is "Owner" or "Admin" || permissions.Contains(permission)) return await next(context);
            return Results.Json(new { message = "No tienes permisos para realizar esta acción." }, statusCode: StatusCodes.Status403Forbidden);
        });
        return builder;
    }
}

public sealed class ApiException(string message, int statusCode = 400, string? code = null) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
    public string? Code { get; } = code;
}

public static class Guard
{
    public static void NotFound(string message) => throw new ApiException(message, 404);
    public static void Forbidden(string message) => throw new ApiException(message, 403);
    public static void BadRequest(string message) => throw new ApiException(message, 400);
    public static string Require(string? value, string message) =>
        string.IsNullOrWhiteSpace(value) ? throw new ApiException(message) : value.Trim();
}
