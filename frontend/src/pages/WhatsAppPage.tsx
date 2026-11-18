import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bot,
  CheckCheck,
  ChevronLeft,
  CircleHelp,
  Handshake,
  Headphones,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  TestTube2,
  Trash2,
  UserCheck,
  Webhook,
  Zap,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth, usePermissions } from '../lib/auth'
import type {
  BotReply,
  Conversation,
  ConversationDetail,
  FAQ,
  Message,
  WhatsAppAccount,
  WhatsAppStats,
  WebhookInfo,
} from '../lib/types'
import { conversationStatusLabels, intentLabels, timeOnly } from '../lib/format'
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  CopyButton,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  PageLoader,
  SearchInput,
  Select,
  Tabs,
  Textarea,
  Toggle,
  cn,
  useToast,
} from '../components/ui'

type AccountForm = {
  wabaId: string
  phoneNumberId: string
  displayPhoneNumber: string
  accessToken: string
  isEnabled: boolean
  aiEnabled: boolean
  aiModel: string
  welcomeMessage: string
  fallbackMessage: string
  handoffMessage: string
  businessHoursText: string
  locationText: string
  paymentMethodsText: string
  servicesText: string
  systemPrompt: string
  autoReplyEnabled: boolean
  productLookupEnabled: boolean
}

const emptyAccount: AccountForm = {
  wabaId: '', phoneNumberId: '', displayPhoneNumber: '', accessToken: '', isEnabled: false,
  aiEnabled: true, aiModel: 'gpt-4o-mini',
  welcomeMessage: '¡Hola! 👋 Gracias por escribirnos. ¿En qué podemos ayudarte?',
  fallbackMessage: 'No entendí tu mensaje. Un asesor te ayudará en un momento.',
  handoffMessage: 'Te estamos conectando con un asesor humano. Por favor espera un momento.',
  businessHoursText: '', locationText: '', paymentMethodsText: '', servicesText: '', systemPrompt: '',
  autoReplyEnabled: true, productLookupEnabled: true,
}

type FaqForm = { question: string; answer: string; keywords: string; priority: string; isActive: boolean }
const emptyFaq: FaqForm = { question: '', answer: '', keywords: '', priority: '0', isActive: true }

export function WhatsAppPage() {
  const { session } = useAuth()
  const { canManageWhatsApp } = usePermissions()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<'inbox' | 'automation' | 'settings'>('inbox')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [faqOpen, setFaqOpen] = useState(false)
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null)
  const [faqForm, setFaqForm] = useState<FaqForm>(emptyFaq)
  const [deletingFaq, setDeletingFaq] = useState<FAQ | null>(null)
  const [accountForm, setAccountForm] = useState<AccountForm>(emptyAccount)
  const [simInput, setSimInput] = useState('')
  const [simReply, setSimReply] = useState<BotReply | null>(null)
  const [testTo, setTestTo] = useState('')
  const [testMessage, setTestMessage] = useState('')

  const scrollRef = useRef<HTMLDivElement | null>(null)

  const { data: stats } = useQuery({
    queryKey: ['whatsapp-stats'],
    queryFn: () => api.get<WhatsAppStats>('/whatsapp/stats', { days: 14 }),
    refetchInterval: 60000,
  })

  const { data: conversations, isLoading: conversationsLoading } = useQuery({
    queryKey: ['whatsapp-conversations', statusFilter, search],
    queryFn: () => api.get<Conversation[]>('/whatsapp/conversations', { status: statusFilter || undefined, search }),
    refetchInterval: 20000,
  })

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['whatsapp-conversation', selectedId],
    queryFn: () => api.get<ConversationDetail>(`/whatsapp/conversations/${selectedId}`),
    enabled: Boolean(selectedId),
    refetchInterval: 15000,
  })

  const { data: account } = useQuery({ queryKey: ['whatsapp-account'], queryFn: () => api.get<WhatsAppAccount>('/whatsapp/account') })
  const { data: webhook } = useQuery({ queryKey: ['whatsapp-webhook'], queryFn: () => api.get<WebhookInfo>('/whatsapp/webhook-info') })
  const { data: faqs, isLoading: faqsLoading } = useQuery({ queryKey: ['whatsapp-faqs'], queryFn: () => api.get<FAQ[]>('/whatsapp/faqs') })

  useEffect(() => {
    if (!account) return
    setAccountForm({
      wabaId: account.wabaId ?? '',
      phoneNumberId: account.phoneNumberId ?? '',
      displayPhoneNumber: account.displayPhoneNumber ?? '',
      accessToken: '',
      isEnabled: account.isEnabled,
      aiEnabled: account.aiEnabled,
      aiModel: account.aiModel ?? 'gpt-4o-mini',
      welcomeMessage: account.welcomeMessage,
      fallbackMessage: account.fallbackMessage,
      handoffMessage: account.handoffMessage,
      businessHoursText: account.businessHoursText ?? '',
      locationText: account.locationText ?? '',
      paymentMethodsText: account.paymentMethodsText ?? '',
      servicesText: account.servicesText ?? '',
      systemPrompt: account.systemPrompt ?? '',
      autoReplyEnabled: account.autoReplyEnabled,
      productLookupEnabled: account.productLookupEnabled,
    })
  }, [account])

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [detail?.messages.length, selectedId])

  const sendMutation = useMutation({
    mutationFn: () => api.post<{ message: Message; simulated: boolean; warning?: string | null }>(`/whatsapp/conversations/${selectedId}/messages`, { body: draft }),
    onSuccess: (result) => {
      setDraft('')
      if (result.warning) toast(result.warning, 'info')
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-conversation', selectedId] })
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] })
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-stats'] })
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo enviar el mensaje.', 'error'),
  })

  const handoffMutation = useMutation({
    mutationFn: () => api.post<Conversation>(`/whatsapp/conversations/${selectedId}/handoff`, { userId: null }),
    onSuccess: () => {
      toast('Conversación asignada a un asesor.')
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-conversation', selectedId] })
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] })
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-stats'] })
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo asignar la conversación.', 'error'),
  })

  const statusMutation = useMutation({
    mutationFn: (action: 'close' | 'reopen') => api.post<Conversation>(`/whatsapp/conversations/${selectedId}/${action}`),
    onSuccess: (_, action) => {
      toast(action === 'close' ? 'Conversación cerrada.' : 'Conversación reabierta y devuelta al bot.')
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-conversation', selectedId] })
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] })
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-stats'] })
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo actualizar la conversación.', 'error'),
  })

  const saveAccount = useMutation({
    mutationFn: () =>
      api.put<WhatsAppAccount>('/whatsapp/account', {
        wabaId: accountForm.wabaId || null,
        phoneNumberId: accountForm.phoneNumberId || null,
        displayPhoneNumber: accountForm.displayPhoneNumber || null,
        accessToken: accountForm.accessToken || null,
        isEnabled: accountForm.isEnabled,
        aiEnabled: accountForm.aiEnabled,
        aiModel: accountForm.aiModel || null,
        welcomeMessage: accountForm.welcomeMessage,
        fallbackMessage: accountForm.fallbackMessage,
        handoffMessage: accountForm.handoffMessage,
        businessHoursText: accountForm.businessHoursText || null,
        locationText: accountForm.locationText || null,
        paymentMethodsText: accountForm.paymentMethodsText || null,
        servicesText: accountForm.servicesText || null,
        systemPrompt: accountForm.systemPrompt || null,
        autoReplyEnabled: accountForm.autoReplyEnabled,
        productLookupEnabled: accountForm.productLookupEnabled,
      }),
    onSuccess: () => {
      toast('Configuración de WhatsApp guardada.')
      setAccountForm((current) => ({ ...current, accessToken: '' }))
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-account'] })
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-webhook'] })
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo guardar la configuración.', 'error'),
  })

  const generateToken = useMutation({
    mutationFn: () => api.post<WhatsAppAccount>('/whatsapp/account/generate-verify-token'),
    onSuccess: () => {
      toast('Nuevo token de verificación generado.')
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-account'] })
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-webhook'] })
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo generar el token.', 'error'),
  })

  const simulate = useMutation({
    mutationFn: () => api.post<BotReply>('/whatsapp/simulate', { message: simInput }),
    onSuccess: (reply) => setSimReply(reply),
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo probar el bot.', 'error'),
  })

  const testSend = useMutation({
    mutationFn: () => api.post<{ sent: boolean; simulated: boolean; message: string }>('/whatsapp/test-send', { to: testTo, message: testMessage }),
    onSuccess: (result) => toast(result.message, result.sent ? 'success' : 'info'),
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo enviar la prueba.', 'error'),
  })

  const openFaq = (faq?: FAQ) => {
    setEditingFaq(faq ?? null)
    setFaqForm(faq ? { question: faq.question, answer: faq.answer, keywords: faq.keywords ?? '', priority: String(faq.priority), isActive: faq.isActive } : emptyFaq)
    setFaqOpen(true)
  }

  const saveFaq = useMutation({
    mutationFn: () => {
      const payload = {
        question: faqForm.question,
        answer: faqForm.answer,
        keywords: faqForm.keywords || null,
        priority: Number(faqForm.priority) || 0,
        isActive: faqForm.isActive,
      }
      return editingFaq ? api.put<FAQ>(`/whatsapp/faqs/${editingFaq.id}`, payload) : api.post<FAQ>('/whatsapp/faqs', payload)
    },
    onSuccess: () => {
      toast(editingFaq ? 'Pregunta actualizada.' : 'Pregunta agregada.')
      setFaqOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-faqs'] })
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo guardar la pregunta.', 'error'),
  })

  const deleteFaq = useMutation({
    mutationFn: (id: string) => api.delete(`/whatsapp/faqs/${id}`),
    onSuccess: () => {
      toast('Pregunta eliminada.')
      setDeletingFaq(null)
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-faqs'] })
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo eliminar la pregunta.', 'error'),
  })

  const selectedConversation = detail?.conversation
  const conversationsList = conversations ?? []

  if (!canManageWhatsApp && session?.user.role !== 'Owner' && session?.user.role !== 'Admin') {
    return (
      <div className="page">
        <EmptyState title="No tienes acceso a WhatsApp" description="Solicita a un administrador el permiso para gestionar conversaciones y automatizaciones." icon={<MessageCircle className="size-5" />} />
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="WhatsApp Business"
        subtitle="Atención automática con IA, preguntas frecuentes y handoff humano."
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={account?.isEnabled ? 'green' : 'amber'}>
              <span className={cn('size-1.5 rounded-full', account?.isEnabled ? 'bg-emerald-500' : 'bg-amber-500')} />
              {account?.isEnabled ? 'Conectado' : 'Modo simulación'}
            </Badge>
            {account?.aiKeyConfigured ? <Badge tone="violet"><Sparkles className="size-3" /> IA activa</Badge> : <Badge tone="gray">IA opcional</Badge>}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Conversaciones</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><MessageCircle className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[20px] font-bold text-ink">{stats?.openConversations ?? 0}</p>
          <p className="mt-1 text-[10px] text-muted">{stats?.totalConversations ?? 0} en total</p>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Con asesor</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><Headphones className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[20px] font-bold text-ink">{stats?.humanConversations ?? 0}</p>
          <p className="mt-1 text-[10px] text-muted">Requieren atención humana</p>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Automatización</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><Zap className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[20px] font-bold text-ink">{stats?.automationRate ?? 0}%</p>
          <p className="mt-1 text-[10px] text-muted">{stats?.automatedMessages ?? 0} respuestas automáticas</p>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Mensajes</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600"><Send className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[20px] font-bold text-ink">{(stats?.inboundMessages ?? 0) + (stats?.outboundMessages ?? 0)}</p>
          <p className="mt-1 text-[10px] text-muted">{stats?.activeContacts ?? 0} contactos activos</p>
        </div>
      </div>

      <div className="mt-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'inbox', label: 'Bandeja', count: conversationsList.reduce((sum, item) => sum + item.unreadCount, 0) || undefined, icon: <MessageCircle className="size-3.5" /> },
            { id: 'automation', label: 'Automatización', icon: <Bot className="size-3.5" /> },
            { id: 'settings', label: 'Conexión', icon: <Webhook className="size-3.5" /> },
          ]}
        />
      </div>

      {tab === 'inbox' && (
        <div className="card mt-3 overflow-hidden">
          <div className="grid md:grid-cols-[320px_1fr] xl:grid-cols-[360px_1fr]">
            <div className={cn('border-line md:border-r', selectedId && 'hidden md:block')}>
              <div className="space-y-2 border-b border-line p-3">
                <SearchInput value={search} onChange={setSearch} placeholder="Buscar conversación…" />
                <div className="flex gap-1.5">
                  {[
                    { id: '', label: 'Todas' },
                    { id: 'Bot', label: 'Bot' },
                    { id: 'Human', label: 'Asesor' },
                    { id: 'Closed', label: 'Cerradas' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setStatusFilter(option.id)}
                      className={cn(
                        'flex-1 rounded-lg px-2 py-1.5 text-[10.5px] font-semibold transition-colors',
                        statusFilter === option.id ? 'bg-brand-600 text-white' : 'bg-canvas text-muted hover:bg-brand-50',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-[62vh] overflow-y-auto scroll-thin md:max-h-[600px]">
                {conversationsLoading ? (
                  <PageLoader label="Cargando bandeja…" />
                ) : conversationsList.length === 0 ? (
                  <EmptyState title="Sin conversaciones" description="Los mensajes de WhatsApp aparecerán aquí." icon={<MessageCircle className="size-5" />} />
                ) : (
                  conversationsList.map((conversation) => (
                    <button
                      key={conversation.id}
                      onClick={() => setSelectedId(conversation.id)}
                      className={cn(
                        'flex w-full items-start gap-2.5 border-b border-line/70 px-3 py-3 text-left transition-colors hover:bg-brand-50/50',
                        selectedId === conversation.id && 'bg-brand-50/70',
                      )}
                    >
                      <Avatar name={conversation.contactName} src={conversation.avatarUrl} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink">{conversation.contactName}</p>
                          <span className="shrink-0 text-[9px] text-muted">{timeOnly(conversation.lastMessageAt)}</span>
                        </div>
                        <p className="mt-0.5 truncate text-[10.5px] text-muted">{conversation.lastMessagePreview ?? 'Sin mensajes'}</p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <Badge tone={conversation.status === 'Human' ? 'amber' : conversation.status === 'Closed' ? 'gray' : 'violet'}>
                            {conversationStatusLabels[conversation.status] ?? conversation.status}
                          </Badge>
                          {conversation.unreadCount > 0 && (
                            <span className="flex size-4 items-center justify-center rounded-full bg-rose-500 text-[8.5px] font-bold text-white">{conversation.unreadCount}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className={cn('flex min-h-[420px] flex-col md:min-h-[600px]', !selectedId && 'hidden md:flex')}>
              {!selectedId ? (
                <div className="flex flex-1 items-center justify-center">
                  <EmptyState title="Elige una conversación" description="Selecciona un chat para ver el historial y responder." icon={<MessageCircle className="size-5" />} />
                </div>
              ) : detailLoading || !detail ? (
                <PageLoader label="Abriendo conversación…" />
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5 sm:px-4">
                    <button onClick={() => setSelectedId(null)} className="icon-btn -ml-1 md:hidden" aria-label="Volver">
                      <ChevronLeft className="size-4" />
                    </button>
                    <Avatar name={selectedConversation?.contactName} src={selectedConversation?.avatarUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-bold text-ink">{selectedConversation?.contactName}</p>
                      <p className="text-[10px] text-muted">
                        {selectedConversation?.contactPhone ?? 'WhatsApp'}
                        {selectedConversation?.assignedUserName ? ` · ${selectedConversation.assignedUserName}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge tone={selectedConversation?.status === 'Human' ? 'amber' : selectedConversation?.status === 'Closed' ? 'gray' : 'violet'}>
                        {conversationStatusLabels[selectedConversation?.status ?? 'Bot'] ?? selectedConversation?.status}
                      </Badge>
                      {selectedConversation?.status !== 'Human' && selectedConversation?.status !== 'Closed' && (
                        <button onClick={() => handoffMutation.mutate()} className="icon-btn border border-line bg-white text-amber-600" aria-label="Tomar conversación" title="Tomar conversación">
                          <Handshake className="size-4" />
                        </button>
                      )}
                      {selectedConversation?.status === 'Closed' ? (
                        <button onClick={() => statusMutation.mutate('reopen')} className="icon-btn border border-line bg-white text-emerald-600" aria-label="Reabrir" title="Reabrir con el bot">
                          <RefreshCw className="size-4" />
                        </button>
                      ) : (
                        <button onClick={() => statusMutation.mutate('close')} className="icon-btn border border-line bg-white text-muted" aria-label="Cerrar" title="Cerrar conversación">
                          <CheckCheck className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div ref={scrollRef} className="scroll-thin flex-1 space-y-2 overflow-y-auto bg-canvas/60 px-3 py-3 sm:px-4">
                    {detail.messages.map((message) => (
                      <Bubble key={message.id} message={message} />
                    ))}
                  </div>

                  <div className="border-t border-line p-2.5 sm:p-3">
                    {selectedConversation?.status === 'Closed' && (
                      <p className="mb-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[10.5px] text-amber-800">Esta conversación está cerrada. Al enviar un mensaje se reabrirá con un asesor.</p>
                    )}
                    <div className="flex items-end gap-2">
                      <Textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault()
                            if (draft.trim()) sendMutation.mutate()
                          }
                        }}
                        rows={1}
                        placeholder="Escribe una respuesta…"
                        className="max-h-24 min-h-[42px] flex-1 resize-none py-2.5"
                      />
                      <Button onClick={() => sendMutation.mutate()} loading={sendMutation.isPending} disabled={!draft.trim()} className="shrink-0">
                        <Send className="size-4" />
                      </Button>
                    </div>
                    <p className="mt-1 text-[9.5px] text-muted">Enter envía · Shift + Enter agrega una línea</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'automation' && (
        <div className="mt-3 grid gap-4 xl:grid-cols-[1fr_400px]">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-line p-4">
              <div>
                <p className="text-[13px] font-bold text-ink">Preguntas frecuentes</p>
                <p className="text-[10.5px] text-muted">El bot responde automáticamente según estas preguntas.</p>
              </div>
              <Button size="sm" onClick={() => openFaq()}><Plus className="size-3.5" /> Agregar</Button>
            </div>
            {faqsLoading ? (
              <PageLoader label="Cargando preguntas…" />
            ) : (faqs?.length ?? 0) === 0 ? (
              <EmptyState
                title="Sin preguntas frecuentes"
                description="Agrega las preguntas que más te hacen para responderlas al instante."
                icon={<CircleHelp className="size-5" />}
                action={<Button size="sm" onClick={() => openFaq()}><Plus className="size-3.5" /> Agregar pregunta</Button>}
              />
            ) : (
              <div className="divide-y divide-line">
                {faqs?.map((faq) => (
                  <div key={faq.id} className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><CircleHelp className="size-3.5" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-[12px] font-semibold text-ink">{faq.question}</p>
                          <Badge tone={faq.isActive ? 'green' : 'gray'}>{faq.isActive ? 'Activa' : 'Inactiva'}</Badge>
                          <span className="text-[9.5px] text-muted">Prioridad {faq.priority}</span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-muted">{faq.answer}</p>
                        {faq.keywords && <p className="mt-1 text-[9.5px] text-brand-500">Palabras: {faq.keywords}</p>}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button onClick={() => openFaq(faq)} className="icon-btn border border-line bg-white" aria-label="Editar"><Pencil className="size-3.5" /></button>
                        <button onClick={() => setDeletingFaq(faq)} className="icon-btn border border-line bg-white text-rose-500" aria-label="Eliminar"><Trash2 className="size-3.5" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="card overflow-hidden">
              <div className="flex items-center gap-2 border-b border-line p-4">
                <Bot className="size-4 text-brand-500" />
                <div>
                  <p className="text-[12.5px] font-bold text-ink">Probar el asistente</p>
                  <p className="text-[10px] text-muted">Simula un mensaje de cliente sin enviar WhatsApp.</p>
                </div>
              </div>
              <div className="space-y-2.5 p-4">
                {simReply && (
                  <div className="space-y-2">
                    <div className="ml-auto max-w-[90%] rounded-2xl rounded-br-md bg-brand-600 px-3 py-2 text-[11.5px] text-white">
                      {simInput || 'Tu mensaje de prueba'}
                    </div>
                    <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-line bg-white px-3 py-2">
                      <p className="whitespace-pre-line text-[11.5px] text-ink">{simReply.reply}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        <Badge tone="violet">{intentLabels[simReply.intent] ?? simReply.intent}</Badge>
                        {simReply.handoff && <Badge tone="amber"><UserCheck className="size-3" /> Handoff</Badge>}
                        {simReply.products.length > 0 && <Badge tone="gray">{simReply.products.length} productos</Badge>}
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex gap-1.5">
                  <Input value={simInput} onChange={(event) => setSimInput(event.target.value)} placeholder="Ej. ¿Tienen camisetas?" onKeyDown={(event) => event.key === 'Enter' && simInput.trim() && simulate.mutate()} />
                  <Button size="sm" onClick={() => simulate.mutate()} loading={simulate.isPending} disabled={!simInput.trim()}><TestTube2 className="size-4" /></Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['Hola', '¿Cuál es el horario?', '¿Tienen camisetas?', '¿Dónde están?', '¿Cómo pago?'].map((example) => (
                    <button key={example} onClick={() => setSimInput(example)} className="rounded-full border border-line px-2 py-1 text-[9.5px] font-medium text-muted hover:border-brand-200 hover:text-brand-700">
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="card p-4">
              <p className="text-[12px] font-semibold text-ink">Qué puede responder el bot</p>
              <ul className="mt-2 space-y-1.5 text-[11px] text-muted">
                <li className="flex items-start gap-1.5"><CheckCheck className="mt-0.5 size-3 shrink-0 text-emerald-500" /> Precios, stock y productos del catálogo</li>
                <li className="flex items-start gap-1.5"><CheckCheck className="mt-0.5 size-3 shrink-0 text-emerald-500" /> Horarios, ubicación y métodos de pago</li>
                <li className="flex items-start gap-1.5"><CheckCheck className="mt-0.5 size-3 shrink-0 text-emerald-500" /> Preguntas frecuentes con prioridad</li>
                <li className="flex items-start gap-1.5"><CheckCheck className="mt-0.5 size-3 shrink-0 text-emerald-500" /> Transferencia a un asesor humano cuando hace falta</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="mt-3 grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="card p-4 sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-bold text-ink">Conexión con Meta Cloud API</p>
                <p className="text-[10.5px] text-muted">Configura tus credenciales oficiales de WhatsApp Business.</p>
              </div>
              <Badge tone={account?.isEnabled ? 'green' : 'amber'}>{account?.isEnabled ? 'Activo' : 'Desactivado'}</Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="WABA ID">
                <Input value={accountForm.wabaId} onChange={(event) => setAccountForm((current) => ({ ...current, wabaId: event.target.value }))} placeholder="WhatsApp Business Account ID" />
              </Field>
              <Field label="Phone Number ID">
                <Input value={accountForm.phoneNumberId} onChange={(event) => setAccountForm((current) => ({ ...current, phoneNumberId: event.target.value }))} placeholder="Identificador del número" />
              </Field>
              <Field label="Número visible">
                <Input value={accountForm.displayPhoneNumber} onChange={(event) => setAccountForm((current) => ({ ...current, displayPhoneNumber: event.target.value }))} placeholder="+57 300 000 0000" />
              </Field>
              <Field label="Access Token" hint={account?.hasToken ? 'Ya hay un token guardado. Déjalo vacío para conservarlo.' : 'Token permanente de Meta.'}>
                <Input type="password" value={accountForm.accessToken} onChange={(event) => setAccountForm((current) => ({ ...current, accessToken: event.target.value }))} placeholder={account?.hasToken ? '••••••••' : 'EAAG…'} />
              </Field>
            </div>

            <div className="mt-4 space-y-3 rounded-xl border border-line p-3.5">
              <Toggle checked={accountForm.isEnabled} onChange={(value) => setAccountForm((current) => ({ ...current, isEnabled: value }))} label="Conexión activa" description="Envía y recibe mensajes reales a través de Meta." />
              <Toggle checked={accountForm.autoReplyEnabled} onChange={(value) => setAccountForm((current) => ({ ...current, autoReplyEnabled: value }))} label="Respuestas automáticas" description="Responde sin intervención humana." />
              <Toggle checked={accountForm.productLookupEnabled} onChange={(value) => setAccountForm((current) => ({ ...current, productLookupEnabled: value }))} label="Consulta de productos" description="Busca precios y stock en tu catálogo." />
              <Toggle checked={accountForm.aiEnabled} onChange={(value) => setAccountForm((current) => ({ ...current, aiEnabled: value }))} label="Asistente con IA" description={account?.aiKeyConfigured ? 'IA configurada en el servidor.' : 'Requiere una clave de IA configurada en el servidor.'} />
            </div>

            <div className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Mensaje de bienvenida">
                  <Textarea value={accountForm.welcomeMessage} onChange={(event) => setAccountForm((current) => ({ ...current, welcomeMessage: event.target.value }))} rows={3} />
                </Field>
                <Field label="Mensaje de respaldo">
                  <Textarea value={accountForm.fallbackMessage} onChange={(event) => setAccountForm((current) => ({ ...current, fallbackMessage: event.target.value }))} rows={3} />
                </Field>
              </div>
              <Field label="Mensaje de transferencia a asesor">
                <Textarea value={accountForm.handoffMessage} onChange={(event) => setAccountForm((current) => ({ ...current, handoffMessage: event.target.value }))} rows={2} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Horarios (texto)">
                  <Input value={accountForm.businessHoursText} onChange={(event) => setAccountForm((current) => ({ ...current, businessHoursText: event.target.value }))} placeholder="Lun a sáb 9:00 - 19:00" />
                </Field>
                <Field label="Ubicación (texto)">
                  <Input value={accountForm.locationText} onChange={(event) => setAccountForm((current) => ({ ...current, locationText: event.target.value }))} placeholder="Cra 10 #20-30, Bogotá" />
                </Field>
                <Field label="Métodos de pago (texto)">
                  <Input value={accountForm.paymentMethodsText} onChange={(event) => setAccountForm((current) => ({ ...current, paymentMethodsText: event.target.value }))} placeholder="Efectivo, Nequi, tarjeta" />
                </Field>
                <Field label="Servicios (texto)">
                  <Input value={accountForm.servicesText} onChange={(event) => setAccountForm((current) => ({ ...current, servicesText: event.target.value }))} placeholder="Domicilios, asesoría personalizada" />
                </Field>
              </div>
              <Field label="Modelo de IA">
                <Select value={accountForm.aiModel} onChange={(event) => setAccountForm((current) => ({ ...current, aiModel: event.target.value }))}>
                  <option value="gpt-4o-mini">gpt-4o-mini · rápido y económico</option>
                  <option value="gpt-4o">gpt-4o · mayor calidad</option>
                  <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                </Select>
              </Field>
              <Field label="Instrucciones del asistente (system prompt)" hint="Define el tono y los límites del asistente.">
                <Textarea value={accountForm.systemPrompt} onChange={(event) => setAccountForm((current) => ({ ...current, systemPrompt: event.target.value }))} rows={3} placeholder="Eres el asistente de…" />
              </Field>
            </div>

            <div className="mt-5 flex justify-end border-t border-line pt-4">
              <Button onClick={() => saveAccount.mutate()} loading={saveAccount.isPending} disabled={!accountForm.welcomeMessage.trim() || !accountForm.fallbackMessage.trim() || !accountForm.handoffMessage.trim()}>
                Guardar configuración
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="card p-4">
              <div className="flex items-center gap-2">
                <Webhook className="size-4 text-brand-500" />
                <p className="text-[12.5px] font-bold text-ink">Webhook de Meta</p>
              </div>
              <p className="mt-1 text-[10.5px] text-muted">Copia esta URL y el token en tu app de Meta Developers.</p>
              <div className="mt-3 space-y-2">
                <div>
                  <p className="label mb-1 text-[10px] uppercase">Callback URL</p>
                  <div className="flex items-start gap-1.5 rounded-lg border border-line bg-canvas p-2">
                    <p className="min-w-0 flex-1 break-all text-[10px] leading-snug text-ink">{webhook?.webhookUrl ?? '—'}</p>
                    {webhook && <CopyButton value={webhook.webhookUrl} />}
                  </div>
                </div>
                <div>
                  <p className="label mb-1 text-[10px] uppercase">Verify token</p>
                  <div className="flex items-center gap-1.5 rounded-lg border border-line bg-canvas p-2">
                    <p className="min-w-0 flex-1 truncate text-[10px] text-ink">{webhook?.verifyToken ?? account?.verifyToken ?? '—'}</p>
                    {(webhook?.verifyToken || account?.verifyToken) && <CopyButton value={webhook?.verifyToken ?? account?.verifyToken ?? ''} />}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-canvas px-2.5 py-2 text-[10.5px]">
                  <span className="text-muted">Graph API</span>
                  <span className="font-semibold text-ink">{webhook?.graphVersion ?? 'v21.0'}</span>
                </div>
                <Button variant="secondary" size="sm" className="w-full" onClick={() => generateToken.mutate()} loading={generateToken.isPending}>
                  <RefreshCw className="size-3.5" /> Generar nuevo token
                </Button>
              </div>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2">
                <TestTube2 className="size-4 text-brand-500" />
                <p className="text-[12.5px] font-bold text-ink">Enviar mensaje de prueba</p>
              </div>
              <p className="mt-1 text-[10.5px] text-muted">Sin credenciales, el mensaje se registra como simulado.</p>
              <div className="mt-2.5 space-y-2">
                <Input value={testTo} onChange={(event) => setTestTo(event.target.value)} placeholder="Número destino · +57300…" />
                <Input value={testMessage} onChange={(event) => setTestMessage(event.target.value)} placeholder="Hola, esta es una prueba" />
                <Button size="sm" className="w-full" onClick={() => testSend.mutate()} loading={testSend.isPending} disabled={!testTo.trim() || !testMessage.trim()}>
                  <Send className="size-3.5" /> Enviar prueba
                </Button>
              </div>
            </div>

            <div className="card p-4">
              <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink"><Phone className="size-3.5 text-brand-500" /> Buenas prácticas</p>
              <ul className="mt-2 space-y-1.5 text-[10.5px] leading-relaxed text-muted">
                <li>• Verifica tu número en Meta Business antes de activar la conexión.</li>
                <li>• Mantén respuestas claras y ofrece siempre pasar a un asesor.</li>
                <li>• Revisa la bandeja a diario: el handoff humano mejora la conversión.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={faqOpen}
        onClose={() => setFaqOpen(false)}
        title={editingFaq ? 'Editar pregunta' : 'Nueva pregunta frecuente'}
        subtitle="El bot buscará coincidencias en la pregunta, respuesta y palabras clave."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setFaqOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveFaq.mutate()} loading={saveFaq.isPending} disabled={!faqForm.question.trim() || !faqForm.answer.trim()}>Guardar</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="Pregunta" required>
            <Input value={faqForm.question} onChange={(event) => setFaqForm((current) => ({ ...current, question: event.target.value }))} placeholder="¿Cuál es el horario de atención?" />
          </Field>
          <Field label="Respuesta" required>
            <Textarea value={faqForm.answer} onChange={(event) => setFaqForm((current) => ({ ...current, answer: event.target.value }))} rows={4} placeholder="Atendemos de lunes a sábado…" />
          </Field>
          <Field label="Palabras clave" hint="Sepáralas con comas para mejorar la detección.">
            <Input value={faqForm.keywords} onChange={(event) => setFaqForm((current) => ({ ...current, keywords: event.target.value }))} placeholder="horario, abierto, hora" />
          </Field>
          <Field label="Prioridad" hint="Mayor prioridad se evalúa primero.">
            <Input inputMode="numeric" value={faqForm.priority} onChange={(event) => setFaqForm((current) => ({ ...current, priority: event.target.value }))} />
          </Field>
          <Toggle checked={faqForm.isActive} onChange={(value) => setFaqForm((current) => ({ ...current, isActive: value }))} label="Pregunta activa" />
        </div>
      </Modal>

      <ConfirmDialog
        open={deletingFaq !== null}
        onClose={() => setDeletingFaq(null)}
        onConfirm={() => deletingFaq && deleteFaq.mutate(deletingFaq.id)}
        title="Eliminar pregunta"
        message={`Se eliminará "${deletingFaq?.question ?? ''}" de las respuestas automáticas.`}
        loading={deleteFaq.isPending}
      />

      <div className="mt-4 flex items-center gap-2 text-[10.5px] text-muted">
        <Bot className="size-3" /> Los mensajes simulados no se envían a clientes reales.
      </div>
    </div>
  )
}

function Bubble({ message }: { message: Message }) {
  const outbound = message.direction === 'Outbound'
  return (
    <div className={cn('flex', outbound ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[86%] rounded-2xl px-3 py-2 shadow-sm sm:max-w-[75%]', outbound ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md border border-line bg-white text-ink')}>
        {message.isAutomated && (
          <span className={cn('mb-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8.5px] font-bold', outbound ? 'bg-white/15 text-white' : 'bg-brand-50 text-brand-700')}>
            <Bot className="size-2.5" /> Bot{message.intent ? ` · ${intentLabels[message.intent] ?? message.intent}` : ''}
          </span>
        )}
        <p className="whitespace-pre-line text-[11.5px] leading-relaxed">{message.body}</p>
        <div className={cn('mt-1 flex items-center justify-end gap-1 text-[8.5px]', outbound ? 'text-white/60' : 'text-muted')}>
          {timeOnly(message.createdAt)}
          {outbound && <CheckCheck className="size-3" />}
        </div>
      </div>
    </div>
  )
}
