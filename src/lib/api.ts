/**
 * Lightweight API client for CRM endpoints
 * Centralises fetch logic, error handling, and avoids duplication.
 * Automatically adds dealershipIds to all requests.
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
  channelFacts: Record<string, { contracts: number; issued: number }>
  fact: {
    contracts: number
    issued: number
    planContracts: number
    planIssued: number
    planJ: number
    planO: number
    planK: number
    planKr: number
    planTi: number
  }
}

// Global dealership IDs — set from auth store
let globalDealershipIds: number[] = []

export function setDealershipIds(ids: number[]) {
  globalDealershipIds = ids
}

function getDealershipParam(): string {
  if (globalDealershipIds.length === 0) return ''
  return `dealershipIds=${globalDealershipIds.join(',')}`
}

function buildUrl(path: string, params?: Record<string, string | undefined>): string {
  const allParams: Record<string, string> = {}
  const dp = getDealershipParam()
  if (dp) allParams.dealershipIds = globalDealershipIds.join(',')
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') allParams[k] = v
    }
  }
  const qs = new URLSearchParams(allParams).toString()
  return `${path}${qs ? `?${qs}` : ''}`
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
    return handle<{ deals: Deal[] }>(fetch(buildUrl('/api/deals', {
      status: params?.status,
      model: params?.model,
      seller: params?.seller,
      search: params?.search,
    })))
  },

  createDeal: (data: Partial<Deal>) =>
    handle<{ deal: Deal }>(fetch('/api/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, dealershipIds: globalDealershipIds }),
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
      body: JSON.stringify({ action, ids, dealershipIds: globalDealershipIds }),
    })),

  importDeals: (deals: Record<string, unknown>[], mode: 'append' | 'replace' = 'append') =>
    handle<{ ok: boolean; imported: number }>(fetch('/api/deals/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deals, mode, dealershipIds: globalDealershipIds }),
    })),

  // ============================
  // Select Options
  // ============================
  listOptions: (dict?: string) => {
    return handle<Record<string, string[]> | { values: string[] }>(fetch(buildUrl('/api/options', { dict })))
  },

  addOption: (dict: string, value: string) =>
    handle<{ option: { id: number; dictName: string; value: string } }>(fetch('/api/options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dict, value, dealershipIds: globalDealershipIds }),
    })),

  removeOption: (dict: string, value: string) =>
    handle<{ ok: boolean }>(fetch(buildUrl('/api/options', { dict, value }), { method: 'DELETE' })),

  // ============================
  // Columns
  // ============================
  listColumns: () =>
    handle<{ columns: DealColumn[] }>(fetch(buildUrl('/api/columns'))),

  createColumn: (data: { key: string; label: string; type?: string; options?: string | null; default?: string; width?: number; insertAfter?: string }) =>
    handle<{ column: DealColumn }>(fetch('/api/columns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, dealershipIds: globalDealershipIds }),
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
    handle<{ channels: Channel[] }>(fetch(buildUrl('/api/channels'))),

  createChannel: (data: Partial<Channel>) =>
    handle<{ channel: Channel }>(fetch('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, dealershipIds: globalDealershipIds }),
    })),

  updateChannel: (id: number, updates: Partial<Channel>) =>
    handle<{ channel: Channel }>(fetch(`/api/channels/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updates, dealershipIds: globalDealershipIds }),
    })),

  deleteChannel: (id: number) =>
    handle<{ ok: boolean }>(fetch(`/api/channels/${id}`, { method: 'DELETE' })),

  // ============================
  // Traffic
  // ============================
  getTraffic: (month: string) =>
    handle<TrafficResponse>(fetch(buildUrl('/api/traffic', { month }))),

  updateTrafficCell: (data: { monthKey: string; model: string; type: 'callsAndApps' | 'visits'; day: number; value: number }) =>
    handle<{ entry: unknown }>(fetch('/api/traffic', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, dealershipIds: globalDealershipIds }),
    })),

  // ============================
  // Today Plans
  // ============================
  updateTodayPlan: (data: { monthKey: string; day: number; meetings?: number; contracts?: number }) =>
    handle<{ plan: unknown }>(fetch('/api/today-plans', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, dealershipIds: globalDealershipIds }),
    })),

  // ============================
  // Cell Comments
  // ============================
  listComments: () =>
    handle<{ comments: Record<string, string> }>(fetch(buildUrl('/api/cell-comments'))),

  saveComment: (data: { table: 'calls' | 'visits'; day: number; model: string; text: string }) =>
    handle<{ comment: CellComment }>(fetch('/api/cell-comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, dealershipIds: globalDealershipIds }),
    })),

  deleteComment: (table: 'calls' | 'visits', day: number, model: string) =>
    handle<{ ok: boolean }>(fetch(buildUrl('/api/cell-comments', { table, day: String(day), model }), { method: 'DELETE' })),

  // ============================
  // Evaluation Links
  // ============================
  listEvalLinks: () =>
    handle<{ links: Record<string, string> }>(fetch(buildUrl('/api/evaluation-links'))),

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
    handle<PlanFactResponse>(fetch(buildUrl('/api/plan-fact', { month }))),

  updatePlanDay: (data: { monthKey: string; channel: string; day: number; leads: number }) =>
    handle<{ entry: unknown }>(fetch('/api/plan-fact', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, dealershipIds: globalDealershipIds }),
    })),

  updatePlanChannelParam: (data: { monthKey: string; channel: string; budget?: number; cpl?: number; rl?: number; sr?: number }) =>
    handle<{ ok: boolean }>(fetch('/api/plan-fact', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, dealershipIds: globalDealershipIds }),
    })),

  updateChannelFact: (data: { monthKey: string; channel: string; channelFactContracts?: number; channelFactIssued?: number }) =>
    handle<{ channelFact: unknown }>(fetch('/api/plan-fact', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, dealershipIds: globalDealershipIds }),
    })),

  updateFact: (monthKey: string, data: {
    contracts?: number; issued?: number;
    planContracts?: number; planIssued?: number;
    planJ?: number; planO?: number; planK?: number;
    planKr?: number; planTi?: number;
  }) =>
    handle<{ fact: unknown }>(fetch('/api/plan-fact', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthKey, ...data, dealershipIds: globalDealershipIds }),
    })),

  getSkladMonthFact: (month: string) =>
    handle<{ contracts: number; issued: number; j: number; o: number; k: number; jok: number; kr: number; ti: number }>(fetch(buildUrl('/api/sklad-month-fact', { month }))),

  // ============================
  // History
  // ============================
  listHistory: (limit = 500) =>
    handle<{ history: ChangeHistoryEntry[] }>(fetch(buildUrl('/api/history', { limit: String(limit) }))),

  clearHistory: () =>
    handle<{ ok: boolean }>(fetch('/api/history', { method: 'DELETE' })),

  // ============================
  // Stats
  // ============================
  getStats: () => handle<Stats>(fetch(buildUrl('/api/stats'))),

  // ============================
  // Backup
  // ============================
  downloadBackup: () => fetch(buildUrl('/api/backup')),
  restoreBackup: (data: unknown) =>
    handle<{ ok: boolean }>(fetch('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })),
}
