/**
 * Sanitize user input for safe HTML rendering (anti-XSS).
 * Mirrors DOMPurify behaviour for the common cases used in this CRM.
 */
export function escapeHtml(s: unknown): string {
  if (s === null || s === undefined) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Format number using ru-RU locale (e.g. 1 234 567)
 */
export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '0'
  return new Intl.NumberFormat('ru-RU').format(n)
}

/**
 * Format currency-like number with sign coloring.
 */
export function formatSigned(n: number): { text: string; sign: 'positive' | 'negative' | 'neutral' } {
  if (n === 0) return { text: '0', sign: 'neutral' }
  return {
    text: new Intl.NumberFormat('ru-RU').format(n),
    sign: n > 0 ? 'positive' : 'negative',
  }
}

/**
 * Parse a number from a Russian-formatted string like "1 234,56" or "1234.56"
 */
export function parseRuNumber(s: string): number {
  if (!s) return 0
  const cleaned = s
    .toString()
    .replace(/\s+/g, '')
    .replace(/\u00A0/g, '')
    .replace(',', '.')
  const n = parseFloat(cleaned)
  return Number.isNaN(n) ? 0 : n
}

/**
 * Build a YYYY-MM month key from year (number) and month (1-based number).
 */
export function monthKey(year: number, month1Based: number): string {
  return `${year}-${String(month1Based).padStart(2, '0')}`
}

/**
 * Number of days in a given month.
 */
export function daysInMonth(year: number, month1Based: number): number {
  return new Date(year, month1Based, 0).getDate()
}

/**
 * Russian day name abbreviations (Mon-Sun, with Monday first).
 */
export const DAY_NAMES_MON_FIRST = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

/**
 * Get the Russian day-of-week name for a specific date (Sun-Sat).
 */
export function dayName(year: number, month1Based: number, day: number): string {
  const d = new Date(year, month1Based - 1, day)
  return ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][d.getDay()]
}

/**
 * Validate URL — must be http(s)://, otherwise prepend https://
 * Returns null if input is empty.
 */
export function normalizeUrl(input: string): string | null {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^javascript:/i.test(trimmed)) return null // block XSS vector
  return `https://${trimmed}`
}

/**
 * Add a history entry (server-side).
 */
export async function addHistory(type: 'add' | 'edit' | 'delete' | 'bulk', description: string) {
  try {
    const { db } = await import('@/lib/db')
    await db.changeHistory.create({ data: { type, description } })
  } catch (e) {
    console.error('Failed to add history entry:', e)
  }
}

/**
 * Pagination helper.
 */
export function paginate<T>(arr: T[], page: number, pageSize: number): { data: T[]; total: number; pages: number } {
  const total = arr.length
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, page), pages)
  const start = (safePage - 1) * pageSize
  return { data: arr.slice(start, start + pageSize), total, pages }
}
