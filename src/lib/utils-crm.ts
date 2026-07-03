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

/**
 * Get weeks of month — array of {start, end, days: number[]} (Mon-Sun, 1-based days)
 */
export function getWeeksOfMonth(year: number, month1Based: number): { days: number[] }[] {
  const dim = daysInMonth(year, month1Based)
  const firstDay = new Date(year, month1Based - 1, 1)
  // Convert Sunday (0) to 6, Monday (1) to 0
  const firstDayIdx = (firstDay.getDay() + 6) % 7

  const weeks: { days: number[] }[] = []
  let currentWeek: number[] = []
  // Pad start with nulls (use 0 to indicate "no day")
  for (let i = 0; i < firstDayIdx; i++) currentWeek.push(0)
  for (let day = 1; day <= dim; day++) {
    currentWeek.push(day)
    if (currentWeek.length === 7) {
      weeks.push({ days: currentWeek })
      currentWeek = []
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(0)
    weeks.push({ days: currentWeek })
  }
  return weeks
}

/**
 * Highlight matched text — returns array of {text, isMatch} chunks for safe rendering.
 */
export function highlightMatch(text: string, query: string): { text: string; isMatch: boolean }[] {
  if (!query) return [{ text, isMatch: false }]
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const chunks: { text: string; isMatch: boolean }[] = []
  let idx = 0
  while (idx < text.length) {
    const found = lowerText.indexOf(lowerQuery, idx)
    if (found === -1) {
      chunks.push({ text: text.slice(idx), isMatch: false })
      break
    }
    if (found > idx) {
      chunks.push({ text: text.slice(idx, found), isMatch: false })
    }
    chunks.push({ text: text.slice(found, found + query.length), isMatch: true })
    idx = found + query.length
  }
  return chunks
}

/**
 * Calculate forecast for the current month.
 * Returns: { contractsSoFar, forecastTotal, planTotal, trendPct, daysPassed, daysInMonth, isCurrentMonth }
 */
export function calculateForecast(
  deals: { status: string; dateDkp: string | null; traffic?: string }[],
  monthKey: string,
  todayPlans: Record<number, { meetings: number; contracts: number }>,
  prevMonthKey: string,
  prevMonthDeals: { status: string; dateDkp: string | null }[],
): {
  contractsSoFar: number
  forecastTotal: number
  planTotal: number
  trendPct: number | null
  daysPassed: number
  daysInMonth: number
  isCurrentMonth: boolean
  dailyAverage: number
} {
  const [y, m] = monthKey.split('-').map(Number)
  const dim = daysInMonth(y, m)
  const now = new Date()
  const isCurrentMonth = now.getFullYear() === y && now.getMonth() + 1 === m

  // All sold contracts in this month
  const monthContracts = deals.filter(
    (d) => d.status === 'Продан' && d.dateDkp && d.dateDkp.startsWith(monthKey),
  )
  const daysPassed = isCurrentMonth ? now.getDate() : dim
  const contractsSoFar = monthContracts.filter((d) => {
    if (!d.dateDkp) return false
    const day = Number(d.dateDkp.slice(8, 10))
    return day <= daysPassed
  }).length

  const dailyAverage = daysPassed > 0 ? contractsSoFar / daysPassed : 0
  const forecastTotal = Math.round(dailyAverage * dim)

  const planTotal = Object.values(todayPlans).reduce((s, p) => s + (p.contracts || 0), 0)

  const prevContracts = prevMonthDeals.filter(
    (d) => d.status === 'Продан' && d.dateDkp && d.dateDkp.startsWith(prevMonthKey),
  ).length
  const trendPct = prevContracts > 0 ? (contractsSoFar / prevContracts - 1) * 100 : null

  return {
    contractsSoFar,
    forecastTotal,
    planTotal,
    trendPct,
    daysPassed,
    daysInMonth: dim,
    isCurrentMonth,
    dailyAverage,
  }
}

/**
 * Group deals by date for fast lookup.
 */
export function getContractsByDate(
  deals: { status: string; dateDkp: string | null; traffic?: string }[],
  monthKey: string,
): Record<number, { calls: number; visits: number; all: number }> {
  const out: Record<number, { calls: number; visits: number; all: number }> = {}
  for (const d of deals) {
    if (d.status !== 'Продан' || !d.dateDkp || !d.dateDkp.startsWith(monthKey)) continue
    const day = Number(d.dateDkp.slice(8, 10))
    if (!out[day]) out[day] = { calls: 0, visits: 0, all: 0 }
    const traffic = d.traffic || ''
    if (traffic.includes('Звонок') || traffic.includes('Заявка')) {
      out[day].calls++
    }
    if (traffic.includes('Визит')) {
      out[day].visits++
    }
    out[day].all++
  }
  return out
}
