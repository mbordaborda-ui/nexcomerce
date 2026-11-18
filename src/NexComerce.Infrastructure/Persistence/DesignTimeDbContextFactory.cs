using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using NexComerce.Infrastructure.Tenancy;

namespace NexComerce.Infrastructure.Persistence;

public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Database=nexcomerce;Username=postgres;Password=postgres")
            .Options;
        return new AppDbContext(options, new TenantContext());
    }
}
