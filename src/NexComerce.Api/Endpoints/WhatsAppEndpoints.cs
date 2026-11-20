using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using NexComerce.Api.Contracts;
using NexComerce.Api.Infrastructure;
using NexComerce.Domain.Common;
using NexComerce.Domain.Tenancy;
using NexComerce.Domain.WhatsApp;
using NexComerce.Infrastructure.Persistence;
using NexComerce.Infrastructure.WhatsApp;

namespace NexComerce.Api.Endpoints;

public static class WhatsAppEndpoints
{
    public static void MapWhatsAppEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/whatsapp").WithTags("WhatsApp").RequireAuthorization()
            .RequirePermission(Permissions.WhatsAppManage);

        group.MapGet("/account", async (AppDbContext db, WhatsAppOptions options) =>
        {
            var account = await GetOrCreateAccount(db);
            return Results.Ok(account.ToDto(!string.IsNullOrWhiteSpace(options.AiApiKey)));
        });

        group.MapPut("/account", async (SaveWhatsAppAccountRequest request, AppDbContext db, SecretProtector protector, WhatsAppOptions options) =>
        {
            var account = await GetOrCreateAccount(db);
            account.WabaId = request.WabaId;
            account.PhoneNumberId = request.PhoneNumberId;
            account.DisplayPhoneNumber = request.DisplayPhoneNumber;
            account.IsEnabled = request.IsEnabled;
            account.AiEnabled = request.AiEnabled;
            account.AiModel = request.AiModel;
            account.WelcomeMessage = Guard.Require(request.WelcomeMessage, "El mensaje de bienvenida es obligatorio.");
            account.FallbackMessage = Guard.Require(request.FallbackMessage, "El mensaje de respaldo es obligatorio.");
            account.HandoffMessage = Guard.Require(request.HandoffMessage, "El mensaje de transferencia es obligatorio.");
            account.BusinessHoursText = request.BusinessHoursText;
            account.LocationText = request.LocationText;
            account.PaymentMethodsText = request.PaymentMethodsText;
            account.ServicesText = request.ServicesText;
            account.SystemPrompt = request.SystemPrompt;
            account.AutoReplyEnabled = request.AutoReplyEnabled;
            account.ProductLookupEnabled = request.ProductLookupEnabled;
            if (!string.IsNullOrWhiteSpace(request.AccessToken))
                account.AccessToken = protector.Protect(request.AccessToken.Trim());
            if (account.IsEnabled && !string.IsNullOrWhiteSpace(account.PhoneNumberId)) account.ConnectedAt ??= DateTime.UtcNow;

            await db.SaveChangesAsync();
            return Results.Ok(account.ToDto(!string.IsNullOrWhiteSpace(options.AiApiKey)));
        }).RequirePermission(Permissions.WhatsAppManage);

        group.MapPost("/account/generate-verify-token", async (AppDbContext db, WhatsAppOptions options) =>
        {
            var account = await GetOrCreateAccount(db);
            account.VerifyToken = Guid.NewGuid().ToString("N");
            await db.SaveChangesAsync();
            return Results.Ok(account.ToDto(!string.IsNullOrWhiteSpace(options.AiApiKey)));
        }).RequirePermission(Permissions.WhatsAppManage);

        group.MapGet("/webhook-info", async (AppDbContext db, HttpContext http, IConfiguration config) =>
        {
            var account = await GetOrCreateAccount(db);
            var baseUrl = config["App:PublicUrl"]?.TrimEnd('/');
            if (string.IsNullOrWhiteSpace(baseUrl))
                baseUrl = $"{http.Request.Scheme}://{http.Request.Host}";
            return Results.Ok(new WhatsAppWebhookInfoDto(
                $"{baseUrl}/api/webhooks/whatsapp",
                account.VerifyToken,
                "v21.0",
                account.IsEnabled && !string.IsNullOrWhiteSpace(account.PhoneNumberId)));
        });

        // ── FAQs ────────────────────────────────────────────────────────────
        group.MapGet("/faqs", async (AppDbContext db) =>
        {
            var faqs = await db.WhatsAppFaqs.OrderByDescending(f => f.Priority).ThenBy(f => f.Question).ToListAsync();
            return Results.Ok(faqs.Select(f => f.ToDto()).ToList());
        });

        group.MapPost("/faqs", async (SaveFaqRequest request, AppDbContext db) =>
        {
            var faq = new WhatsAppFaq
            {
                Question = Guard.Require(request.Question, "La pregunta es obligatoria."),
                Answer = Guard.Require(request.Answer, "La respuesta es obligatoria."),
                Keywords = request.Keywords,
                Priority = request.Priority,
                IsActive = request.IsActive
            };
            db.WhatsAppFaqs.Add(faq);
            await db.SaveChangesAsync();
            return Results.Created($"/api/whatsapp/faqs/{faq.Id}", faq.ToDto());
        }).RequirePermission(Permissions.WhatsAppManage);

        group.MapPut("/faqs/{id:guid}", async (Guid id, SaveFaqRequest request, AppDbContext db) =>
        {
            var faq = await db.WhatsAppFaqs.FirstOrDefaultAsync(f => f.Id == id) ?? throw new ApiException("Pregunta no encontrada.", 404);
            faq.Question = Guard.Require(request.Question, "La pregunta es obligatoria.");
            faq.Answer = Guard.Require(request.Answer, "La respuesta es obligatoria.");
            faq.Keywords = request.Keywords;
            faq.Priority = request.Priority;
            faq.IsActive = request.IsActive;
            await db.SaveChangesAsync();
            return Results.Ok(faq.ToDto());
        }).RequirePermission(Permissions.WhatsAppManage);

        group.MapDelete("/faqs/{id:guid}", async (Guid id, AppDbContext db) =>
        {
            var faq = await db.WhatsAppFaqs.FirstOrDefaultAsync(f => f.Id == id) ?? throw new ApiException("Pregunta no encontrada.", 404);
            db.WhatsAppFaqs.Remove(faq);
            await db.SaveChangesAsync();
            return Results.Ok(new { message = "Pregunta eliminada." });
        }).RequirePermission(Permissions.WhatsAppManage);

        // ── Inbox ───────────────────────────────────────────────────────────
        group.MapGet("/conversations", async (AppDbContext db, string? status, string? search) =>
        {
            var query = db.Conversations.AsNoTracking().Include(c => c.Contact).AsQueryable();
            if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<ConversationStatus>(status, true, out var st))
                query = query.Where(c => c.Status == st);
            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                query = query.Where(c => (c.Contact != null && c.Contact.Name != null && c.Contact.Name.ToLower().Contains(term))
                    || (c.Contact != null && c.Contact.WaId.Contains(term)) || (c.LastMessagePreview != null && c.LastMessagePreview.ToLower().Contains(term)));
            }
            var list = await query.OrderByDescending(c => c.LastMessageAt).Take(100).ToListAsync();
            return Results.Ok(list.Select(c => c.ToDto()).ToList());
        });

        group.MapGet("/conversations/{id:guid}", async (Guid id, AppDbContext db) =>
        {
            var conversation = await db.Conversations.Include(c => c.Contact).FirstOrDefaultAsync(c => c.Id == id)
                ?? throw new ApiException("Conversación no encontrada.", 404);
            var messages = await db.Messages.AsNoTracking().Where(m => m.ConversationId == id)
                .OrderBy(m => m.CreatedAt).ToListAsync();
            if (conversation.Contact is not null && conversation.Contact.UnreadCount > 0)
            {
                conversation.Contact.UnreadCount = 0;
                await db.SaveChangesAsync();
            }
            return Results.Ok(new ConversationDetailDto(conversation.ToDto(), messages.Select(m => m.ToDto()).ToList()));
        });

        group.MapPost("/conversations/{id:guid}/messages", async (Guid id, SendMessageRequest request, AppDbContext db,
            WhatsAppInboxService inbox, CurrentUser current) =>
        {
            var body = Guard.Require(request.Body, "El mensaje no puede estar vacío.");
            var conversation = await db.Conversations.Include(c => c.Contact).FirstOrDefaultAsync(c => c.Id == id)
                ?? throw new ApiException("Conversación no encontrada.", 404);
            if (conversation.Status == ConversationStatus.Closed)
            {
                conversation.Status = ConversationStatus.Human;
                conversation.AssignedUserId = current.Id;
                conversation.AssignedUserName = current.Name;
            }
            var (message, error, simulated) = await inbox.SendReplyAsync(conversation, body, current.Id, current.Name);
            if (message is null) throw new ApiException(error ?? "No se pudo enviar el mensaje.", 400);
            return Results.Ok(new { message = message.ToDto(), simulated, warning = error });
        }).RequirePermission(Permissions.WhatsAppManage);

        group.MapPost("/conversations/{id:guid}/handoff", async (Guid id, HandoffRequest request, AppDbContext db,
            WhatsAppInboxService inbox, CurrentUser current) =>
        {
            var conversation = await db.Conversations.Include(c => c.Contact).FirstOrDefaultAsync(c => c.Id == id)
                ?? throw new ApiException("Conversación no encontrada.", 404);
            User? assigned = null;
            if (request.UserId.HasValue)
                assigned = await db.Users.FirstOrDefaultAsync(u => u.Id == request.UserId && u.IsActive)
                    ?? throw new ApiException("El asesor indicado no existe.", 404);
            conversation.Status = ConversationStatus.Human;
            conversation.AssignedUserId = assigned?.Id ?? current.Id;
            conversation.AssignedUserName = assigned?.FullName ?? current.Name;
            conversation.Tags = "handoff";
            await db.SaveChangesAsync();
            var account = await db.WhatsAppAccounts.FirstOrDefaultAsync();
            var message = account is null ? null : account.HandoffMessage;
            if (!string.IsNullOrWhiteSpace(message))
                await inbox.SendAutomatedAsync(conversation, message, "handoff");
            return Results.Ok(conversation.ToDto());
        }).RequirePermission(Permissions.WhatsAppManage);

        group.MapPost("/conversations/{id:guid}/close", async (Guid id, AppDbContext db) =>
        {
            var conversation = await db.Conversations.Include(c => c.Contact).FirstOrDefaultAsync(c => c.Id == id)
                ?? throw new ApiException("Conversación no encontrada.", 404);
            conversation.Status = ConversationStatus.Closed;
            await db.SaveChangesAsync();
            return Results.Ok(conversation.ToDto());
        }).RequirePermission(Permissions.WhatsAppManage);

        group.MapPost("/conversations/{id:guid}/reopen", async (Guid id, AppDbContext db) =>
        {
            var conversation = await db.Conversations.Include(c => c.Contact).FirstOrDefaultAsync(c => c.Id == id)
                ?? throw new ApiException("Conversación no encontrada.", 404);
            conversation.Status = ConversationStatus.Bot;
            conversation.AssignedUserId = null;
            conversation.AssignedUserName = null;
            await db.SaveChangesAsync();
            return Results.Ok(conversation.ToDto());
        }).RequirePermission(Permissions.WhatsAppManage);

        // ── Stats / testing ─────────────────────────────────────────────────
        group.MapGet("/stats", async (AppDbContext db, int days = 14) =>
        {
            days = Math.Clamp(days, 7, 90);
            var start = DateTime.UtcNow.Date.AddDays(-(days - 1));
            var conversations = await db.Conversations.AsNoTracking().ToListAsync();
            var messages = await db.Messages.AsNoTracking().Where(m => m.CreatedAt >= start).ToListAsync();
            var contacts = await db.WhatsAppContacts.CountAsync(c => !c.IsBlocked);

            var daily = new List<DailyCountDto>();
            for (var d = start; d <= DateTime.UtcNow.Date; d = d.AddDays(1))
            {
                var day = messages.Where(m => m.CreatedAt >= d && m.CreatedAt < d.AddDays(1)).ToList();
                daily.Add(new DailyCountDto(d.ToString("yyyy-MM-dd"),
                    day.Count(m => m.Direction == MessageDirection.Inbound),
                    day.Count(m => m.Direction == MessageDirection.Outbound)));
            }

            var automatedCount = messages.Count(m => m.IsAutomated);
            var outbound = messages.Count(m => m.Direction == MessageDirection.Outbound);
            var intents = messages.Where(m => m.IsAutomated && !string.IsNullOrEmpty(m.Intent))
                .GroupBy(m => m.Intent!).Select(g => new IntentCountDto(g.Key, g.Count()))
                .OrderByDescending(x => x.Count).ToList();

            return Results.Ok(new WhatsAppStatsDto(
                conversations.Count,
                conversations.Count(c => c.Status != ConversationStatus.Closed),
                conversations.Count(c => c.Status == ConversationStatus.Human),
                automatedCount,
                messages.Count(m => m.Direction == MessageDirection.Inbound),
                outbound,
                outbound > 0 ? Math.Round(automatedCount / (decimal)outbound * 100, 1) : 0,
                contacts, daily, intents));
        });

        group.MapPost("/simulate", async (SimulateRequest request, AppDbContext db, WhatsAppBot bot, CurrentUser current) =>
        {
            var account = await GetOrCreateAccount(db);
            var tenant = await db.Tenants.FirstAsync(t => t.Id == current.TenantId);
            var result = await bot.HandleAsync(account, tenant, request.Message);
            return Results.Ok(new BotReplyDto(result.Reply, result.Intent, result.Handoff,
                result.Products.Select(p => new BotProductDto(p.Id, p.Name, p.Price, p.Stock, p.ImageUrl, p.Sku)).ToList()));
        }).RequirePermission(Permissions.WhatsAppManage);

        group.MapPost("/test-send", async (TestSendRequest request, AppDbContext db, WhatsAppSender sender) =>
        {
            var account = await GetOrCreateAccount(db);
            if (!account.IsEnabled) Guard.BadRequest("Activa la conexión de WhatsApp y guarda tus credenciales antes de enviar.");
            var result = await sender.SendTextAsync(account, request.To, request.Message);
            return Results.Ok(new
            {
                sent = result.Sent, simulated = result.Simulated, result.ExternalId,
                error = result.Error,
                message = result.Sent ? "Mensaje enviado a través de la API de Meta."
                    : result.Simulated ? "Sin credenciales de Meta configuradas: el mensaje se registró como simulado."
                    : $"No se pudo enviar: {result.Error}"
            });
        }).RequirePermission(Permissions.WhatsAppManage);

        // ── Meta Cloud API webhook (public) ─────────────────────────────────
        app.MapGet("/api/webhooks/whatsapp", async (HttpRequest request, AppDbContext db) =>
        {
            var mode = request.Query["hub.mode"].ToString();
            var token = request.Query["hub.verify_token"].ToString();
            var challenge = request.Query["hub.challenge"].ToString();
            if (mode != "subscribe" || string.IsNullOrWhiteSpace(token)) return Results.BadRequest();
            var account = await db.WhatsAppAccounts.IgnoreQueryFilters().FirstOrDefaultAsync(a => a.VerifyToken == token);
            if (account is null) return Results.Unauthorized();
            return Results.Text(challenge);
        }).AllowAnonymous();

        app.MapPost("/api/webhooks/whatsapp", async (HttpRequest request, AppDbContext db, WhatsAppInboxService inbox,
            ILoggerFactory loggerFactory) =>
        {
            var logger = loggerFactory.CreateLogger("WhatsAppWebhook");
            using var reader = new StreamReader(request.Body);
            var body = await reader.ReadToEndAsync();
            if (string.IsNullOrWhiteSpace(body)) return Results.Ok(new { received = true });

            try
            {
                using var doc = JsonDocument.Parse(body);
                foreach (var entry in doc.RootElement.GetProperty("entry").EnumerateArray())
                {
                    if (!entry.TryGetProperty("changes", out var changes)) continue;
                    foreach (var change in changes.EnumerateArray())
                    {
                        if (!change.TryGetProperty("value", out var value)) continue;
                        var phoneNumberId = value.TryGetProperty("metadata", out var metadata) && metadata.TryGetProperty("phone_number_id", out var pn)
                            ? pn.GetString() : null;
                        if (string.IsNullOrWhiteSpace(phoneNumberId)) continue;

                        var account = await db.WhatsAppAccounts.IgnoreQueryFilters()
                            .FirstOrDefaultAsync(a => a.PhoneNumberId == phoneNumberId);
                        if (account is not null && !string.IsNullOrWhiteSpace(account.AppSecret))
                        {
                            var signature = request.Headers["X-Hub-Signature-256"].ToString();
                            var computed = "sha256=" + Convert.ToHexString(HMACSHA256.HashData(
                                Encoding.UTF8.GetBytes(account.AppSecret), Encoding.UTF8.GetBytes(body))).ToLowerInvariant();
                            if (!CryptographicOperations.FixedTimeEquals(
                                Encoding.UTF8.GetBytes(signature), Encoding.UTF8.GetBytes(computed)))
                            {
                                logger.LogWarning("Invalid WhatsApp webhook signature");
                                return Results.Unauthorized();
                            }
                        }

                        string? profileName = null;
                        if (value.TryGetProperty("contacts", out var contacts) && contacts.GetArrayLength() > 0
                            && contacts[0].TryGetProperty("profile", out var profile)
                            && profile.TryGetProperty("name", out var name))
                            profileName = name.GetString();

                        if (!value.TryGetProperty("messages", out var messages)) continue;
                        foreach (var message in messages.EnumerateArray())
                        {
                            var from = message.GetProperty("from").GetString();
                            var externalId = message.TryGetProperty("id", out var mid) ? mid.GetString() : null;
                            var text = message.TryGetProperty("text", out var textNode) && textNode.TryGetProperty("body", out var bodyNode)
                                ? bodyNode.GetString()
                                : message.TryGetProperty("button", out var button) && button.TryGetProperty("text", out var btext)
                                    ? btext.GetString()
                                    : null;
                            if (string.IsNullOrWhiteSpace(from)) continue;
                            await inbox.ProcessInboundAsync(phoneNumberId, from, profileName, text ?? string.Empty, externalId);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error procesando webhook de WhatsApp");
            }

            return Results.Ok(new { received = true });
        }).AllowAnonymous();
    }

    private static async Task<WhatsAppAccount> GetOrCreateAccount(AppDbContext db)
    {
        var account = await db.WhatsAppAccounts.FirstOrDefaultAsync();
        if (account is not null) return account;
        account = new WhatsAppAccount
        {
            IsEnabled = false,
            AiEnabled = true,
            VerifyToken = Guid.NewGuid().ToString("N")
        };
        db.WhatsAppAccounts.Add(account);
        await db.SaveChangesAsync();
        return account;
    }
}
