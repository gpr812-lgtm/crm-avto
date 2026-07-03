'use client'

import { useMemo, useState } from 'react'
import { useCrmStore } from '@/lib/store'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatNumber, monthKey } from '@/lib/utils-crm'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import type { Deal } from '@/lib/types'

interface FilterState {
  status: string
  model: string
  traffic: string
  risk: string
  kr: string
  ti: string
}

const EMPTY_FILTERS: FilterState = {
  status: '', model: '', traffic: '', risk: '', kr: '', ti: '',
}

const MONTH_NAMES = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

export function AnalyticsTab() {
  const { deals, options } = useCrmStore()
  const [groupBy, setGroupBy] = useState<'seller' | 'model'>('seller')
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)

  // Month filter — based on dateDkp
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1) // 1-12, 0 = "all months"
  const [monthEnabled, setMonthEnabled] = useState(false)

  const prevMonth = () => {
    if (month === 1) { setYear(year - 1); setMonth(12) } else setMonth(month - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setYear(year + 1); setMonth(1) } else setMonth(month + 1)
  }

  const mk = monthKey(year, month)

  // Apply filters
  const filteredDeals = useMemo(() => {
    return deals.filter((d) => {
      // Month filter — uses dateDkp
      if (monthEnabled && d.dateDkp && !d.dateDkp.startsWith(mk)) return false
      if (monthEnabled && !d.dateDkp) return false
      if (filters.status && d.status !== filters.status) return false
      if (filters.model && d.model !== filters.model) return false
      if (filters.traffic && d.traffic !== filters.traffic) return false
      if (filters.risk && d.risk !== filters.risk) return false
      if (filters.kr && d.kr !== filters.kr) return false
      if (filters.ti && d.ti !== filters.ti) return false
      return true
    })
  }, [deals, filters, monthEnabled, mk])

  // Group + aggregate
  const groups = useMemo(() => {
    const map: Record<string, {
      count: number
      jok: number
      j: number
      o: number
      k: number
      ti: number
      kr: number
    }> = {}
    for (const d of filteredDeals) {
      const key = groupBy === 'seller' ? (d.seller || '(без продавца)') : (d.model || '(без модели)')
      if (!map[key]) map[key] = { count: 0, jok: 0, j: 0, o: 0, k: 0, ti: 0, kr: 0 }
      const g = map[key]
      g.count += 1
      g.jok += d.jok || 0
      g.j += d.j || 0
      g.o += d.o || 0
      g.k += d.k || 0
      if (d.ti === '1' || d.ti === '2') g.ti += 1
      if (d.kr === '1') g.kr += 1
    }
    return Object.entries(map).map(([name, v]) => ({ name, ...v }))
  }, [filteredDeals, groupBy])

  const totals = useMemo(() => {
    let count = 0, jok = 0, j = 0, o = 0, k = 0, ti = 0, kr = 0
    for (const g of groups) {
      count += g.count
      jok += g.jok
      j += g.j
      o += g.o
      k += g.k
      ti += g.ti
      kr += g.kr
    }
    return { count, jok, j, o, k, ti, kr }
  }, [groups])

  const setFilter = (key: keyof FilterState, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }))
  }

  return (
    <div className="h-full overflow-auto crm-scroll p-3 space-y-3">
      {/* Filters */}
      <Card className="p-3">
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <div className="font-semibold">Фильтры:</div>

          {/* Month filter with toggle */}
          <div className={`flex items-center gap-1 px-2 py-0.5 border rounded transition-colors ${monthEnabled ? 'border-[hsl(221,60%,38%)] bg-[hsl(217,91%,95%)]' : 'border-[hsl(220,16%,90%)] bg-[hsl(220,20%,98%)]'}`}>
            <button
              onClick={() => setMonthEnabled(!monthEnabled)}
              className={`flex items-center gap-1 ${monthEnabled ? 'text-[hsl(221,60%,38%)] font-semibold' : 'text-[hsl(215,16%,47%)]'}`}
              title={monthEnabled ? 'Месяц включён — клик для выключения' : 'Клик для фильтрации по месяцу'}
            >
              <Calendar className="w-3 h-3" />
              <span className="text-[10px]">Месяц:</span>
            </button>
            {monthEnabled ? (
              <>
                <Button size="sm" variant="ghost" onClick={prevMonth} className="h-5 w-5 p-0">
                  <ChevronLeft className="w-3 h-3" />
                </Button>
                <span className="text-[10px] whitespace-nowrap font-medium">
                  {MONTH_NAMES[month - 1]} {year}
                </span>
                <Button size="sm" variant="ghost" onClick={nextMonth} className="h-5 w-5 p-0">
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </>
            ) : (
              <span className="text-[10px] text-[hsl(215,16%,47%)]">все</span>
            )}
          </div>

          <FilterSelect label="Статус" value={filters.status} onChange={(v) => setFilter('status', v)} options={options.status ?? []} />
          <FilterSelect label="Модель" value={filters.model} onChange={(v) => setFilter('model', v)} options={options.model ?? []} />
          <FilterSelect label="Трафик" value={filters.traffic} onChange={(v) => setFilter('traffic', v)} options={options.traffic ?? []} />
          <FilterSelect label="РИСК" value={filters.risk} onChange={(v) => setFilter('risk', v)} options={options.risk ?? []} />
          <FilterSelect label="КР" value={filters.kr} onChange={(v) => setFilter('kr', v)} options={options.kr ?? []} />
          <FilterSelect label="ТИ" value={filters.ti} onChange={(v) => setFilter('ti', v)} options={options.ti ?? []} />
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setFilters(EMPTY_FILTERS); setMonthEnabled(false) }}>Сбросить</Button>

          <div className="flex-1" />
          <div className="font-semibold">Группировка:</div>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as 'seller' | 'model')}>
            <SelectTrigger className="h-7 w-40 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="seller">По продавцу</SelectItem>
              <SelectItem value="model">По модели</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {monthEnabled && (
          <div className="mt-2 text-[10px] text-[hsl(215,16%,47%)]">
            📅 Фильтр активен: показаны сделки с датой ДКП в {MONTH_NAMES[month - 1]} {year}
          </div>
        )}
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KpiCard label="Всего АМ" value={formatNumber(totals.count)} color="hsl(221,60%,38%)" />
        <KpiCard label="Общий ЖОК" value={`${formatNumber(totals.jok)} ₽`} color="hsl(142,60%,35%)" />
        <KpiCard label="ТИ" value={formatNumber(totals.ti)} color="hsl(217,91%,55%)" />
        <KpiCard label="КР" value={formatNumber(totals.kr)} color="hsl(38,90%,45%)" />
      </div>

      {/* Analytics table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto crm-scroll">
          <table className="w-full text-xs border-collapse crm-table">
            <thead>
              <tr className="bg-[#f1f3f4]">
                <th rowSpan={2} className="border border-[#dadce0] px-2 py-1 sticky left-0 bg-[#1e3c72] text-white min-w-40">
                  {groupBy === 'seller' ? 'Продавец' : 'Модель'}
                </th>
                <th rowSpan={2} className="border border-[#dadce0] px-2 py-1 bg-[#1e3c72] text-white">АМ</th>
                <th colSpan={4} className="border border-[#dadce0] px-2 py-1 bg-[#4a7bc7] text-white">Удельные на 1 АМ</th>
                <th colSpan={2} className="border border-[#dadce0] px-2 py-1 bg-[#3a6ab7] text-white">Количество</th>
                <th colSpan={4} className="border border-[#dadce0] px-2 py-1 bg-[#2a5298] text-white">Суммы</th>
                <th colSpan={2} className="border border-[#dadce0] px-2 py-1 bg-[#1e3c72] text-white">Проценты</th>
              </tr>
              <tr className="bg-[#f1f3f4]">
                <th className="border border-[#dadce0] px-2 py-1">Ж уд.</th>
                <th className="border border-[#dadce0] px-2 py-1">О уд.</th>
                <th className="border border-[#dadce0] px-2 py-1">К уд.</th>
                <th className="border border-[#dadce0] px-2 py-1">ЖОК уд.</th>
                <th className="border border-[#dadce0] px-2 py-1">ТИ</th>
                <th className="border border-[#dadce0] px-2 py-1">КР</th>
                <th className="border border-[#dadce0] px-2 py-1">Ж</th>
                <th className="border border-[#dadce0] px-2 py-1">О</th>
                <th className="border border-[#dadce0] px-2 py-1">К</th>
                <th className="border border-[#dadce0] px-2 py-1">ЖОК</th>
                <th className="border border-[#dadce0] px-2 py-1">ТИ %</th>
                <th className="border border-[#dadce0] px-2 py-1">КР %</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.name} className="hover:bg-[#f8f9fa]">
                  <td className="border border-[#e0e0e0] px-2 py-1 sticky left-0 bg-white font-medium">{g.name}</td>
                  <td className="border border-[#e0e0e0] px-2 py-1 text-center tabular-nums">{g.count}</td>
                  <td className="border border-[#e0e0e0] px-2 py-1 text-center tabular-nums">{formatNumber(g.j / Math.max(g.count, 1))}</td>
                  <td className="border border-[#e0e0e0] px-2 py-1 text-center tabular-nums">{formatNumber(g.o / Math.max(g.count, 1))}</td>
                  <td className="border border-[#e0e0e0] px-2 py-1 text-center tabular-nums">{formatNumber(g.k / Math.max(g.count, 1))}</td>
                  <td className="border border-[#e0e0e0] px-2 py-1 text-center tabular-nums">{formatNumber(g.jok / Math.max(g.count, 1))}</td>
                  <td className="border border-[#e0e0e0] px-2 py-1 text-center tabular-nums">{g.ti}</td>
                  <td className="border border-[#e0e0e0] px-2 py-1 text-center tabular-nums">{g.kr}</td>
                  <td className="border border-[#e0e0e0] px-2 py-1 text-center tabular-nums">{formatNumber(g.j)}</td>
                  <td className="border border-[#e0e0e0] px-2 py-1 text-center tabular-nums">{formatNumber(g.o)}</td>
                  <td className="border border-[#e0e0e0] px-2 py-1 text-center tabular-nums">{formatNumber(g.k)}</td>
                  <td className="border border-[#e0e0e0] px-2 py-1 text-center tabular-nums">{formatNumber(g.jok)}</td>
                  <td className="border border-[#e0e0e0] px-2 py-1 text-center tabular-nums">{(g.ti / Math.max(g.count, 1) * 100).toFixed(1)}%</td>
                  <td className="border border-[#e0e0e0] px-2 py-1 text-center tabular-nums">{(g.kr / Math.max(g.count, 1) * 100).toFixed(1)}%</td>
                </tr>
              ))}
              {groups.length === 0 && (
                <tr>
                  <td colSpan={14} className="border border-[#e0e0e0] px-2 py-8 text-center text-[#7f8c8d]">
                    Нет данных по выбранным фильтрам
                  </td>
                </tr>
              )}
            </tbody>
            {groups.length > 0 && (
              <tfoot>
                <tr className="bg-[#e8f0fe] font-bold">
                  <td className="border border-[#dadce0] px-2 py-1 sticky left-0 bg-[#e8f0fe]">Итого</td>
                  <td className="border border-[#dadce0] px-2 py-1 text-center tabular-nums">{totals.count}</td>
                  <td className="border border-[#dadce0] px-2 py-1 text-center tabular-nums">{formatNumber(totals.j / Math.max(totals.count, 1))}</td>
                  <td className="border border-[#dadce0] px-2 py-1 text-center tabular-nums">{formatNumber(totals.o / Math.max(totals.count, 1))}</td>
                  <td className="border border-[#dadce0] px-2 py-1 text-center tabular-nums">{formatNumber(totals.k / Math.max(totals.count, 1))}</td>
                  <td className="border border-[#dadce0] px-2 py-1 text-center tabular-nums">{formatNumber(totals.jok / Math.max(totals.count, 1))}</td>
                  <td className="border border-[#dadce0] px-2 py-1 text-center tabular-nums">{totals.ti}</td>
                  <td className="border border-[#dadce0] px-2 py-1 text-center tabular-nums">{totals.kr}</td>
                  <td className="border border-[#dadce0] px-2 py-1 text-center tabular-nums">{formatNumber(totals.j)}</td>
                  <td className="border border-[#dadce0] px-2 py-1 text-center tabular-nums">{formatNumber(totals.o)}</td>
                  <td className="border border-[#dadce0] px-2 py-1 text-center tabular-nums">{formatNumber(totals.k)}</td>
                  <td className="border border-[#dadce0] px-2 py-1 text-center tabular-nums">{formatNumber(totals.jok)}</td>
                  <td className="border border-[#dadce0] px-2 py-1 text-center tabular-nums">{(totals.ti / Math.max(totals.count, 1) * 100).toFixed(1)}%</td>
                  <td className="border border-[#dadce0] px-2 py-1 text-center tabular-nums">{(totals.kr / Math.max(totals.count, 1) * 100).toFixed(1)}%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  )
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card className="p-4 flex flex-col gap-1.5 crm-card-shadow border-[hsl(220,16%,90%)]">
      <div className="text-[10px] text-[hsl(215,16%,47%)] uppercase tracking-wide font-medium">{label}</div>
      <div className="text-xl font-bold tabular-nums" style={{ color }}>{value}</div>
    </Card>
  )
}

function FilterSelect({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 px-2 text-xs border border-[#ddd] rounded focus:outline-none focus:border-[#2a5298]"
    >
      <option value="">{label}: все</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}
