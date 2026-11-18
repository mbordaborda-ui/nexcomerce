import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  CheckCircle2,
  Crown,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  Store,
  Trash2,
  UserCog,
  UserPlus,
  Users,
} from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuth, usePermissions } from '../lib/auth'
import type { Branch, MeResponse, PermissionItem, Role, User } from '../lib/types'
import { dateShort, roleLabel } from '../lib/format'
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  PageLoader,
  ProgressBar,
  Select,
  Tabs,
  Toggle,
  cn,
  useToast,
} from '../components/ui'

type UserForm = {
  fullName: string
  email: string
  password: string
  role: string
  branchId: string
  phone: string
  permissions: string[]
  isActive: boolean
}

type BranchForm = {
  name: string
  code: string
  address: string
  city: string
  phone: string
  isMain: boolean
  isActive: boolean
}

const emptyUser: UserForm = { fullName: '', email: '', password: '', role: 'Cashier', branchId: '', phone: '', permissions: [], isActive: true }
const emptyBranch: BranchForm = { name: '', code: '', address: '', city: '', phone: '', isMain: false, isActive: true }

export function TeamPage() {
  const { session } = useAuth()
  const { canManageEmployees } = usePermissions()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<'team' | 'branches' | 'plan'>('team')
  const [userOpen, setUserOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [userForm, setUserForm] = useState<UserForm>(emptyUser)
  const [deactivating, setDeactivating] = useState<User | null>(null)

  const [branchOpen, setBranchOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [branchForm, setBranchForm] = useState<BranchForm>(emptyBranch)
  const [deactivatingBranch, setDeactivatingBranch] = useState<Branch | null>(null)

  const { data: users, isLoading: usersLoading } = useQuery({ queryKey: ['team-users'], queryFn: () => api.get<User[]>('/team/users') })
  const { data: branches, isLoading: branchesLoading } = useQuery({ queryKey: ['branches'], queryFn: () => api.get<Branch[]>('/team/branches') })
  const { data: roles } = useQuery({ queryKey: ['team-roles'], queryFn: () => api.get<Role[]>('/team/roles') })
  const { data: permissions } = useQuery({ queryKey: ['team-permissions'], queryFn: () => api.get<PermissionItem[]>('/team/permissions') })
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api.get<MeResponse>('/auth/me') })

  const groupedPermissions = (permissions ?? []).reduce<Record<string, PermissionItem[]>>((groups, permission) => {
    groups[permission.group] = [...(groups[permission.group] ?? []), permission]
    return groups
  }, {})

  const openCreateUser = () => {
    setEditingUser(null)
    const cashier = roles?.find((role) => role.id === 'Cashier')
    setUserForm({ ...emptyUser, permissions: cashier?.permissions ?? [], branchId: session?.branch?.id ?? '' })
    setUserOpen(true)
  }

  const openEditUser = (user: User) => {
    setEditingUser(user)
    setUserForm({
      fullName: user.fullName,
      email: user.email,
      password: '',
      role: user.role,
      branchId: user.branchId ?? '',
      phone: user.phone ?? '',
      permissions: user.permissions,
      isActive: user.isActive,
    })
    setUserOpen(true)
  }

  useEffect(() => {
    if (!userOpen || editingUser || !roles) return
    const role = roles.find((item) => item.id === userForm.role)
    if (role) setUserForm((current) => ({ ...current, permissions: role.permissions }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userForm.role])

  const saveUser = useMutation({
    mutationFn: () => {
      if (editingUser) {
        return api.put<User>(`/team/users/${editingUser.id}`, {
          fullName: userForm.fullName,
          role: userForm.role,
          branchId: userForm.branchId || null,
          phone: userForm.phone || null,
          permissions: userForm.permissions,
          isActive: userForm.isActive,
        })
      }
      return api.post<User>('/team/users', {
        fullName: userForm.fullName,
        email: userForm.email,
        password: userForm.password,
        role: userForm.role,
        branchId: userForm.branchId || null,
        phone: userForm.phone || null,
        permissions: userForm.permissions,
      })
    },
    onSuccess: () => {
      toast(editingUser ? 'Usuario actualizado.' : 'Invitación creada. Comparte las credenciales con tu equipo.')
      setUserOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['team-users'] })
      void queryClient.invalidateQueries({ queryKey: ['me'] })
      void queryClient.invalidateQueries({ queryKey: ['branches'] })
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo guardar el usuario.', 'error'),
  })

  const deactivateUser = useMutation({
    mutationFn: (id: string) => api.delete(`/team/users/${id}`),
    onSuccess: () => {
      toast('Usuario desactivado.')
      setDeactivating(null)
      void queryClient.invalidateQueries({ queryKey: ['team-users'] })
      void queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo desactivar el usuario.', 'error'),
  })

  const openCreateBranch = () => {
    setEditingBranch(null)
    setBranchForm(emptyBranch)
    setBranchOpen(true)
  }

  const openEditBranch = (branch: Branch) => {
    setEditingBranch(branch)
    setBranchForm({
      name: branch.name,
      code: branch.code,
      address: branch.address ?? '',
      city: branch.city ?? '',
      phone: branch.phone ?? '',
      isMain: branch.isMain,
      isActive: branch.isActive,
    })
    setBranchOpen(true)
  }

  const saveBranch = useMutation({
    mutationFn: () => {
      const payload = {
        name: branchForm.name,
        code: branchForm.code,
        address: branchForm.address || null,
        city: branchForm.city || null,
        phone: branchForm.phone || null,
        isMain: branchForm.isMain,
        isActive: branchForm.isActive,
      }
      return editingBranch ? api.put<Branch>(`/team/branches/${editingBranch.id}`, payload) : api.post<Branch>('/team/branches', payload)
    },
    onSuccess: () => {
      toast(editingBranch ? 'Sede actualizada.' : 'Sede creada.')
      setBranchOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['branches'] })
      void queryClient.invalidateQueries({ queryKey: ['me'] })
      void queryClient.invalidateQueries({ queryKey: ['team-users'] })
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo guardar la sede.', 'error'),
  })

  const deactivateBranch = useMutation({
    mutationFn: (id: string) => api.delete(`/team/branches/${id}`),
    onSuccess: () => {
      toast('Sede desactivada.')
      setDeactivatingBranch(null)
      void queryClient.invalidateQueries({ queryKey: ['branches'] })
      void queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (error) => toast(error instanceof ApiError ? error.message : 'No se pudo desactivar la sede.', 'error'),
  })

  const togglePermission = (key: string) => {
    setUserForm((current) => ({
      ...current,
      permissions: current.permissions.includes(key) ? current.permissions.filter((item) => item !== key) : [...current.permissions, key],
    }))
  }

  const plan = me?.plan
  const usage = me?.usage

  return (
    <div className="page">
      <PageHeader
        title="Equipo y sedes"
        subtitle="Administra usuarios, permisos y sucursales de tu negocio."
        actions={
          canManageEmployees ? (
            <>
              <Button variant="secondary" size="sm" onClick={openCreateBranch}><Store className="size-3.5" /> Nueva sede</Button>
              <Button size="sm" onClick={openCreateUser}><UserPlus className="size-4" /> Nuevo usuario</Button>
            </>
          ) : undefined
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Equipo</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Users className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[20px] font-bold text-ink">{users?.length ?? 0}</p>
          <p className="mt-1 text-[10px] text-muted">de {plan?.userLimit ?? '—'} disponibles</p>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Sedes</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600"><Building2 className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[20px] font-bold text-ink">{branches?.length ?? 0}</p>
          <p className="mt-1 text-[10px] text-muted">de {plan?.branchLimit ?? '—'} en tu plan</p>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Plan</p>
            <span className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><Crown className="size-4" /></span>
          </div>
          <p className="mt-2 font-display text-[20px] font-bold text-ink">{plan?.plan ?? session?.tenant.plan ?? '—'}</p>
          <p className="mt-1 text-[10px] text-muted">{session?.tenant.trialEndsAt ? `Prueba hasta ${dateShort(session.tenant.trialEndsAt)}` : 'Suscripción activa'}</p>
        </div>
      </div>

      <div className="mt-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'team', label: 'Usuarios', count: users?.length, icon: <Users className="size-3.5" /> },
            { id: 'branches', label: 'Sedes', count: branches?.length, icon: <Store className="size-3.5" /> },
            { id: 'plan', label: 'Plan y uso', icon: <Crown className="size-3.5" /> },
          ]}
        />
      </div>

      {tab === 'team' && (
        <div className="card mt-3 overflow-hidden">
          <div className="border-b border-line p-4">
            <p className="text-[12px] font-semibold text-ink">Miembros del equipo</p>
            <p className="text-[10.5px] text-muted">Cada usuario accede solo a la información de tu negocio.</p>
          </div>
          {usersLoading ? (
            <PageLoader label="Cargando equipo…" />
          ) : (users?.length ?? 0) === 0 ? (
            <EmptyState title="Aún no hay usuarios" description="Agrega a tu equipo y asigna permisos según su rol." action={canManageEmployees ? <Button onClick={openCreateUser}><Plus className="size-4" /> Nuevo usuario</Button> : undefined} />
          ) : (
            <div className="divide-y divide-line">
              {users?.map((user) => (
                <div key={user.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={user.fullName} src={user.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-[12.5px] font-semibold text-ink">{user.fullName}</p>
                      {user.id === session?.user.id && <Badge tone="violet">Tú</Badge>}
                      {user.role === 'Owner' && <Crown className="size-3 text-amber-500" />}
                    </div>
                    <p className="truncate text-[10.5px] text-muted">{user.email}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone={user.role === 'Owner' ? 'amber' : 'gray'}>{roleLabel(user.role)}</Badge>
                      <span className="text-[9.5px] text-muted">{user.branchName ?? 'Todas las sedes'}</span>
                      <span className="text-[9.5px] text-muted">· {user.permissions.length} permisos</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge tone={user.isActive ? 'green' : 'gray'}>{user.isActive ? 'Activo' : 'Inactivo'}</Badge>
                    {canManageEmployees && user.role !== 'Owner' && (
                      <>
                        <button onClick={() => openEditUser(user)} className="icon-btn border border-line bg-white" aria-label="Editar"><Pencil className="size-3.5" /></button>
                        <button onClick={() => setDeactivating(user)} className="icon-btn border border-line bg-white text-rose-500" aria-label="Desactivar"><Trash2 className="size-3.5" /></button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'branches' && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {branchesLoading ? (
            <div className="card sm:col-span-2 xl:col-span-3"><PageLoader label="Cargando sedes…" /></div>
          ) : (
            (branches ?? []).map((branch) => (
              <div key={branch.id} className={cn('card card-hover p-4', !branch.isActive && 'opacity-70')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Store className="size-5" /></span>
                    <div>
                      <p className="text-[13px] font-bold text-ink">{branch.name}</p>
                      <p className="text-[10.5px] text-muted">Código {branch.code}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {branch.isMain && <Badge tone="amber"><Crown className="size-3" /> Principal</Badge>}
                    <Badge tone={branch.isActive ? 'green' : 'gray'}>{branch.isActive ? 'Activa' : 'Inactiva'}</Badge>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-[11px] text-muted">
                  {branch.address && <p className="flex items-center gap-1.5"><MapPin className="size-3" /> {branch.address}{branch.city ? `, ${branch.city}` : ''}</p>}
                  {branch.phone && <p className="flex items-center gap-1.5"><Phone className="size-3" /> {branch.phone}</p>}
                  <p className="flex items-center gap-1.5"><Users className="size-3" /> {branch.usersCount} usuario{branch.usersCount === 1 ? '' : 's'} asignados</p>
                </div>
                {canManageEmployees && (
                  <div className="mt-3 flex gap-1.5 border-t border-line pt-3">
                    <Button variant="secondary" size="sm" className="flex-1" onClick={() => openEditBranch(branch)}><Pencil className="size-3" /> Editar</Button>
                    {!branch.isMain && <Button variant="danger" size="sm" onClick={() => setDeactivatingBranch(branch)}><Trash2 className="size-3" /></Button>}
                  </div>
                )}
              </div>
            ))
          )}
          {canManageEmployees && (
            <button onClick={openCreateBranch} className="flex min-h-[170px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-brand-200 bg-brand-50/40 text-brand-600 hover:bg-brand-50">
              <span className="flex size-10 items-center justify-center rounded-xl bg-white"><Plus className="size-5" /></span>
              <span className="text-[12px] font-semibold">Agregar sede</span>
            </button>
          )}
        </div>
      )}

      {tab === 'plan' && (
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Tu plan actual</p>
                <p className="font-display text-[22px] font-extrabold text-ink">{plan?.plan ?? session?.tenant.plan}</p>
              </div>
              <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-800 text-white"><Crown className="size-5" /></span>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-[11.5px]"><span className="text-muted">Usuarios</span><span className="font-semibold text-ink">{usage?.users ?? 0} / {plan?.userLimit ?? '—'}</span></div>
                <ProgressBar value={plan?.userLimit ? ((usage?.users ?? 0) / plan.userLimit) * 100 : 0} />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-[11.5px]"><span className="text-muted">Sedes</span><span className="font-semibold text-ink">{usage?.branches ?? 0} / {plan?.branchLimit ?? '—'}</span></div>
                <ProgressBar value={plan?.branchLimit ? ((usage?.branches ?? 0) / plan.branchLimit) * 100 : 0} tone="green" />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-[11.5px]"><span className="text-muted">Productos</span><span className="font-semibold text-ink">{usage?.products ?? 0} / {plan?.productLimit ?? '—'}</span></div>
                <ProgressBar value={plan?.productLimit ? ((usage?.products ?? 0) / plan.productLimit) * 100 : 0} tone="amber" />
              </div>
            </div>
            <div className="mt-4 rounded-xl bg-brand-50/60 p-3 text-[11px] text-muted">
              Tu información está aislada por negocio. Otros negocios en NexComerce nunca pueden ver tus datos.
            </div>
          </div>

          <div className="card p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Actividad del negocio</p>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-canvas p-3"><p className="font-display text-[18px] font-bold text-ink">{usage?.customers ?? 0}</p><p className="text-[10px] text-muted">Clientes</p></div>
              <div className="rounded-xl bg-canvas p-3"><p className="font-display text-[18px] font-bold text-ink">{usage?.salesThisMonth ?? 0}</p><p className="text-[10px] text-muted">Ventas del mes</p></div>
              <div className="rounded-xl bg-canvas p-3"><p className="font-display text-[18px] font-bold text-ink">{usage?.products ?? 0}</p><p className="text-[10px] text-muted">Productos</p></div>
              <div className="rounded-xl bg-canvas p-3"><p className="font-display text-[18px] font-bold text-ink">{usage?.whatsAppMessagesThisMonth ?? 0}</p><p className="text-[10px] text-muted">Mensajes WhatsApp</p></div>
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <p className="text-[11px] leading-relaxed text-emerald-800">Tu cuenta está protegida con cifrado de credenciales y control de acceso por permisos.</p>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={userOpen}
        onClose={() => setUserOpen(false)}
        title={editingUser ? 'Editar usuario' : 'Nuevo usuario'}
        subtitle={editingUser ? 'Ajusta el rol, la sede y los permisos.' : 'Crea credenciales para un miembro de tu equipo.'}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setUserOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => saveUser.mutate()}
              loading={saveUser.isPending}
              disabled={!userForm.fullName.trim() || (!editingUser && (!userForm.email.trim() || userForm.password.length < 8))}
            >
              {editingUser ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre completo" required>
            <Input value={userForm.fullName} onChange={(event) => setUserForm((current) => ({ ...current, fullName: event.target.value }))} />
          </Field>
          <Field label="Teléfono">
            <Input value={userForm.phone} onChange={(event) => setUserForm((current) => ({ ...current, phone: event.target.value }))} />
          </Field>
          {!editingUser && (
            <>
              <Field label="Correo" required>
                <Input type="email" value={userForm.email} onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))} />
              </Field>
              <Field label="Contraseña" required hint="Mínimo 8 caracteres.">
                <Input type="text" value={userForm.password} onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))} placeholder="Temporal para el empleado" />
              </Field>
            </>
          )}
          <Field label="Rol">
            <Select value={userForm.role} onChange={(event) => setUserForm((current) => ({ ...current, role: event.target.value }))} disabled={editingUser?.role === 'Owner'}>
              {(roles ?? []).map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </Select>
          </Field>
          <Field label="Sede">
            <Select value={userForm.branchId} onChange={(event) => setUserForm((current) => ({ ...current, branchId: event.target.value }))}>
              <option value="">Todas las sedes</option>
              {(branches ?? []).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </Select>
          </Field>

          <div className="sm:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <p className="label mb-0">Permisos</p>
              <button
                type="button"
                onClick={() => setUserForm((current) => ({ ...current, permissions: current.permissions.length === (permissions?.length ?? 0) ? [] : (permissions ?? []).map((permission) => permission.key) }))}
                className="text-[10.5px] font-semibold text-brand-600 hover:underline"
              >
                {userForm.permissions.length === (permissions?.length ?? 0) ? 'Quitar todos' : 'Seleccionar todos'}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {Object.entries(groupedPermissions).map(([group, items]) => (
                <div key={group} className="rounded-xl border border-line p-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted">{group}</p>
                  <div className="space-y-1.5">
                    {items.map((permission) => (
                      <label key={permission.key} className="flex cursor-pointer items-center gap-2 text-[11.5px] text-ink">
                        <button
                          type="button"
                          onClick={() => togglePermission(permission.key)}
                          className={cn(
                            'flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
                            userForm.permissions.includes(permission.key) ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white',
                          )}
                          aria-pressed={userForm.permissions.includes(permission.key)}
                        >
                          {userForm.permissions.includes(permission.key) && <CheckCircle2 className="size-3" />}
                        </button>
                        <span onClick={() => togglePermission(permission.key)}>{permission.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {editingUser && (
            <div className="sm:col-span-2">
              <Toggle checked={userForm.isActive} onChange={(value) => setUserForm((current) => ({ ...current, isActive: value }))} label="Usuario activo" description="Puede iniciar sesión y operar en el negocio." />
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={branchOpen}
        onClose={() => setBranchOpen(false)}
        title={editingBranch ? 'Editar sede' : 'Nueva sede'}
        subtitle="Las sedes te permiten separar inventario, ventas y equipos."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setBranchOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveBranch.mutate()} loading={saveBranch.isPending} disabled={!branchForm.name.trim() || !branchForm.code.trim()}>Guardar sede</Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre de la sede" required>
            <Input value={branchForm.name} onChange={(event) => setBranchForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ej. Sede Centro" />
          </Field>
          <Field label="Código" required hint="Único, en mayúsculas.">
            <Input value={branchForm.code} onChange={(event) => setBranchForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="CENTRO" />
          </Field>
          <Field label="Dirección">
            <Input value={branchForm.address} onChange={(event) => setBranchForm((current) => ({ ...current, address: event.target.value }))} />
          </Field>
          <Field label="Ciudad">
            <Input value={branchForm.city} onChange={(event) => setBranchForm((current) => ({ ...current, city: event.target.value }))} />
          </Field>
          <Field label="Teléfono">
            <Input value={branchForm.phone} onChange={(event) => setBranchForm((current) => ({ ...current, phone: event.target.value }))} />
          </Field>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 text-[11.5px] text-ink">
              <input type="checkbox" checked={branchForm.isMain} onChange={(event) => setBranchForm((current) => ({ ...current, isMain: event.target.checked }))} className="size-4 accent-brand-600" />
              Marcar como sede principal
            </label>
            <label className="flex items-center gap-2 text-[11.5px] text-ink">
              <input type="checkbox" checked={branchForm.isActive} onChange={(event) => setBranchForm((current) => ({ ...current, isActive: event.target.checked }))} className="size-4 accent-brand-600" />
              Sede activa
            </label>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deactivating !== null}
        onClose={() => setDeactivating(null)}
        onConfirm={() => deactivating && deactivateUser.mutate(deactivating.id)}
        title="Desactivar usuario"
        message={`"${deactivating?.fullName ?? ''}" ya no podrá iniciar sesión. Su historial de operaciones se conserva.`}
        confirmLabel="Desactivar"
        loading={deactivateUser.isPending}
      />

      <ConfirmDialog
        open={deactivatingBranch !== null}
        onClose={() => setDeactivatingBranch(null)}
        onConfirm={() => deactivatingBranch && deactivateBranch.mutate(deactivatingBranch.id)}
        title="Desactivar sede"
        message={`La sede "${deactivatingBranch?.name ?? ''}" dejará de estar disponible para operar.`}
        confirmLabel="Desactivar"
        loading={deactivateBranch.isPending}
      />

      <div className="mt-4 flex items-center gap-2 text-[11px] text-muted lg:hidden">
        <UserCog className="size-3.5" /> Gestiona roles y permisos desde tu equipo.
        <Mail className="ml-auto size-3.5" />
      </div>
    </div>
  )
}
