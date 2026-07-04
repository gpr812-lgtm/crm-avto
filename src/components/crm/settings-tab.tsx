'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Building2, Users, Plus, Trash2, Check, X, Lock, Shield,
} from 'lucide-react'
import { toast } from 'sonner'

const ALL_TABS = [
  { key: 'sklad', label: 'Склад' },
  { key: 'traffic', label: 'Трафик' },
  { key: 'planfact', label: 'План/Факт' },
  { key: 'analytics', label: 'Аналитика' },
  { key: 'calendar', label: 'Календарь' },
  { key: 'history', label: 'История' },
  { key: 'settings', label: 'Настройки' },
]

interface Dealership { id: number; name: string; code: string | null }
interface UserItem {
  id: number; email: string; name: string; role: string; active: boolean
  dealershipAccess: { dealership: Dealership }[]
  tabAccess: { tabKey: string; allowed: boolean }[]
}

export function SettingsTab() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN'

  const [dealerships, setDealerships] = useState<Dealership[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [activeSection, setActiveSection] = useState<'dealerships' | 'users'>('dealerships')
  const [newDealerName, setNewDealerName] = useState('')
  const [newDealerCode, setNewDealerCode] = useState('')
  const [userDialog, setUserDialog] = useState<{ mode: 'create' | 'edit' | 'access'; user?: UserItem } | null>(null)

  const loadData = async () => {
    const [dRes, uRes] = await Promise.all([
      fetch('/api/dealerships'),
      isAdmin ? fetch('/api/users') : Promise.resolve(null),
    ])
    const dData = await dRes.json()
    setDealerships(dData.dealerships || [])
    if (uRes) {
      const uData = await uRes.json()
      setUsers(uData.users || [])
    }
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/dealerships'),
      isAdmin ? fetch('/api/users') : Promise.resolve(null),
    ]).then(async ([dRes, uRes]) => {
      if (cancelled) return
      const dData = await dRes.json()
      setDealerships(dData.dealerships || [])
      if (uRes) {
        const uData = await uRes.json()
        setUsers(uData.users || [])
      }
    })
    return () => { cancelled = true }
  }, [isAdmin])

  const handleCreateDealership = async () => {
    if (!newDealerName.trim()) {
      toast.warning('Введите название автосалона')
      return
    }
    const res = await fetch('/api/dealerships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newDealerName.trim(), code: newDealerCode.trim() || null }),
    })
    if (res.ok) {
      toast.success(`Автосалон "${newDealerName}" создан`)
      setNewDealerName('')
      setNewDealerCode('')
      loadData()
    } else {
      toast.error('Не удалось создать автосалон')
    }
  }

  if (!isAdmin) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <Lock className="w-12 h-12 mx-auto mb-3 text-[hsl(215,16%,60%)]" />
          <h2 className="text-lg font-semibold mb-2">Доступ ограничен</h2>
          <p className="text-sm text-[hsl(215,16%,47%)]">
            Настройки доступны только администраторам.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto crm-scroll p-3 space-y-3">
      {/* Section tabs */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={activeSection === 'dealerships' ? 'default' : 'outline'}
          onClick={() => setActiveSection('dealerships')}
          className="h-8"
        >
          <Building2 className="w-3.5 h-3.5 mr-1" /> Автосалоны
        </Button>
        <Button
          size="sm"
          variant={activeSection === 'users' ? 'default' : 'outline'}
          onClick={() => setActiveSection('users')}
          className="h-8"
        >
          <Users className="w-3.5 h-3.5 mr-1" /> Пользователи
        </Button>
      </div>

      {/* Dealerships section */}
      {activeSection === 'dealerships' && (
        <Card className="p-4 space-y-3">
          <div className="text-sm font-semibold">Создать автосалон</div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-[10px]">Название</Label>
              <Input value={newDealerName} onChange={(e) => setNewDealerName(e.target.value)} placeholder="Например: Tenet Центр" className="h-8 text-xs" />
            </div>
            <div className="w-40">
              <Label className="text-[10px]">Код (необязательно)</Label>
              <Input value={newDealerCode} onChange={(e) => setNewDealerCode(e.target.value)} placeholder="TENET-Ц" className="h-8 text-xs" />
            </div>
            <Button size="sm" onClick={handleCreateDealership} className="h-8">
              <Plus className="w-3.5 h-3.5 mr-1" /> Добавить
            </Button>
          </div>

          <div className="border-t pt-3">
            <div className="text-sm font-semibold mb-2">Существующие автосалоны ({dealerships.length})</div>
            <div className="space-y-1">
              {dealerships.map((d) => (
                <div key={d.id} className="flex items-center gap-2 px-3 py-2 rounded border border-[hsl(220,16%,90%)] hover:bg-[hsl(220,20%,98%)]">
                  <Building2 className="w-4 h-4 text-[hsl(221,60%,38%)]" />
                  <div className="flex-1">
                    <div className="text-xs font-medium">{d.name}</div>
                    {d.code && <div className="text-[10px] text-[hsl(215,16%,60%)]">{d.code}</div>}
                  </div>
                  <Badge variant="outline" className="text-[10px]">ID: {d.id}</Badge>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Users section */}
      {activeSection === 'users' && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Пользователи ({users.length})</div>
            <Button size="sm" onClick={() => setUserDialog({ mode: 'create' })}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Добавить
            </Button>
          </div>

          <div className="space-y-1">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-2 px-3 py-2 rounded border border-[hsl(220,16%,90%)] hover:bg-[hsl(220,20%,98%)]">
                <div className="flex-1">
                  <div className="text-xs font-medium flex items-center gap-2">
                    {u.name}
                    {u.role === 'ADMIN' && <Shield className="w-3 h-3 text-[hsl(221,60%,38%)]" />}
                    {!u.active && <Badge variant="destructive" className="text-[9px]">неактивен</Badge>}
                  </div>
                  <div className="text-[10px] text-[hsl(215,16%,60%)]">{u.email}</div>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {u.role === 'ADMIN' ? 'Админ' : 'Менеджер'}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {u.dealershipAccess.length} салон(ов)
                </Badge>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setUserDialog({ mode: 'access', user: u })}>
                  Доступ
                </Button>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setUserDialog({ mode: 'edit', user: u })}>
                  Изменить
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* User dialog */}
      {userDialog && (
        <UserDialog
          state={userDialog}
          dealerships={dealerships}
          onClose={() => setUserDialog(null)}
          onSaved={loadData}
        />
      )}
    </div>
  )
}

function UserDialog({
  state, dealerships, onClose, onSaved,
}: {
  state: { mode: 'create' | 'edit' | 'access'; user?: UserItem }
  dealerships: Dealership[]
  onClose: () => void
  onSaved: () => void
}) {
  const isCreate = state.mode === 'create'
  const isAccess = state.mode === 'access'
  const u = state.user

  const [email, setEmail] = useState(u?.email || '')
  const [name, setName] = useState(u?.name || '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(u?.role || 'MANAGER')
  const [active, setActive] = useState(u?.active ?? true)
  const [dealershipIds, setDealershipIds] = useState<Set<number>>(
    new Set(u?.dealershipAccess.map((a) => a.dealership.id) || [])
  )
  const [tabAccess, setTabAccess] = useState<Record<string, boolean>>(() => {
    const out: Record<string, boolean> = {}
    for (const t of ALL_TABS) {
      const existing = u?.tabAccess.find((ta) => ta.tabKey === t.key)
      out[t.key] = existing ? existing.allowed : true
    }
    return out
  })

  const toggleDealership = (id: number) => {
    setDealershipIds((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSave = async () => {
    try {
      if (isCreate) {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email, name, password, role,
            dealershipIds: Array.from(dealershipIds),
            tabAccess,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error)
        }
        toast.success('Пользователь создан')
      } else if (isAccess && u) {
        await fetch(`/api/users/${u.id}/access`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dealershipIds: Array.from(dealershipIds),
            tabAccess,
          }),
        })
        toast.success('Доступ обновлён')
      } else if (u) {
        await fetch(`/api/users/${u.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, role, active, ...(password ? { password } : {}) }),
        })
        toast.success('Пользователь обновлён')
      }
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка')
    }
  }

  const title = isCreate ? '➕ Новый пользователь' : isAccess ? '🔐 Доступ пользователя' : '✏️ Редактировать'

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {(isCreate || (!isAccess && u)) && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">Имя</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-xs" disabled={isAccess} />
                </div>
                <div>
                  <Label className="text-[10px]">Email</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} className="h-8 text-xs" disabled={!isCreate} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">Пароль {isCreate ? '' : '(оставьте пустым = без изменений)'}</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px]">Роль</Label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full h-8 px-2 text-xs border border-[hsl(220,16%,90%)] rounded"
                    disabled={isAccess}
                  >
                    <option value="MANAGER">Менеджер</option>
                    <option value="ADMIN">Администратор</option>
                  </select>
                </div>
              </div>
              {!isCreate && (
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} id="active" />
                  <Label htmlFor="active" className="text-xs cursor-pointer">Активен</Label>
                </div>
              )}
            </>
          )}

          {(isCreate || isAccess) && (
            <>
              <div className="border-t pt-3">
                <div className="text-xs font-semibold mb-2">Доступ к автосалонам</div>
                <div className="space-y-1 max-h-40 overflow-y-auto crm-scroll">
                  {dealerships.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => toggleDealership(d.id)}
                      className="w-full text-left px-2 py-1.5 rounded border border-[hsl(220,16%,90%)] hover:bg-[hsl(220,20%,98%)] flex items-center justify-between"
                    >
                      <span className="text-xs">{d.name}</span>
                      {dealershipIds.has(d.id) && <Check className="w-3.5 h-3.5 text-[hsl(142,60%,35%)]" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t pt-3">
                <div className="text-xs font-semibold mb-2">Доступ к вкладкам</div>
                <div className="grid grid-cols-2 gap-1">
                  {ALL_TABS.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setTabAccess((s) => ({ ...s, [t.key]: !s[t.key] }))}
                      className={`px-2 py-1.5 rounded border text-xs flex items-center justify-between ${
                        tabAccess[t.key]
                          ? 'bg-[hsl(142,60%,95%)] border-[hsl(142,50%,70%)] text-[hsl(142,60%,30%)]'
                          : 'bg-[hsl(0,70%,96%)] border-[hsl(0,60%,80%)] text-[hsl(0,70%,40%)]'
                      }`}
                    >
                      <span>{t.label}</span>
                      {tabAccess[t.key] ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSave}>Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
