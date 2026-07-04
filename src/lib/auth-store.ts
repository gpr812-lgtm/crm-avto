/**
 * Auth store — current user, login/logout, dealership selection
 */
import { create } from 'zustand'

export interface UserDealership {
  id: number
  name: string
  code: string | null
}

export interface CurrentUser {
  id: number
  email: string
  name: string
  role: 'ADMIN' | 'MANAGER'
  dealerships: UserDealership[]
  tabAccess: Record<string, boolean>
}

interface AuthState {
  user: CurrentUser | null
  loading: boolean
  selectedDealershipIds: Set<number>
  loadUser: () => Promise<void>
  login: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  toggleDealership: (id: number) => void
  selectAllDealerships: () => void
  selectSingleDealership: (id: number) => void
  hasTabAccess: (tabKey: string) => boolean
}

const ALL_TABS = ['sklad', 'traffic', 'planfact', 'analytics', 'calendar', 'history', 'settings']

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  selectedDealershipIds: new Set(),

  loadUser: async () => {
    try {
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      if (data.user) {
        const allIds = new Set(data.user.dealerships.map((d: UserDealership) => d.id))
        set({ user: data.user, loading: false, selectedDealershipIds: allIds })
      } else {
        set({ user: null, loading: false })
      }
    } catch {
      set({ user: null, loading: false })
    }
  },

  login: async (email, password) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Ошибка входа')
      }
      const data = await res.json()
      const allIds = new Set(data.user.dealerships.map((d: UserDealership) => d.id))
      set({ user: data.user, selectedDealershipIds: allIds })
      return true
    } catch (e) {
      console.error('Login failed:', e)
      return false
    }
  },

  logout: async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    set({ user: null, selectedDealershipIds: new Set() })
    window.location.href = '/login'
  },

  toggleDealership: (id) => {
    set((s) => {
      const next = new Set(s.selectedDealershipIds)
      if (next.has(id)) {
        if (next.size > 1) next.delete(id) // don't allow empty selection
      } else {
        next.add(id)
      }
      return { selectedDealershipIds: next }
    })
  },

  selectAllDealerships: () => {
    const { user } = get()
    if (!user) return
    set({ selectedDealershipIds: new Set(user.dealerships.map((d) => d.id)) })
  },

  selectSingleDealership: (id) => {
    set({ selectedDealershipIds: new Set([id]) })
  },

  hasTabAccess: (tabKey) => {
    const { user } = get()
    if (!user) return false
    if (user.role === 'ADMIN') return true
    return user.tabAccess[tabKey] !== false
  },
}))
