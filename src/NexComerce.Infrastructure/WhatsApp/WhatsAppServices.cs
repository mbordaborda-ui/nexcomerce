using System.Globalization;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using NexComerce.Domain.Catalog;
using NexComerce.Domain.Common;
using NexComerce.Domain.Tenancy;
using NexComerce.Domain.WhatsApp;
using NexComerce.Infrastructure.Persistence;

namespace NexComerce.Infrastructure.WhatsApp;

public sealed class WhatsAppOptions
{
    public string GraphBaseUrl { get; set; } = "https://graph.facebook.com/v21.0";
    public string AiBaseUrl { get; set; } = "https://api.openai.com/v1";
    public string? AiApiKey { get; set; }
    public string AiModel { get; set; } = "gpt-4o-mini";
    public string EncryptionKey { get; set; } = "nexcomerce-secrets-development-key-2026";
}

/// <summary>AES-GCM protection for provider tokens so they are never stored in plain text.</summary>
public sealed class SecretProtector(string key)
{
    private readonly byte[] _key = SHA256.HashData(Encoding.UTF8.GetBytes(key));

    public string Protect(string value)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;
        var nonce = RandomNumberGenerator.GetBytes(12);
        var plain = Encoding.UTF8.GetBytes(value);
        var cipher = new byte[plain.Length];
        var tag = new byte[16];
        using var aes = new AesGcm(_key, 16);
        aes.Encrypt(nonce, plain, cipher, tag);
        return "enc:" + Convert.ToBase64String([.. nonce, .. tag, .. cipher]);
    }

    public string Unprotect(string? value)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;
        if (!value.StartsWith("enc:")) return value;
        try
        {
            var raw = Convert.FromBase64String(value[4..]);
            var nonce = raw[..12];
            var tag = raw[12..28];
            var cipher = raw[28..];
            var plain = new byte[cipher.Length];
            using var aes = new AesGcm(_key, 16);
            aes.Decrypt(nonce, cipher, tag, plain);
            return Encoding.UTF8.GetString(plain);
        }
        catch
        {
            return string.Empty;
        }
    }
}

public record SendResult(bool Sent, bool Simulated, string? ExternalId, string? Error);

public sealed class WhatsAppSender(HttpClient http, SecretProtector protector, WhatsAppOptions options)
{
    public async Task<SendResult> SendTextAsync(WhatsAppAccount account, string to, string body, CancellationToken ct = default)
    {
        var token = protector.Unprotect(account.AccessToken);
        if (string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(account.PhoneNumberId))
        {
            // No Meta credentials configured yet: the message stays in the inbox as "simulated".
            return new SendResult(false, true, null, null);
        }

        var payload = new
        {
            messaging_product = "whatsapp",
            recipient_type = "individual",
            to,
            type = "text",
            text = new { preview_url = false, body }
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, $"{options.GraphBaseUrl}/{account.PhoneNumberId}/messages")
        {
            Content = JsonContent.Create(payload)
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        try
        {
            var response = await http.SendAsync(request, ct);
            var json = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode)
                return new SendResult(false, false, null, $"Meta API {(int)response.StatusCode}: {json}");

            using var doc = JsonDocument.Parse(json);
            var id = doc.RootElement.TryGetProperty("messages", out var messages) && messages.GetArrayLength() > 0
                ? messages[0].GetProperty("id").GetString()
                : null;
            return new SendResult(true, false, id, null);
        }
        catch (Exception ex)
        {
            return new SendResult(false, false, null, ex.Message);
        }
    }
}

public record BotProduct(Guid Id, string Name, decimal Price, int Stock, string? ImageUrl, string? Sku);
public record BotReply(string Reply, string Intent, bool Handoff, IReadOnlyList<BotProduct> Products);

/// <summary>
/// Deterministic business assistant: FAQs, catalog/price/stock lookup and business info.
/// If an OpenAI-compatible key is configured it is used as an extra fallback for free-form questions.
/// </summary>
public sealed class WhatsAppBot(AppDbContext db, AiChatClient ai)
{
    private static readonly string[] StopWords =
    [
        "de","la","el","los","las","que","cuanto","cuánto","vale","precio","precios","tienen","tienes","hay","disponible",
        "disponibles","busco","quiero","comprar","compro","un","una","unos","unas","y","en","del","para","por","con","me",
        "mi","talla","color","hola","buenas","tardes","noches","dias","días","favor","porfa","necesito","saber","esta","este",
        "producto","productos","cuesta","sale","venden","vende","tienen?","the","a","es","son","como","cómo","donde","dónde"
    ];

    private static string Normalize(string value)
    {
        var normalized = value.Trim().ToLowerInvariant()
            .Replace("á", "a").Replace("é", "e").Replace("í", "i").Replace("ó", "o").Replace("ú", "u")
            .Replace("ü", "u").Replace("ñ", "n");
        var sb = new StringBuilder(normalized.Length);
        foreach (var c in normalized)
            sb.Append(char.IsLetterOrDigit(c) ? c : ' ');
        return string.Join(' ', sb.ToString().Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    private static string Money(Tenant tenant, decimal value) =>
        $"{tenant.CurrencySymbol}{value.ToString("N2", CultureInfo.InvariantCulture)}";

    public async Task<BotReply> HandleAsync(WhatsAppAccount account, Tenant tenant, string text, Guid? conversationId = null, CancellationToken ct = default)
    {
        var normalized = Normalize(text);

        if (ContainsAny(normalized, ["asesor", "humano", "persona real", "agente", "vendedor", "hablar con alguien", "atencion al cliente", "atencion humana"]))
            return new BotReply(account.HandoffMessage, "handoff", true, []);

        if (ContainsAny(normalized, ["precio", "precios", "cuanto", "cuesta", "vale", "disponible", "disponibilidad", "tienen", "tienes", "busco", "quiero", "comprar", "catalogo", "producto", "audifonos", "camiseta", "zapatos", "vestido", "jean", "smarwatch", "reloj"]))
        {
            var products = await FindProductsAsync(normalized, ct);
            if (products.Count > 0)
                return new BotReply(BuildProductReply(account, tenant, products, normalized), "product", false, products);
        }

        var faqs = await db.WhatsAppFaqs.Where(f => f.IsActive).OrderByDescending(f => f.Priority).ToListAsync(ct);
        foreach (var faq in faqs)
        {
            var keywords = (faq.Keywords ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (keywords.Any(k => k.Length > 2 && normalized.Contains(Normalize(k), StringComparison.Ordinal)))
                return new BotReply(faq.Answer, "faq", false, []);
        }

        if (ContainsAny(normalized, ["horario", "horarios", "abren", "cierran", "abierto", "atienden", "hora"]))
            return new BotReply(account.BusinessHoursText ?? tenant.BusinessHours ?? "Nuestro horario está disponible en la configuración del negocio.", "hours", false, []);
        if (ContainsAny(normalized, ["ubicacion", "direccion", "donde estan", "donde queda", "sede", "local", "mapa"]))
            return new BotReply(account.LocationText ?? tenant.Address ?? "Escríbenos y te compartimos nuestra ubicación.", "location", false, []);
        if (ContainsAny(normalized, ["pago", "pagar", "tarjeta", "nequi", "daviplata", "efectivo", "transferencia"]))
            return new BotReply(account.PaymentMethodsText ?? tenant.PaymentMethods ?? "Aceptamos efectivo y medios digitales.", "payments", false, []);
        if (ContainsAny(normalized, ["servicio", "servicios", "envio", "envios", "domicilio", "garantia", "cambio"]))
            return new BotReply(account.ServicesText ?? "Contamos con envío nacional y atención personalizada.", "services", false, []);
        if (ContainsAny(normalized, ["gracias", "muchas gracias"]))
            return new BotReply("¡Con gusto! 💜 Estamos para ayudarte cuando lo necesites.", "thanks", false, []);
        if (normalized.Split(' ').Length <= 4 && ContainsAny(normalized, ["hola", "buenos dias", "buenas tardes", "buenas noches", "hey", "buen dia"]))
            return new BotReply(account.WelcomeMessage.Replace("{negocio}", tenant.Name), "greeting", false, []);

        if (account.AiEnabled)
        {
            var context = await BuildAiContextAsync(tenant, faqs, ct);
            var historyQuery = db.Messages.IgnoreQueryFilters()
                .Where(m => m.TenantId == tenant.Id && (conversationId == null || m.ConversationId == conversationId));
            var history = await historyQuery
                .OrderByDescending(m => m.CreatedAt)
                .Take(8)
                .OrderBy(m => m.CreatedAt)
                .Select(m => new { m.Direction, m.Body })
                .ToListAsync(ct);

            var system = string.IsNullOrWhiteSpace(account.SystemPrompt)
                ? $"Eres el asistente virtual de {tenant.Name}. Responde en español, breve y amable. Nunca inventes precios, stock ni políticas."
                : account.SystemPrompt;

            var aiReply = await ai.CompleteAsync(system, context, history.Select(h => (h.Direction == MessageDirection.Inbound ? "user" : "assistant", h.Body)).ToList(), account.AiModel, ct);
            if (!string.IsNullOrWhiteSpace(aiReply))
                return new BotReply(aiReply.Trim(), "ai", false, []);
        }

        return new BotReply(account.FallbackMessage, "fallback", false, []);
    }

    private async Task<List<BotProduct>> FindProductsAsync(string normalized, CancellationToken ct)
    {
        var tokens = normalized.Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(t => t.Length > 2 && !StopWords.Contains(t))
            .Distinct()
            .ToList();
        if (tokens.Count == 0) return [];

        var products = await db.Products
            .Include(p => p.Variants)
            .Where(p => p.IsActive)
            .ToListAsync(ct);

        var scored = products
            .Select(p =>
            {
                var target = Normalize($"{p.Name} {p.Brand} {p.Sku} {p.Tags} {p.CategoryId}");
                var score = tokens.Count(t => target.Contains(t, StringComparison.Ordinal));
                return (Product: p, Score: score);
            })
            .Where(x => x.Score > 0)
            .OrderByDescending(x => x.Score)
            .ThenBy(x => x.Product.Name)
            .Take(4)
            .Select(x => new BotProduct(
                x.Product.Id,
                x.Product.Name,
                x.Product.Price,
                x.Product.Variants.Count > 0 ? x.Product.Variants.Sum(v => v.Stock) : x.Product.Stock,
                x.Product.ImageUrl,
                x.Product.Sku))
            .ToList();

        return scored;
    }

    private string BuildProductReply(WhatsAppAccount account, Tenant tenant, List<BotProduct> products, string normalized)
    {
        if (products.Count == 1)
        {
            var p = products[0];
            if (p.Stock <= 0)
                return $"Por ahora *{p.Name}* está agotado 😔. ¿Quieres que te avise cuando llegue o te muestro una alternativa?";
            return $"Sí, *{p.Name}* está disponible por *{Money(tenant, p.Price)}* y nos quedan {p.Stock} unidades. ¿Te gustaría reservarlo? 💜";
        }

        var lines = products.Select(p => p.Stock <= 0
            ? $"• {p.Name} — agotado"
            : $"• {p.Name} — {Money(tenant, p.Price)} ({p.Stock} disp.)");
        return "Claro, esto es lo que tenemos:\n" + string.Join('\n', lines) + "\n\n¿Cuál te interesa? Puedo ayudarte a reservarlo 😊";
    }

    private async Task<string> BuildAiContextAsync(Tenant tenant, List<WhatsAppFaq> faqs, CancellationToken ct)
    {
        var products = await db.Products.Where(p => p.IsActive).OrderBy(p => p.Name).Take(40).ToListAsync(ct);
        var sb = new StringBuilder();
        sb.AppendLine($"NEGOCIO: {tenant.Name}. {tenant.Description}");
        sb.AppendLine($"Moneda: {tenant.Currency} ({tenant.CurrencySymbol}). Impuesto: {tenant.TaxName} {tenant.TaxRate}%.");
        sb.AppendLine($"Dirección: {tenant.Address}, {tenant.City}. Teléfono: {tenant.Phone}.");
        sb.AppendLine($"Horario: {tenant.BusinessHours}");
        sb.AppendLine($"Medios de pago: {tenant.PaymentMethods}");
        sb.AppendLine("CATÁLOGO (nombre | precio | stock):");
        foreach (var p in products)
            sb.AppendLine($"- {p.Name} | {Money(tenant, p.Price)} | {(p.TrackStock ? p.Stock.ToString() : "servicio")}");
        sb.AppendLine("PREGUNTAS FRECUENTES:");
        foreach (var f in faqs)
            sb.AppendLine($"- {f.Question}: {f.Answer}");
        return sb.ToString();
    }

    private static bool ContainsAny(string source, IEnumerable<string> keywords) =>
        keywords.Any(k => source.Contains(k, StringComparison.Ordinal));
}

/// <summary>OpenAI-compatible chat client. Silently disabled when no API key is configured.</summary>
public sealed class AiChatClient(HttpClient http, WhatsAppOptions options)
{
    public async Task<string?> CompleteAsync(string system, string context, List<(string Role, string Content)> messages, string? model, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(options.AiApiKey)) return null;

        var payload = new
        {
            model = string.IsNullOrWhiteSpace(model) ? options.AiModel : model,
            temperature = 0.3,
            max_tokens = 350,
            messages = new[]
            {
                new { role = "system", content = system + "\n\nCONTEXTO ACTUAL DEL NEGOCIO:\n" + context }
            }.Concat(messages.Select(m => new { role = m.Role, content = m.Content })).ToArray()
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, $"{options.AiBaseUrl}/chat/completions")
        {
            Content = JsonContent.Create(payload)
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.AiApiKey);

        try
        {
            var response = await http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode) return null;
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
            return doc.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString();
        }
        catch
        {
            return null;
        }
    }
}
