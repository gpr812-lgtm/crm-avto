/**
 * CRM global client store — centralises UI state for the whole app.
 * Server data is fetched via the api client and cached here.
 */
import { create } from 'zustand'
import type { Deal, DealColumn, Channel, CellComment, ChangeHistoryEntry, Stats, TabKey } from './types'
import { api } from './api'

interface CrmState {
  // UI
  activeTab: TabKey
  setActiveTab: (t: TabKey) => void

  // Loading flags
  loading: Record<string, boolean>
  setLoading: (key: string, v: boolean) => void

  // Deals
  deals: Deal[]
  selectedDealIds: Set<string>
  loadDeals: (params?: { status?: string; model?: string; seller?: string; search?: string }) => Promise<void>
  addDeal: (data: Partial<Deal>) => Promise<Deal>
  editDeal: (id: string, data: Partial<Deal>) => Promise<void>
  removeDeal: (id: string) => Promise<void>
  removeDealsBulk: (ids: string[]) => Promise<void>
  duplicateDealsBulk: (ids: string[]) => Promise<void>
  toggleSelection: (id: string) => void
  selectAll: () => void
  clearSelection: () => void

  // Columns
  columns: DealColumn[]
  loadColumns: () => Promise<void>
  saveColumn: (id: number, updates: Partial<DealColumn>) => Promise<void>
  addColumn: (data: { key: string; label: string; type?: string; options?: string | null; default?: string; width?: number; insertAfter?: string }) => Promise<void>
  removeColumn: (id: number) => Promise<void>

  // Import deals
  importDeals: (rows: Record<string, unknown>[], mode?: 'append' | 'replace') => Promise<number>

  // Options
  options: Record<string, string[]>
  loadOptions: () => Promise<void>
  addOption: (dict: string, value: string) => Promise<void>

  // Channels
  channels: Channel[]
  loadChannels: () => Promise<void>
  addChannel: (data: Partial<Channel>) => Promise<void>
  editChannel: (id: number, updates: Partial<Channel>) => Promise<void>
  removeChannel: (id: number) => Promise<void>

  // Cell comments
  comments: Record<string, string>
  loadComments: () => Promise<void>
  saveComment: (table: 'calls' | 'visits', day: number, model: string, text: string) => Promise<void>
  removeComment: (table: 'calls' | 'visits', day: number, model: string) => Promise<void>

  // Eval links
  evalLinks: Record<string, string>
  loadEvalLinks: () => Promise<void>
  saveEvalLink: (dealId: string, url: string) => Promise<void>
  removeEvalLink: (dealId: string) => Promise<void>

  // History
  history: ChangeHistoryEntry[]
  loadHistory: () => Promise<void>
  clearHistory: () => Promise<void>

  // Stats
  stats: Stats | null
  loadStats: () => Promise<void>
}

export const useCrmStore = create<CrmState>((set, get) => ({
  activeTab: 'sklad',
  setActiveTab: (t) => set({ activeTab: t }),

  loading: {},
  setLoading: (key, v) => set((s) => ({ loading: { ...s.loading, [key]: v } })),

  // ============ Deals ============
  deals: [],
  selectedDealIds: new Set(),

  loadDeals: async (params) => {
    set((s) => ({ loading: { ...s.loading, deals: true } }))
    try {
      const { deals } = await api.listDeals(params)
      set({ deals })
    } finally {
      set((s) => ({ loading: { ...s.loading, deals: false } }))
    }
  },

  addDeal: async (data) => {
    const { deal } = await api.createDeal(data)
    set((s) => ({ deals: [...s.deals, deal] }))
    get().loadStats()
    get().loadHistory()
    return deal
  },

  editDeal: async (id, data) => {
    // Optimistic update
    set((s) => ({
      deals: s.deals.map((d) => (d.id === id ? { ...d, ...data } as Deal : d)),
    }))
    try {
      const { deal } = await api.updateDeal(id, data)
      set((s) => ({
        deals: s.deals.map((d) => (d.id === id ? deal : d)),
      }))
      get().loadHistory()
    } catch (e) {
      // Revert on error
      console.error('editDeal failed:', e)
      await get().loadDeals()
      throw e
    }
  },

  removeDeal: async (id) => {
    set((s) => ({
      deals: s.deals.filter((d) => d.id !== id),
      selectedDealIds: (() => {
        const next = new Set(s.selectedDealIds)
        next.delete(id)
        return next
      })(),
    }))
    await api.deleteDeal(id)
    get().loadStats()
    get().loadHistory()
  },

  removeDealsBulk: async (ids) => {
    set((s) => ({
      deals: s.deals.filter((d) => !ids.includes(d.id)),
      selectedDealIds: new Set(),
    }))
    await api.bulkDealAction('delete', ids)
    get().loadStats()
    get().loadHistory()
  },

  duplicateDealsBulk: async (ids) => {
    await api.bulkDealAction('duplicate', ids)
    await get().loadDeals()
    get().loadStats()
    get().loadHistory()
  },

  toggleSelection: (id) =>
    set((s) => {
      const next = new Set(s.selectedDealIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { selectedDealIds: next }
    }),

  selectAll: () => set((s) => ({ selectedDealIds: new Set(s.deals.map((d) => d.id)) })),
  clearSelection: () => set({ selectedDealIds: new Set() }),

  // ============ Columns ============
  columns: [],
  loadColumns: async () => {
    const { columns } = await api.listColumns()
    set({ columns })
  },
  saveColumn: async (id, updates) => {
    set((s) => ({
      columns: s.columns.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }))
    const { column } = await api.updateColumnById(id, updates)
    set((s) => ({
      columns: s.columns.map((c) => (c.id === id ? column : c)),
    }))
  },
  addColumn: async (data) => {
    const { column } = await api.createColumn(data)
    set((s) => ({ columns: [...s.columns, column].sort((a, b) => a.order - b.order) }))
    get().loadHistory()
  },
  removeColumn: async (id) => {
    set((s) => ({ columns: s.columns.filter((c) => c.id !== id) }))
    await api.deleteColumn(id)
    get().loadHistory()
  },

  // ============ Import deals ============
  importDeals: async (rows, mode = 'append') => {
    const { imported } = await api.importDeals(rows, mode)
    await get().loadDeals()
    get().loadStats()
    get().loadHistory()
    return imported
  },

  // ============ Options ============
  options: {},
  loadOptions: async () => {
    const opts = (await api.listOptions()) as Record<string, string[]>
    set({ options: opts })
  },
  addOption: async (dict, value) => {
    await api.addOption(dict, value)
    set((s) => ({
      options: { ...s.options, [dict]: [...(s.options[dict] ?? []), value] },
    }))
  },

  // ============ Channels ============
  channels: [],
  loadChannels: async () => {
    const { channels } = await api.listChannels()
    set({ channels })
  },
  addChannel: async (data) => {
    const { channel } = await api.createChannel(data)
    set((s) => ({ channels: [...s.channels, channel] }))
    get().loadHistory()
  },
  editChannel: async (id, updates) => {
    set((s) => ({
      channels: s.channels.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }))
    const { channel } = await api.updateChannel(id, updates)
    set((s) => ({
      channels: s.channels.map((c) => (c.id === id ? channel : c)),
    }))
  },
  removeChannel: async (id) => {
    set((s) => ({ channels: s.channels.filter((c) => c.id !== id) }))
    await api.deleteChannel(id)
    get().loadHistory()
  },

  // ============ Cell comments ============
  comments: {},
  loadComments: async () => {
    const { comments } = await api.listComments()
    set({ comments })
  },
  saveComment: async (table, day, model, text) => {
    const key = `${table}_${day}_${model}`
    set((s) => ({ comments: { ...s.comments, [key]: text } }))
    await api.saveComment({ table, day, model, text })
  },
  removeComment: async (table, day, model) => {
    const key = `${table}_${day}_${model}`
    set((s) => {
      const next = { ...s.comments }
      delete next[key]
      return { comments: next }
    })
    await api.deleteComment(table, day, model)
  },

  // ============ Eval links ============
  evalLinks: {},
  loadEvalLinks: async () => {
    const { links } = await api.listEvalLinks()
    set({ evalLinks: links })
  },
  saveEvalLink: async (dealId, url) => {
    set((s) => ({ evalLinks: { ...s.evalLinks, [dealId]: url } }))
    await api.saveEvalLink(dealId, url)
    get().loadHistory()
  },
  removeEvalLink: async (dealId) => {
    set((s) => {
      const next = { ...s.evalLinks }
      delete next[dealId]
      return { evalLinks: next }
    })
    await api.deleteEvalLink(dealId)
    get().loadHistory()
  },

  // ============ History ============
  history: [],
  loadHistory: async () => {
    const { history } = await api.listHistory()
    set({ history })
  },
  clearHistory: async () => {
    await api.clearHistory()
    set({ history: [] })
  },

  // ============ Stats ============
  stats: null,
  loadStats: async () => {
    try {
      const stats = await api.getStats()
      set({ stats })
    } catch (e) {
      console.error('loadStats failed:', e)
    }
  },
}))
