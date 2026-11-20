using NexComerce.Api.Contracts;
using NexComerce.Domain.Billing;
using NexComerce.Domain.Common;

namespace NexComerce.Api.Infrastructure;

/// <summary>Price list and commercial rules for the subscription demo.</summary>
public static class BillingCatalog
{
    public static readonly BillingPlanDto[] Plans =
    [
        new("Starter", "Starter", "Para empezar a ordenar tu negocio", 0, 0, 5, 2, 500,
            ["POS y ventas", "Inventario básico", "Caja y cobros", "Reportes esenciales"], false),
        new("Growth", "Growth", "El favorito de los negocios que crecen", 39, 390, 15, 5, 5_000,
            ["Todo lo de Starter", "Pedidos de WhatsApp e Instagram", "Cuentas por cobrar y CxC", "Automatización de WhatsApp", "Reportes avanzados"], true),
        new("Business", "Business", "Operación multi-sede sin límites prácticos", 99, 990, 100, 25, 100_000,
            ["Todo lo de Growth", "Módulo de rentabilidad", "Multi-sede y roles avanzados", "IA personalizada", "Soporte prioritario"], false)
    ];

    public static readonly BillingAddonDto[] Addons =
    [
        new("profitability", "Rentabilidad avanzada", "Costos, márgenes y utilidad real por producto.", 12, "chart"),
        new("whatsapp", "Automatización WhatsApp", "Confirmaciones, recordatorios y reportes automáticos.", 19, "whatsapp"),
        new("users5", "5 usuarios adicionales", "Amplía tu equipo sin cambiar de plan.", 19, "users"),
        new("branch", "Sucursal adicional", "Una sede extra con inventario y caja propia.", 9, "store"),
        new("ai", "IA avanzada", "Respuestas con tu tono y catálogo en tiempo real.", 15, "sparkles")
    ];

    public static BillingPlanDto? FindPlan(string? id) =>
        Plans.FirstOrDefault(p => string.Equals(p.Id, id, StringComparison.OrdinalIgnoreCase));

    public static BillingAddonDto? FindAddon(string? id) =>
        Addons.FirstOrDefault(a => string.Equals(a.Id, id, StringComparison.OrdinalIgnoreCase));

    public static BillingCycle ParseCycle(string? value) =>
        string.Equals(value, "Annual", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(value, "Anual", StringComparison.OrdinalIgnoreCase)
            ? BillingCycle.Annual
            : BillingCycle.Monthly;

    public static decimal PriceFor(Plan plan, BillingCycle cycle)
    {
        var dto = Plans.FirstOrDefault(p => string.Equals(p.Id, plan.ToString(), StringComparison.OrdinalIgnoreCase))
                  ?? Plans[0];
        return cycle == BillingCycle.Annual ? dto.AnnualPrice : dto.MonthlyPrice;
    }

    public const string WelcomeCoupon = "BIENVENIDA";
    public const decimal WelcomeDiscount = 10m;

    public static decimal AddonsTotal(IEnumerable<string> addons, BillingCycle cycle)
    {
        var monthly = addons
            .Select(FindAddon)
            .Where(a => a is not null)
            .Sum(a => a!.Price);
        return cycle == BillingCycle.Annual ? monthly * 10 : monthly;
    }
}
