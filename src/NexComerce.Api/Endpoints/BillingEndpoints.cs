using Microsoft.EntityFrameworkCore;
using NexComerce.Api.Contracts;
using NexComerce.Api.Infrastructure;
using NexComerce.Domain.Audit;
using NexComerce.Domain.Billing;
using NexComerce.Domain.Common;
using NexComerce.Infrastructure.Persistence;

namespace NexComerce.Api.Endpoints;

public static class BillingEndpoints
{
    public static void MapBillingEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/billing").WithTags("Suscripción").RequireAuthorization()
            .RequirePermission(Permissions.SettingsManage);

        group.MapGet("/overview", async (AppDbContext db, CurrentUser current) =>
        {
            var tenant = await db.Tenants.FirstAsync(t => t.Id == current.TenantId);
            var subscription = await BusinessOperations.EnsureSubscriptionAsync(db, current.TenantId);
            var invoices = await db.SubscriptionInvoices.AsNoTracking()
                .OrderByDescending(i => i.IssuedAt).Take(18).ToListAsync();

            var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var usage = new UsageDto(
                await db.Users.CountAsync(),
                await db.Branches.CountAsync(),
                await db.Products.CountAsync(),
                await db.Customers.CountAsync(),
                await db.Sales.CountAsync(s => s.CreatedAt >= monthStart),
                await db.Messages.CountAsync(m => m.CreatedAt >= monthStart));

            return Results.Ok(new BillingOverviewDto(
                subscription.ToDto(),
                BillingCatalog.Plans.ToList(),
                BillingCatalog.Addons.ToList(),
                invoices.Select(i => i.ToDto()).ToList(),
                usage,
                true,
                ["Card", "Transfer", "Qr"],
                tenant.CurrencySymbol));
        });

        group.MapPost("/checkout", async (BillingCheckoutRequest request, AppDbContext db, CurrentUser current) =>
        {
            var tenant = await db.Tenants.FirstAsync(t => t.Id == current.TenantId);
            var subscription = await BusinessOperations.EnsureSubscriptionAsync(db, current.TenantId);

            var plan = BillingCatalog.FindPlan(request.Plan);
            if (plan is null) Guard.BadRequest("Selecciona un plan válido.");
            var selectedPlan = plan!;

            var cycle = BillingCatalog.ParseCycle(request.Cycle);
            var addonIds = (request.Addons ?? [])
                .Where(id => BillingCatalog.FindAddon(id) is not null)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            var addonNames = addonIds.Select(id => BillingCatalog.FindAddon(id)!.Name).ToList();

            var subtotal = cycle == BillingCycle.Annual ? selectedPlan.AnnualPrice : selectedPlan.MonthlyPrice;
            var addonsPrice = BillingCatalog.AddonsTotal(addonIds, cycle);
            var gross = subtotal + addonsPrice;

            var coupon = request.CouponCode?.Trim().ToUpperInvariant();
            var discount = string.Equals(coupon, BillingCatalog.WelcomeCoupon, StringComparison.OrdinalIgnoreCase)
                ? Math.Round(gross * BillingCatalog.WelcomeDiscount / 100m, 2)
                : 0m;
            var total = Math.Max(0, gross - discount);

            var hasChannel = Enum.TryParse<PaymentChannel>(request.Channel, true, out var parsedChannel);
            if (total > 0 && !hasChannel)
                Guard.BadRequest("Selecciona un método de pago válido.");
            var channel = hasChannel ? parsedChannel : PaymentChannel.Card;

            var paymentLabel = "Sin cobro";
            var reference = $"DEMO-{DateTime.UtcNow:yyMMddHHmmss}";

            if (total > 0)
            {
                switch (channel)
                {
                    case PaymentChannel.Card:
                    {
                        var digits = new string((request.CardNumber ?? string.Empty).Where(char.IsDigit).ToArray());
                        if (digits.Length is < 15 or > 16)
                            Guard.BadRequest("Ingresa un número de tarjeta de 16 dígitos (modo demo).");
                        if (!Luhn(digits))
                            Guard.BadRequest("El número de tarjeta no es válido. En la demo usa 4242 4242 4242 4242.");
                        if (string.IsNullOrWhiteSpace(request.CardHolder))
                            Guard.BadRequest("Ingresa el nombre del titular.");
                        if (!IsFutureExpiry(request.CardExpiry))
                            Guard.BadRequest("La fecha de vencimiento no es válida (MM/AA).");
                        if ((request.CardCvc ?? string.Empty).Length is < 3 or > 4)
                            Guard.BadRequest("El CVC debe tener 3 o 4 dígitos.");

                        // Demo decline card, like the classic PSP sandbox.
                        if (digits.EndsWith("0002"))
                            return Results.Ok(new BillingCheckoutResultDto(false,
                                "Pago rechazado por el banco emisor (simulación). Prueba con 4242 4242 4242 4242.",
                                null, subscription.ToDto()));

                        var brand = digits.StartsWith('4') ? "Visa"
                            : digits.StartsWith('5') ? "Mastercard"
                            : digits.StartsWith('3') ? "Amex" : "Tarjeta";
                        paymentLabel = $"{brand} •••• {digits[^4..]}";
                        break;
                    }
                    case PaymentChannel.Transfer:
                    {
                        if ((request.TransferReference ?? string.Empty).Trim().Length < 4)
                            Guard.BadRequest("Ingresa el número de comprobante de la transferencia (mínimo 4 caracteres).");
                        reference = request.TransferReference!.Trim();
                        paymentLabel = "Transferencia bancaria";
                        break;
                    }
                    case PaymentChannel.Qr:
                    {
                        var qrReference = (request.QrReference ?? request.TransferReference ?? string.Empty).Trim();
                        if (qrReference.Length < 4)
                            Guard.BadRequest("Ingresa la referencia del pago por QR (mínimo 4 caracteres).");
                        reference = qrReference;
                        paymentLabel = "Pago por QR";
                        break;
                    }
                    default:
                        paymentLabel = "Efectivo";
                        break;
                }
            }

            var now = DateTime.UtcNow;
            var invoiceNumber = await BusinessOperations.NextInvoiceNumberAsync(db, current.TenantId);
            var invoice = new SubscriptionInvoice
            {
                TenantId = current.TenantId,
                Number = invoiceNumber,
                Plan = selectedPlan.Name,
                Cycle = cycle,
                Subtotal = subtotal,
                Addons = addonsPrice,
                Discount = discount,
                Tax = 0,
                Total = total,
                Status = InvoiceStatus.Paid,
                IssuedAt = now,
                DueAt = now,
                PaidAt = now,
                PaymentMethod = paymentLabel,
                PaymentChannel = channel.ToString(),
                Reference = reference,
                CouponCode = discount > 0 ? BillingCatalog.WelcomeCoupon : null,
                Description = $"Suscripción {selectedPlan.Name} · {(cycle == BillingCycle.Annual ? "anual" : "mensual")} · modo demo",
                AddonList = addonNames.Count > 0 ? string.Join(", ", addonNames) : null
            };
            db.SubscriptionInvoices.Add(invoice);

            subscription.Plan = Enum.TryParse<Plan>(selectedPlan.Id, true, out var planEnum) ? planEnum : Plan.Starter;
            subscription.Cycle = cycle;
            subscription.Status = SubscriptionStatus.Active;
            subscription.CurrentPeriodStart = now;
            subscription.CurrentPeriodEnd = cycle == BillingCycle.Annual ? now.AddDays(365) : now.AddDays(30);
            subscription.BasePrice = subtotal;
            subscription.AddonsPrice = addonsPrice;
            subscription.Discount = discount;
            subscription.Total = total;
            subscription.Addons = string.Join(',', addonIds);
            subscription.PaymentMethod = paymentLabel;
            subscription.PaymentChannel = channel.ToString();
            subscription.LastPaymentAt = now;
            subscription.LastInvoiceNumber = invoiceNumber;
            subscription.CancelAtPeriodEnd = false;
            subscription.Notes = "Último pago procesado en modo demostración. No se realizó ningún cargo real.";

            tenant.Plan = subscription.Plan;
            tenant.TrialEndsAt = null;

            db.AuditLogs.Add(new AuditLog
            {
                UserId = current.Id,
                UserName = current.Name,
                Action = "billing.checkout.demo",
                Entity = "Subscription",
                EntityId = subscription.Id.ToString(),
                Details = $"Plan {selectedPlan.Name} ({cycle}) por {tenant.CurrencySymbol}{total:N2} · demo",
                IpAddress = current.IpAddress
            });

            await db.SaveChangesAsync();

            return Results.Ok(new BillingCheckoutResultDto(true,
                total == 0
                    ? "Plan gratuito activado correctamente."
                    : "Pago aprobado en modo demostración. Tu plan quedó activo.",
                invoice.ToDto(), subscription.ToDto()));
        });

        group.MapPost("/cancel", async (AppDbContext db, CurrentUser current) =>
        {
            var subscription = await BusinessOperations.EnsureSubscriptionAsync(db, current.TenantId);
            subscription.CancelAtPeriodEnd = true;
            await db.SaveChangesAsync();
            return Results.Ok(subscription.ToDto());
        });

        group.MapPost("/resume", async (AppDbContext db, CurrentUser current) =>
        {
            var subscription = await BusinessOperations.EnsureSubscriptionAsync(db, current.TenantId);
            subscription.CancelAtPeriodEnd = false;
            await db.SaveChangesAsync();
            return Results.Ok(subscription.ToDto());
        });
    }

    private static bool IsFutureExpiry(string? value)
    {
        var raw = (value ?? string.Empty).Trim();
        var parts = raw.Split('/', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 2) return false;
        if (!int.TryParse(parts[0], out var month) || month is < 1 or > 12) return false;
        if (!int.TryParse(parts[1], out var year)) return false;
        if (year < 100) year += 2000;
        var expiry = new DateTime(year, month, 1).AddMonths(1).AddDays(-1);
        return expiry >= DateTime.UtcNow.Date;
    }

    private static bool Luhn(string digits)
    {
        var sum = 0;
        var alternate = false;
        for (var i = digits.Length - 1; i >= 0; i--)
        {
            var n = digits[i] - '0';
            if (alternate)
            {
                n *= 2;
                if (n > 9) n -= 9;
            }
            sum += n;
            alternate = !alternate;
        }
        return sum % 10 == 0;
    }
}
