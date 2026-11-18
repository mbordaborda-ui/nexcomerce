using Microsoft.EntityFrameworkCore;
using NexComerce.Domain.Common;
using NexComerce.Domain.WhatsApp;
using NexComerce.Infrastructure.Persistence;
using NexComerce.Infrastructure.Tenancy;

namespace NexComerce.Infrastructure.WhatsApp;

/// <summary>Ingests inbound WhatsApp Cloud API messages and produces automated replies.</summary>
public sealed class WhatsAppInboxService(AppDbContext db, WhatsAppBot bot, WhatsAppSender sender, ITenantContext tenantContext)
{
    public async Task<bool> ProcessInboundAsync(string phoneNumberId, string waId, string? profileName,
        string text, string? externalId, CancellationToken ct = default)
    {
        var account = await db.WhatsAppAccounts.IgnoreQueryFilters()
            .FirstOrDefaultAsync(a => a.PhoneNumberId == phoneNumberId && a.IsEnabled, ct);
        if (account is null) return false;

        tenantContext.SetTenant(account.TenantId);
        var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Id == account.TenantId, ct);
        if (tenant is null) return false;

        var contact = await db.WhatsAppContacts.FirstOrDefaultAsync(c => c.WaId == waId, ct);
        if (contact is null)
        {
            contact = new WhatsAppContact
            {
                WaId = waId,
                Phone = waId,
                Name = string.IsNullOrWhiteSpace(profileName) ? waId : profileName,
                LastMessageAt = DateTime.UtcNow
            };
            db.WhatsAppContacts.Add(contact);
        }
        else if (!string.IsNullOrWhiteSpace(profileName) && string.IsNullOrWhiteSpace(contact.Name))
        {
            contact.Name = profileName;
        }

        var conversation = await db.Conversations
            .Where(c => c.ContactId == contact.Id && c.Status != ConversationStatus.Closed)
            .OrderByDescending(c => c.LastMessageAt)
            .FirstOrDefaultAsync(ct);
        if (conversation is null)
        {
            conversation = new Conversation
            {
                ContactId = contact.Id,
                Status = ConversationStatus.Bot,
                LastMessageAt = DateTime.UtcNow,
                LastMessagePreview = text
            };
            db.Conversations.Add(conversation);
        }

        db.Messages.Add(new Message
        {
            ConversationId = conversation.Id,
            Direction = MessageDirection.Inbound,
            Body = string.IsNullOrWhiteSpace(text) ? "[mensaje no compatible]" : text,
            Type = "text",
            Status = "received",
            ExternalId = externalId
        });

        contact.LastMessageAt = DateTime.UtcNow;
        contact.UnreadCount += 1;
        conversation.LastMessageAt = DateTime.UtcNow;
        conversation.LastMessagePreview = text;
        conversation.MessageCount += 1;

        if (!account.IsEnabled || !account.AutoReplyEnabled || conversation.Status == ConversationStatus.Human)
        {
            await db.SaveChangesAsync(ct);
            return true;
        }

        var result = await bot.HandleAsync(account, tenant, text, conversation.Id, ct);
        var send = await sender.SendTextAsync(account, waId, result.Reply, ct);

        db.Messages.Add(new Message
        {
            ConversationId = conversation.Id,
            Direction = MessageDirection.Outbound,
            Body = result.Reply,
            IsAutomated = true,
            Intent = result.Intent,
            Status = send.Simulated ? "simulated" : send.Sent ? "delivered" : "failed"
        });
        conversation.MessageCount += 1;
        conversation.LastMessageAt = DateTime.UtcNow;
        conversation.LastMessagePreview = result.Reply;
        if (result.Handoff)
        {
            conversation.Status = ConversationStatus.Human;
            conversation.Tags = "handoff";
        }

        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<(Message? Message, string? Error, bool Simulated)> SendReplyAsync(Conversation conversation, string body,
        Guid? userId, string? userName, CancellationToken ct = default)
    {
        var account = await db.WhatsAppAccounts.FirstOrDefaultAsync(a => a.IsEnabled, ct);
        var contact = await db.WhatsAppContacts.FirstOrDefaultAsync(c => c.Id == conversation.ContactId, ct);
        if (contact is null) return (null, "Contacto no encontrado.", false);

        var send = account is null
            ? new SendResult(false, true, null, null)
            : await sender.SendTextAsync(account, contact.WaId, body, ct);

        var message = new Message
        {
            ConversationId = conversation.Id,
            Direction = MessageDirection.Outbound,
            Body = body,
            IsAutomated = false,
            Status = send.Simulated ? "simulated" : send.Sent ? "sent" : "failed",
            SentByUserId = userId,
            SentByName = userName,
            ExternalId = send.ExternalId
        };
        db.Messages.Add(message);
        conversation.LastMessagePreview = body;
        conversation.LastMessageAt = DateTime.UtcNow;
        conversation.MessageCount += 1;
        if (conversation.Status == ConversationStatus.Bot)
        {
            conversation.Status = ConversationStatus.Human;
            conversation.AssignedUserId = userId;
            conversation.AssignedUserName = userName;
        }
        contact.UnreadCount = 0;
        await db.SaveChangesAsync(ct);
        return (message, send.Error, send.Simulated);
    }

    public async Task<(Message? Message, string? Error, bool Simulated)> SendAutomatedAsync(Conversation conversation, string body,
        string intent, CancellationToken ct = default)
    {
        var account = await db.WhatsAppAccounts.FirstOrDefaultAsync(a => a.IsEnabled, ct);
        var contact = await db.WhatsAppContacts.FirstOrDefaultAsync(c => c.Id == conversation.ContactId, ct);
        if (contact is null) return (null, "Contacto no encontrado.", false);
        var send = account is null
            ? new SendResult(false, true, null, null)
            : await sender.SendTextAsync(account, contact.WaId, body, ct);

        var message = new Message
        {
            ConversationId = conversation.Id,
            Direction = MessageDirection.Outbound,
            Body = body,
            IsAutomated = true,
            Intent = intent,
            Status = send.Simulated ? "simulated" : send.Sent ? "delivered" : "failed",
            ExternalId = send.ExternalId
        };
        db.Messages.Add(message);
        conversation.LastMessagePreview = body;
        conversation.LastMessageAt = DateTime.UtcNow;
        conversation.MessageCount += 1;
        await db.SaveChangesAsync(ct);
        return (message, send.Error, send.Simulated);
    }
}
