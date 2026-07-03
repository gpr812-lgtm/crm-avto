/**
 * Lightweight API client for CRM endpoints
 * Centralises fetch logic, error handling, and avoids duplication.
 */
import type {
  Deal,
  DealColumn,
  Channel,
  CellComment,
  ChangeHistoryEntry,
  Stats,
} from './types'

export interface TrafficResponse {
  month: string
  models: Record<string, {
    callsAndApps: Record<number, number>
    visits: Record<number, number>
  }>
  plans: Record<number, { meetings: number; contracts: number }>
  comments: CellComment[]
}

export interface PlanFactResponse {
  channels: Channel[]
  plan: Record<string, {
    days: Record<number, number>
    budget: number
    cpl: number
    rl: number
    sr: number
  }>
  fact: { contracts: number; issued: number }
}

async function handle<T>(promise: Promise<Response>): Promise<T> {
  const res = await promise
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  // ============================
  // Deals
  // ============================
  listDeals: (params?: { status?: string; model?: string; seller?: string; search?: string }) => {
    const q = new URLSearchParams()
    if (params?.status) q.set('status', params.status)
    if (params?.model) q.set('model', params.model)
    if (params?.seller) q.set('seller', params.seller)
    if (params?.search) q.set('search', params.search)
    const qs = q.toString()
    return handle<{ deals: Deal[] }>(fetch(`/api/deals${qs ? `?${qs}` : ''}`))
  },

  createDeal: (data: Partial<Deal>) =>
    handle<{ deal: Deal }>(fetch('/api/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })),

  updateDeal: (id: string, data: Partial<Deal>) =>
    handle<{ deal: Deal }>(fetch(`/api/deals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })),

  deleteDeal: (id: string) =>
    handle<{ ok: boolean }>(fetch(`/api/deals/${id}`, { method: 'DELETE' })),

  bulkDealAction: (action: 'delete' | 'duplicate', ids: string[]) =>
    handle<{ ok: boolean }>(fetch('/api/deals/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ids }),
    })),

  importDeals: (deals: Record<string, unknown>[], mode: 'append' | 'replace' = 'append') =>
    handle<{ ok: boolean; imported: number }>(fetch('/api/deals/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deals, mode }),
    })),

  // ============================
  // Select Options
  // ============================
  listOptions: (dict?: string) => {
    const q = dict ? `?dict=${encodeURIComponent(dict)}` : ''
    return handle<Record<string, string[]> | { values: string[] }>(fetch(`/api/options${q}`))
  },

  addOption: (dict: string, value: string) =>
    handle<{ option: { id: number; dictName: string; value: string } }>(fetch('/api/options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dict, value }),
    })),

  removeOption: (dict: string, value: string) =>
    handle<{ ok: boolean }>(fetch(`/api/options?dict=${encodeURIComponent(dict)}&value=${encodeURIComponent(value)}`, { method: 'DELETE' })),

  // ============================
  // Columns
  // ============================
  listColumns: () =>
    handle<{ columns: DealColumn[] }>(fetch('/api/columns')),

  createColumn: (data: { key: string; label: string; type?: string; options?: string | null; default?: string; width?: number; insertAfter?: string }) =>
    handle<{ column: DealColumn }>(fetch('/api/columns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })),

  updateColumn: (id: number, updates: Partial<DealColumn>) =>
    handle<{ column: DealColumn }>(fetch('/api/columns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    })),

  updateColumnById: (id: number, updates: Partial<DealColumn>) =>
    handle<{ column: DealColumn }>(fetch(`/api/columns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })),

  deleteColumn: (id: number) =>
    handle<{ ok: boolean }>(fetch(`/api/columns/${id}`, { method: 'DELETE' })),

  // ============================
  // Channels
  // ============================
  listChannels: () =>
    handle<{ channels: Channel[] }>(fetch('/api/channels')),

  createChannel: (data: Partial<Channel>) =>
    handle<{ channel: Channel }>(fetch('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })),

  updateChannel: (id: number, updates: Partial<Channel>) =>
    handle<{ channel: Channel }>(fetch(`/api/channels/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })),

  deleteChannel: (id: number) =>
    handle<{ ok: boolean }>(fetch(`/api/channels/${id}`, { method: 'DELETE' })),

  // ============================
  // Traffic
  // ============================
  getTraffic: (month: string) =>
    handle<TrafficResponse>(fetch(`/api/traffic?month=${encodeURIComponent(month)}`)),

  updateTrafficCell: (data: { monthKey: string; model: string; type: 'callsAndApps' | 'visits'; day: number; value: number }) =>
    handle<{ entry: unknown }>(fetch('/api/traffic', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })),

  // ============================
  // Today Plans
  // ============================
  updateTodayPlan: (data: { monthKey: string; day: number; meetings?: number; contracts?: number }) =>
    handle<{ plan: unknown }>(fetch('/api/today-plans', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })),

  // ============================
  // Cell Comments
  // ============================
  listComments: () =>
    handle<{ comments: Record<string, string> }>(fetch('/api/cell-comments')),

  saveComment: (data: { table: 'calls' | 'visits'; day: number; model: string; text: string }) =>
    handle<{ comment: CellComment }>(fetch('/api/cell-comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })),

  deleteComment: (table: 'calls' | 'visits', day: number, model: string) =>
    handle<{ ok: boolean }>(fetch(`/api/cell-comments?table=${table}&day=${day}&model=${encodeURIComponent(model)}`, { method: 'DELETE' })),

  // ============================
  // Evaluation Links
  // ============================
  listEvalLinks: () =>
    handle<{ links: Record<string, string> }>(fetch('/api/evaluation-links')),

  saveEvalLink: (dealId: string, url: string) =>
    handle<{ link: { dealId: string; url: string } }>(fetch('/api/evaluation-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId, url }),
    })),

  deleteEvalLink: (dealId: string) =>
    handle<{ ok: boolean }>(fetch(`/api/evaluation-links?dealId=${dealId}`, { method: 'DELETE' })),

  // ============================
  // Plan/Fact
  // ============================
  getPlanFact: (month: string) =>
    handle<PlanFactResponse>(fetch(`/api/plan-fact?month=${encodeURIComponent(month)}`)),

  updatePlanDay: (data: { monthKey: string; channel: string; day: number; leads: number }) =>
    handle<{ entry: unknown }>(fetch('/api/plan-fact', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })),

  updatePlanChannelParam: (data: { monthKey: string; channel: string; budget?: number; cpl?: number; rl?: number; sr?: number }) =>
    handle<{ ok: boolean }>(fetch('/api/plan-fact', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })),

  updateFact: (monthKey: string, data: { contracts?: number; issued?: number }) =>
    handle<{ fact: { monthKey: string; contracts: number; issued: number } }>(fetch('/api/plan-fact', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthKey, ...data }),
    })),

  // ============================
  // History
  // ============================
  listHistory: (limit = 500) =>
    handle<{ history: ChangeHistoryEntry[] }>(fetch(`/api/history?limit=${limit}`)),

  clearHistory: () =>
    handle<{ ok: boolean }>(fetch('/api/history', { method: 'DELETE' })),

  // ============================
  // Stats
  // ============================
  getStats: () => handle<Stats>(fetch('/api/stats')),

  // ============================
  // Backup
  // ============================
  downloadBackup: () => fetch('/api/backup'),
  restoreBackup: (data: unknown) =>
    handle<{ ok: boolean }>(fetch('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })),
}
