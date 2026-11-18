using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NexComerce.Infrastructure.Persistence;
using NexComerce.Infrastructure.Security;
using NexComerce.Infrastructure.Tenancy;
using NexComerce.Infrastructure.WhatsApp;

namespace NexComerce.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddNexComerceInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var provider = configuration["Database:Provider"] ?? "Postgres";
        var connectionString = configuration.GetConnectionString("Default")
            ?? configuration["Database:ConnectionString"]
            ?? "Host=localhost;Database=nexcomerce;Username=postgres;Password=postgres";

        services.AddDbContext<AppDbContext>(options =>
        {
            if (provider.Equals("InMemory", StringComparison.OrdinalIgnoreCase))
                options.UseInMemoryDatabase("nexcomerce-dev");
            else
                options.UseNpgsql(connectionString, npgsql =>
                {
                    npgsql.EnableRetryOnFailure(3);
                    npgsql.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName);
                });
        });

        services.AddScoped<ITenantContext, TenantContext>();
        services.AddSingleton(configuration.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions());
        services.AddSingleton<JwtTokenService>();

        var whatsAppOptions = configuration.GetSection("WhatsApp").Get<WhatsAppOptions>() ?? new WhatsAppOptions();
        services.AddSingleton(whatsAppOptions);
        services.AddSingleton(new SecretProtector(whatsAppOptions.EncryptionKey));
        services.AddHttpClient<WhatsAppSender>();
        services.AddHttpClient<AiChatClient>();
        services.AddScoped<WhatsAppBot>();
        services.AddScoped<WhatsAppInboxService>();

        return services;
    }
}
