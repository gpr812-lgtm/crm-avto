/**
 * CRM Types — shared between client and server
 */

export type DealStatus = 'Продан' | 'Склад' | 'Отказ'

export interface Deal {
  id: string
  model: string
  status: DealStatus | string
  dateDkp: string | null
  dateIssued: string | null
  seller: string | null
  client: string | null
  jok: number
  j: number
  o: number
  k: number
  risk: string
  kr: string
  ti: string
  review: string
  traffic: string
  comment: string | null
  order: number
  createdAt: string
  updatedAt: string
  evaluationLink?: { dealId: string; url: string } | null
}

export interface DealColumn {
  id: number
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'url' | 'select'
  options: string | null
  default: string | null
  width: number
  order: number
}

export interface Channel {
  id: number
  name: string
  group: string
  budget: number
  cpl: number
  rl: number
  sr: number
  order: number
}

export interface TrafficEntry {
  monthKey: string
  model: string
  type: 'callsAndApps' | 'visits'
  day: number
  value: number
}

export interface CellComment {
  table: 'calls' | 'visits'
  day: number
  model: string
  text: string
}

export interface ChangeHistoryEntry {
  id: number
  type: 'add' | 'edit' | 'delete' | 'bulk'
  description: string
  createdAt: string
}

export interface Stats {
  total: number
  sold: number
  inStock: number
  refused: number
  ghost: number
  sumJok: number
  sumK: number
  tiCount: number
  krCount: number
}

export type TabKey = 'sklad' | 'traffic' | 'planfact' | 'analytics' | 'calendar' | 'history' | 'settings'
