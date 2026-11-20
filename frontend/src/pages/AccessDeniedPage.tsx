import { Link } from 'react-router-dom'
import { ArrowRight, Lock, ShieldCheck } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { accessRules, firstAllowedPath } from '../lib/access'
import { Button } from '../components/ui'

export function AccessDeniedPage() {
  const { hasPermission, session } = useAuth()
  const home = firstAllowedPath(hasPermission)
  const allowed = accessRules.filter((rule) => hasPermission(rule.permission))

  return (
    <div className="page flex min-h-[70vh] items-center justify-center">
      <div className="card w-full max-w-xl p-6 text-center sm:p-8">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
          <Lock className="size-6" />
        </span>
        <h1 className="mt-4 font-display text-[22px] font-extrabold text-ink">Acceso restringido</h1>
        <p className="mx-auto mt-2 max-w-md text-[12.5px] leading-relaxed text-muted">
          Tu usuario no tiene permiso para esta sección. Si necesitas usarla, pídele al propietario del negocio que ajuste tus permisos.
        </p>

        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          <Link to={home} className="btn-primary btn-sm">
            Ir a mi inicio <ArrowRight className="size-3.5" />
          </Link>
          <Link to="/account" className="btn-secondary btn-sm">
            Mi cuenta
          </Link>
        </div>

        <div className="mt-6 border-t border-line pt-5 text-left">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted">
            <ShieldCheck className="size-3.5" /> Accesos disponibles para {session?.user.fullName.split(' ')[0] ?? 'tu usuario'}
          </p>
          {allowed.length === 0 ? (
            <p className="mt-2 text-[11.5px] text-muted">No tienes módulos asignados. Contacta al propietario.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {allowed.map((rule) => (
                <Link key={rule.path} to={rule.path} className="rounded-full bg-brand-50 px-2.5 py-1 text-[10.5px] font-semibold text-brand-700 hover:bg-brand-100">
                  {rule.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        <Button variant="ghost" size="sm" className="mt-4" onClick={() => window.history.back()}>
          Volver
        </Button>
      </div>
    </div>
  )
}
