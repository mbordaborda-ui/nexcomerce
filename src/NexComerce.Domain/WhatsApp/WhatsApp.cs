using NexComerce.Domain.Common;

namespace NexComerce.Domain.WhatsApp;

/// <summary>Independent WhatsApp Business (Meta Cloud API) connection for each tenant.</summary>
public class WhatsAppAccount : TenantEntity
{
    public string? WabaId { get; set; }
    public string? PhoneNumberId { get; set; }
    public string? DisplayPhoneNumber { get; set; }
    public string? AccessToken { get; set; }
    public string VerifyToken { get; set; } = Guid.NewGuid().ToString("N");
    public string? AppSecret { get; set; }
    public bool IsEnabled { get; set; }
    public bool AiEnabled { get; set; } = true;
    public string? AiModel { get; set; }
    public string WelcomeMessage { get; set; } =
        "¡Hola! 👋 Gracias por escribir a {negocio}. Soy tu asistente virtual y puedo ayudarte con productos, precios, horarios y pedidos.";
    public string FallbackMessage { get; set; } =
        "No encontré una respuesta exacta. Un miembro del equipo te responderá muy pronto. 🙌";
    public string HandoffMessage { get; set; } =
        "Te estoy conectando con un asesor humano. Por favor espera un momento. 👤";
    public string? BusinessHoursText { get; set; }
    public string? LocationText { get; set; }
    public string? PaymentMethodsText { get; set; }
    public string? ServicesText { get; set; }
    public string? SystemPrompt { get; set; }
    public bool AutoReplyEnabled { get; set; } = true;
    public bool ProductLookupEnabled { get; set; } = true;
    public DateTime? ConnectedAt { get; set; }
}

public class WhatsAppContact : TenantEntity
{
    public string WaId { get; set; } = string.Empty;
    public string? Name { get; set; }
    public string? Phone { get; set; }
    public Guid? CustomerId { get; set; }
    public DateTime LastMessageAt { get; set; } = DateTime.UtcNow;
    public int UnreadCount { get; set; }
    public bool IsBlocked { get; set; }
    public string? AvatarUrl { get; set; }
}

public class Conversation : TenantEntity
{
    public Guid ContactId { get; set; }
    public Guid? AssignedUserId { get; set; }
    public string? AssignedUserName { get; set; }
    public ConversationStatus Status { get; set; } = ConversationStatus.Bot;
    public string? LastMessagePreview { get; set; }
    public DateTime LastMessageAt { get; set; } = DateTime.UtcNow;
    public int MessageCount { get; set; }
    public string? Tags { get; set; }

    public WhatsAppContact? Contact { get; set; }
    public ICollection<Message> Messages { get; set; } = [];
}

public class Message : TenantEntity
{
    public Guid ConversationId { get; set; }
    public MessageDirection Direction { get; set; }
    public string Body { get; set; } = string.Empty;
    public string? Type { get; set; } = "text";
    public string? MediaUrl { get; set; }
    public string? Status { get; set; }
    public bool IsAutomated { get; set; }
    public string? Intent { get; set; }
    public Guid? SentByUserId { get; set; }
    public string? SentByName { get; set; }
    public string? ExternalId { get; set; }

    public Conversation? Conversation { get; set; }
}

public class WhatsAppFaq : TenantEntity
{
    public string Question { get; set; } = string.Empty;
    public string Answer { get; set; } = string.Empty;
    public string? Keywords { get; set; }
    public int Priority { get; set; }
    public bool IsActive { get; set; } = true;
}
