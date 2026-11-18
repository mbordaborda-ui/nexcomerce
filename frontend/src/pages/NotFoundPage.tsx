import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button } from '../components/ui'
import { Logo } from '../components/layout'

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      <Logo />
      <span className="mt-6 flex size-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Compass className="size-7" />
      </span>
      <h1 className="font-display text-3xl font-extrabold text-ink">404</h1>
      <p className="max-w-sm text-sm text-muted">La página que buscas no existe o fue movida. Vuelve al inicio para seguir gestionando tu negocio.</p>
      <Link to="/"><Button>Ir al inicio</Button></Link>
    </div>
  )
}
