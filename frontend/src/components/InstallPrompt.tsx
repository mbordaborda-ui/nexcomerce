import { useEffect, useState } from 'react'
import { Download, Share, X } from 'lucide-react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const DISMISS_KEY = 'nexcomerce.install-dismissed'

export function InstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    if (standalone) return

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isSafari = /safari/i.test(navigator.userAgent) && !/chrome|chromium|crios|fxios|edgios/i.test(navigator.userAgent)

    const onPrompt = (event: Event) => {
      event.preventDefault()
      setPrompt(event as BeforeInstallPromptEvent)
      setVisible(true)
    }

    const onInstalled = () => {
      setVisible(false)
      localStorage.setItem(DISMISS_KEY, '1')
    }

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)

    const timer = window.setTimeout(() => {
      if (isIos && isSafari) {
        setIos(true)
        setVisible(true)
      }
    }, 5000)

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      window.clearTimeout(timer)
    }
  }, [])

  if (!visible) return null

  const dismiss = () => {
    setVisible(false)
    localStorage.setItem(DISMISS_KEY, '1')
  }

  const install = async () => {
    if (!prompt) return
    await prompt.prompt()
    const choice = await prompt.userChoice
    if (choice.outcome === 'accepted') {
      setVisible(false)
      localStorage.setItem(DISMISS_KEY, '1')
    }
    setPrompt(null)
  }

  return (
    <div className="fixed inset-x-3 bottom-[88px] z-[60] lg:hidden">
      <div className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-white p-3 shadow-[var(--shadow-float)] animate-[slide-up_0.25s_ease-out]">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-800 text-white">
          <Download className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold text-ink">Instala NexComerce</p>
          {ios ? (
            <p className="text-[10.5px] leading-snug text-muted">
              Toca <Share className="inline size-3" /> Compartir y elige “Agregar a pantalla de inicio”.
            </p>
          ) : (
            <p className="text-[10.5px] leading-snug text-muted">Acceso rápido desde tu pantalla de inicio.</p>
          )}
        </div>
        {!ios && prompt && (
          <button onClick={install} className="shrink-0 rounded-lg bg-brand-600 px-2.5 py-1.5 text-[11px] font-semibold text-white">
            Instalar
          </button>
        )}
        <button onClick={dismiss} className="icon-btn shrink-0 border border-line bg-white" aria-label="Cerrar">
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
