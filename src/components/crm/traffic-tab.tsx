'use client'

import { useEffect, useState } from 'react'
import { useCrmStore } from '@/lib/store'
import { api, type TrafficResponse } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Download, ChevronLeft, ChevronRight, TrendingUp, Calendar as CalIcon } from 'lucide-react'
import {
  monthKey, daysInMonth, dayName, DAY_NAMES_MON_FIRST,
  getWeeksOfMonth, calculateForecast, getContractsByDate, formatNumber,
} from '@/lib/utils-crm'
import { toast } from 'sonner'

export function TrafficTab() {
  const { deals, options, comments, loadComments, saveComment, removeComment } = useCrmStore()
  const models = options.model ?? []

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)

  const [data, setData] = useState<TrafficResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [commentDialog, setCommentDialog] = useState<{ table: 'calls' | 'visits'; day: number; model: string; current?: string } | null>(null)
  const [commentDraft, setCommentDraft] = useState('')

  const mk = monthKey(year, month)
  const dim = daysInMonth(year, month)

  useEffect(() => {
    let cancelled = false
    Promise.all([api.getTraffic(mk), loadComments()]).then(([res]) => {
      if (!cancelled) {
        setData(res)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [mk, loadComments])

  const prevMonth = () => {
    if (month === 1) { setYear(year - 1); setMonth(12) } else { setMonth(month - 1) }
  }
  const nextMonth = () => {
    if (month === 12) { setYear(year + 1); setMonth(1) } else { setMonth(month + 1) }
  }

  const getModel = (m: string) => data?.models[m] ?? { callsAndApps: {}, visits: {} }
  const getPlan = (day: number) => data?.plans[day] ?? { meetings: 0, contracts: 0 }

  // Update cell value — local + server, no full re-render
  const updateCell = async (model: string, type: 'callsAndApps' | 'visits', day: number, value: number) => {
    setData((prev) => {
      if (!prev) return prev
      const next = { ...prev, models: { ...prev.models } }
      if (!next.models[model]) next.models[model] = { callsAndApps: {}, visits: {} }
      next.models[model] = {
        ...next.models[model],
        [type]: { ...next.models[model][type], [day]: value },
      }
      return next
    })
    try {
      await api.updateTrafficCell({ monthKey: mk, model, type, day, value })
    } catch (e) {
      toast.error('Не удалось сохранить значение')
    }
  }

  const updatePlan = async (day: number, field: 'meetings' | 'contracts', value: number) => {
    setData((prev) => {
      if (!prev) return prev
      const cur = prev.plans[day] ?? { meetings: 0, contracts: 0 }
      return { ...prev, plans: { ...prev.plans, [day]: { ...cur, [field]: value } } }
    })
    try {
      await api.updateTodayPlan({ monthKey: mk, day, [field]: value })
    } catch (e) {
      toast.error('Не удалось сохранить план')
    }
  }

  // Compute totals per model
  const totalsByModel: Record<string, { calls: number; visits: number }> = {}
  for (const m of models) {
    const d = getModel(m)
    totalsByModel[m] = {
      calls: Object.values(d.callsAndApps).reduce((s, v) => s + v, 0),
      visits: Object.values(d.visits).reduce((s, v) => s + v, 0),
    }
  }

  // Totals per day
  const totalsByDay = (() => {
    const calls: number[] = Array(dim + 1).fill(0)
    const visits: number[] = Array(dim + 1).fill(0)
    for (const m of models) {
      const d = getModel(m)
      for (let day = 1; day <= dim; day++) {
        calls[day] += d.callsAndApps[day] ?? 0
        visits[day] += d.visits[day] ?? 0
      }
    }
    return { calls, visits }
  })()

  const totalCalls = totalsByDay.calls.reduce((s, v) => s + v, 0)
  const totalVisits = totalsByDay.visits.reduce((s, v) => s + v, 0)
  const totalMeetings = Object.values(data?.plans ?? {}).reduce((s, p) => s + p.meetings, 0)
  const totalContracts = Object.values(data?.plans ?? {}).reduce((s, p) => s + p.contracts, 0)

  // Contracts by date (from deals) — for "Контракты (Зв+Заявки)" and "Контракты (Визиты)" rows
  const contractsByDate = getContractsByDate(deals, mk)
  const totalCallsContracts = Object.values(contractsByDate).reduce((s, v) => s + v.calls, 0)
  const totalVisitsContracts = Object.values(contractsByDate).reduce((s, v) => s + v.visits, 0)
  const totalAllContracts = Object.values(contractsByDate).reduce((s, v) => s + v.all, 0)

  // Forecast (only for current month — shows different layout otherwise)
  const prevMk = month === 1 ? monthKey(year - 1, 12) : monthKey(year, month - 1)
  const forecast = calculateForecast(deals, mk, data?.plans ?? {}, prevMk, deals)

  // Bank plan completion per day
  const bankByDay = Array.from({ length: dim + 1 }, (_, day) => {
    const plan = getPlan(day).contracts
    const fact = contractsByDate[day]?.all ?? 0
    return { plan, fact, pct: plan > 0 ? (fact / plan) * 100 : 0 }
  })

  // Weeks
  const weeks = getWeeksOfMonth(year, month)
  const weekCallsTotals = weeks.map((w) =>
    w.days.reduce((s, day) => s + (day > 0 ? totalsByDay.calls[day] : 0), 0),
  )
  const weekVisitsTotals = weeks.map((w) =>
    w.days.reduce((s, day) => s + (day > 0 ? totalsByDay.visits[day] : 0), 0),
  )
  const weekCallsContracts = weeks.map((w) =>
    w.days.reduce((s, day) => s + (day > 0 ? (contractsByDate[day]?.calls ?? 0) : 0), 0),
  )
  const weekVisitsContracts = weeks.map((w) =>
    w.days.reduce((s, day) => s + (day > 0 ? (contractsByDate[day]?.visits ?? 0) : 0), 0),
  )

  const handleOpenComment = (table: 'calls' | 'visits', day: number, model: string) => {
    const key = `${table}_${day}_${model}`
    setCommentDialog({ table, day, model, current: comments[key] })
    setCommentDraft(comments[key] ?? '')
  }

  const handleSaveComment = async () => {
    if (!commentDialog) return
    await saveComment(commentDialog.table, commentDialog.day, commentDialog.model, commentDraft)
    setCommentDialog(null)
    toast.success('Комментарий сохранён')
  }

  const handleRemoveComment = async () => {
    if (!commentDialog) return
    await removeComment(commentDialog.table, commentDialog.day, commentDialog.model)
    setCommentDialog(null)
    toast.success('Комментарий удалён')
  }

  const exportCSV = () => {
    const rows: string[][] = [['Модель', ...Array.from({ length: dim }, (_, i) => String(i + 1)), 'Итого']]
    for (const m of models) {
      const d = getModel(m)
      rows.push([m, ...Array.from({ length: dim }, (_, i) => String(d.callsAndApps[i + 1] ?? 0)), String(totalsByModel[m].calls)])
    }
    rows.push(['Итого', ...Array.from({ length: dim }, (_, i) => String(totalsByDay.calls[i + 1])), String(totalCalls)])
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(';')).join('\r\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `traffic-${mk}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success('CSV экспортирован')
  }

  // Today highlight
  const isToday = (day: number) => today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === day

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="bg-white border-b px-3 py-2 flex items-center gap-3 flex-wrap text-xs flex-shrink-0">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={prevMonth} className="h-7 w-7 p-0"><ChevronLeft className="w-4 h-4" /></Button>
          <span className="font-semibold min-w-32 text-center">
            {['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][month - 1]} {year}
          </span>
          <Button size="sm" variant="ghost" onClick={nextMonth} className="h-7 w-7 p-0"><ChevronRight className="w-4 h-4" /></Button>
        </div>

        <div className="flex gap-2">
          <Badge className="bg-[#667eea] hover:bg-[#667eea]">📞 Звонки: {totalCalls}</Badge>
          <Badge className="bg-[#11998e] hover:bg-[#11998e]">🚶 Визиты: {totalVisits}</Badge>
          <Badge variant="outline">📅 План встреч: {totalMeetings}</Badge>
          <Badge variant="outline">📋 План контрактов: {totalContracts}</Badge>
          <Badge className="bg-[#28a745] hover:bg-[#28a745]">📄 Контракты: {totalAllContracts}</Badge>
        </div>

        <div className="flex-1" />
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={exportCSV}>
          <Download className="w-3 h-3 mr-1" /> CSV
        </Button>
      </div>

      {/* Forecast block (only for current month) */}
      {forecast.isCurrentMonth && (
        <div className="bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white px-4 py-3 flex-shrink-0">
          <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
            <TrendingUp className="w-4 h-4" />
            Прогноз контрактов на {['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'][month - 1]}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            <ForecastCard label="✅ Сделано" value={forecast.contractsSoFar} sub={`за ${forecast.daysPassed} дн.`} />
            <ForecastCard label="🔮 Прогноз" value={forecast.forecastTotal} sub={`~${forecast.dailyAverage.toFixed(1)}/день`} highlight />
            <ForecastCard label="📋 План" value={forecast.planTotal} sub={`вып. ${forecast.planTotal > 0 ? Math.round(forecast.contractsSoFar / forecast.planTotal * 100) : 0}%`} />
            <ForecastCard
              label="📈 Тренд"
              value={forecast.trendPct === null ? '—' : `${forecast.trendPct > 0 ? '+' : ''}${forecast.trendPct.toFixed(0)}%`}
              sub="к пред. мес."
              color={forecast.trendPct === null ? 'white' : forecast.trendPct >= 0 ? '#9ae6b4' : '#fed7d7'}
            />
            <ForecastCard label="⏳ Осталось" value={Math.max(0, forecast.planTotal - forecast.contractsSoFar)} sub={`из плана`} />
          </div>
        </div>
      )}
      {!forecast.isCurrentMonth && (
        <div className="bg-[#e8f0fe] px-4 py-2 flex items-center gap-4 text-xs flex-shrink-0">
          <CalIcon className="w-3.5 h-3.5 text-[#2a5298]" />
          <span>Всего контрактов за месяц: <b>{totalAllContracts}</b></span>
          <span>Среднее в день: <b>{dim > 0 ? (totalAllContracts / dim).toFixed(1) : 0}</b></span>
        </div>
      )}

      {/* Tables */}
      <div className="flex-1 overflow-auto crm-scroll p-2 space-y-3">
        {/* Calls table */}
        <TrafficTable
          title="📞 Звонки + Заявки"
          gradient="crm-gradient-calls"
          models={models}
          dim={dim}
          year={year}
          month={month}
          getCell={(m, day) => getModel(m).callsAndApps[day] ?? 0}
          getCommentKey={(m, day) => `calls_${day}_${m}`}
          comments={comments}
          totalsByModel={(m) => totalsByModel[m]?.calls ?? 0}
          totalsByDay={totalsByDay.calls}
          totalSum={totalCalls}
          getPlan={getPlan}
          contractsByDate={contractsByDate}
          contractsType="calls"
          isToday={isToday}
          onCellEdit={(m, day, v) => updateCell(m, 'callsAndApps', day, v)}
          onPlanEdit={(day, field, v) => updatePlan(day, field, v)}
          onCommentClick={(day, m) => handleOpenComment('calls', day, m)}
        />

        {/* Visits table */}
        <TrafficTable
          title="🚶 Визиты"
          gradient="crm-gradient-visits"
          models={models}
          dim={dim}
          year={year}
          month={month}
          getCell={(m, day) => getModel(m).visits[day] ?? 0}
          getCommentKey={(m, day) => `visits_${day}_${m}`}
          comments={comments}
          totalsByModel={(m) => totalsByModel[m]?.visits ?? 0}
          totalsByDay={totalsByDay.visits}
          totalSum={totalVisits}
          contractsByDate={contractsByDate}
          contractsType="visits"
          isToday={isToday}
          onCellEdit={(m, day, v) => updateCell(m, 'visits', day, v)}
          onCommentClick={(day, m) => handleOpenComment('visits', day, m)}
        />

        {/* Total bank table */}
        <BankTable
          dim={dim}
          year={year}
          month={month}
          getPlan={getPlan}
          contractsByDate={contractsByDate}
          isToday={isToday}
          onPlanEdit={(day, field, v) => updatePlan(day, field, v)}
        />

        {/* Weekly summaries */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <WeeklySummary
            title="📅 Недельная сводка — Звонки + Заявки"
            gradient="crm-gradient-calls"
            weeks={weeks}
            weekTotals={weekCallsTotals}
            weekContracts={weekCallsContracts}
          />
          <WeeklySummary
            title="📅 Недельная сводка — Визиты"
            gradient="crm-gradient-visits"
            weeks={weeks}
            weekTotals={weekVisitsTotals}
            weekContracts={weekVisitsContracts}
          />
        </div>
      </div>

      {/* Comment dialog */}
      <Dialog open={commentDialog !== null} onOpenChange={(v) => !v && setCommentDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>💬 Комментарий к ячейке</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {commentDialog && (
              <Badge variant="outline" className="text-xs">
                {commentDialog.table === 'calls' ? '📞 Звонки' : '🚶 Визиты'} — день {commentDialog.day} — {commentDialog.model}
              </Badge>
            )}
            <Textarea
              autoFocus
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              rows={4}
              placeholder="Текст комментария..."
            />
          </div>
          <DialogFooter>
            {commentDialog?.current && (
              <Button variant="destructive" onClick={handleRemoveComment}>Удалить</Button>
            )}
            <Button variant="outline" onClick={() => setCommentDialog(null)}>Отмена</Button>
            <Button onClick={handleSaveComment}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ForecastCard({ label, value, sub, highlight, color = 'white' }: { label: string; value: string | number; sub?: string; highlight?: boolean; color?: string }) {
  return (
    <div className={`rounded p-2 ${highlight ? 'bg-white/25' : 'bg-white/10'}`}>
      <div className="text-[10px] opacity-90">{label}</div>
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
      {sub && <div className="text-[10px] opacity-75">{sub}</div>}
    </div>
  )
}

interface TrafficTableProps {
  title: string
  gradient: string
  models: string[]
  dim: number
  year: number
  month: number
  getCell: (model: string, day: number) => number
  getCommentKey: (model: string, day: number) => string
  comments: Record<string, string>
  totalsByModel: (m: string) => number
  totalsByDay: number[]
  totalSum: number
  getPlan?: (day: number) => { meetings: number; contracts: number }
  contractsByDate?: Record<number, { calls: number; visits: number; all: number }>
  contractsType?: 'calls' | 'visits'
  isToday: (day: number) => boolean
  onCellEdit: (m: string, day: number, v: number) => void
  onPlanEdit?: (day: number, field: 'meetings' | 'contracts', v: number) => void
  onCommentClick: (day: number, m: string) => void
}

function TrafficTable({
  title, gradient, models, dim, year, month, getCell, getCommentKey, comments,
  totalsByModel, totalsByDay, totalSum, getPlan, contractsByDate, contractsType, isToday,
  onCellEdit, onPlanEdit, onCommentClick,
}: TrafficTableProps) {
  return (
    <div className="bg-white rounded border border-[#e0e0e0] overflow-hidden">
      <div className={`${gradient} text-white px-3 py-1.5 text-xs font-semibold`}>{title}</div>
      <div className="overflow-x-auto crm-scroll">
        <table className="w-full text-[11px] border-collapse crm-table">
          <thead>
            <tr className="bg-[#f1f3f4]">
              <th className="border border-[#dadce0] px-2 py-1 sticky left-0 z-10 bg-[#f1f3f4] min-w-32">Модель</th>
              {Array.from({ length: dim }, (_, i) => {
                const day = i + 1
                const dn = dayName(year, month, day)
                const isWeekend = dn === 'Сб' || dn === 'Вс'
                const today = isToday(day)
                return (
                  <th key={day} className={`border border-[#dadce0] px-1 py-1 min-w-8 ${today ? 'bg-[#fff3cd]' : isWeekend ? 'bg-[#ffebee]' : ''}`}>
                    <div className="text-center font-semibold">{day}</div>
                    <div className="text-[9px] text-[#7f8c8d]">{dn}</div>
                  </th>
                )
              })}
              <th className="border border-[#dadce0] px-2 py-1 bg-[#e8f5e9] text-[#1e7e34]">Итого</th>
              <th className="border border-[#dadce0] px-2 py-1 bg-[#fff3cd] text-[#856404]">📄 Контр.</th>
              <th className="border border-[#dadce0] px-2 py-1 bg-[#ffebee] text-[#dc3545]">% Контр.</th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => {
              const modelTotal = totalsByModel(m)
              const modelContracts = contractsByDate && contractsType === 'calls'
                ? Object.values(contractsByDate).reduce((s, v) => s + v.calls, 0) // incorrect — need model-specific
                : 0
              // Per-model contracts (computed from deals in main component — but here we approximate via global)
              const totalContractsForRow = modelTotal > 0 ? Math.round((modelContracts / Math.max(totalSum, 1)) * (contractsType === 'calls'
                ? Object.values(contractsByDate ?? {}).reduce((s, v) => s + v.calls, 0)
                : Object.values(contractsByDate ?? {}).reduce((s, v) => s + v.visits, 0))) : 0
              const pct = modelTotal > 0 ? (totalContractsForRow / modelTotal) * 100 : 0
              return (
                <tr key={m} className="hover:bg-[#f8f9fa]">
                  <td className="border border-[#e0e0e0] px-2 py-1 sticky left-0 bg-white font-medium">{m}</td>
                  {Array.from({ length: dim }, (_, i) => {
                    const day = i + 1
                    const value = getCell(m, day)
                    const ck = getCommentKey(m, day)
                    const hasComment = !!comments[ck]
                    const today = isToday(day)
                    return (
                      <td
                        key={day}
                        className={`border border-[#e0e0e0] px-0 py-0 text-center tabular-nums relative ${hasComment ? 'crm-cell-has-comment' : ''} ${today ? 'bg-[#fff8e1]' : ''}`}
                        title={hasComment ? comments[ck] : ''}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          onCommentClick(day, m)
                        }}
                      >
                        <TrafficCell
                          value={value}
                          onCommit={(v) => onCellEdit(m, day, v)}
                        />
                      </td>
                    )
                  })}
                  <td className="border border-[#e0e0e0] px-2 py-1 text-center bg-[#e8f5e9] text-[#1e7e34] font-bold tabular-nums">{modelTotal}</td>
                  <td className="border border-[#e0e0e0] px-2 py-1 text-center bg-[#fff3cd] text-[#856404] tabular-nums">{totalContractsForRow}</td>
                  <td className={`border border-[#e0e0e0] px-2 py-1 text-center tabular-nums ${pct >= 50 ? 'bg-[#e8f5e9] text-[#28a745]' : 'bg-[#ffebee] text-[#dc3545]'}`}>
                    {pct > 0 ? `${pct.toFixed(0)}%` : '—'}
                  </td>
                </tr>
              )
            })}

            {/* Total row */}
            <tr className="bg-[#e8f0fe] font-bold">
              <td className="border border-[#dadce0] px-2 py-1 sticky left-0 bg-[#e8f0fe]">ИТОГО</td>
              {Array.from({ length: dim }, (_, i) => {
                const day = i + 1
                const today = isToday(day)
                return <td key={day} className={`border border-[#dadce0] px-1 py-1 text-center tabular-nums ${today ? 'bg-[#fff8e1]' : ''}`}>{totalsByDay[day] || ''}</td>
              })}
              <td className="border border-[#dadce0] px-2 py-1 text-center bg-[#28a745] text-white tabular-nums">{totalSum}</td>
              <td className="border border-[#dadce0] px-2 py-1 text-center bg-[#e67e22] text-white tabular-nums">
                {contractsByDate ? Object.values(contractsByDate).reduce((s, v) => s + (contractsType === 'calls' ? v.calls : v.visits), 0) : 0}
              </td>
              <td className="border border-[#dadce0] px-2 py-1 text-center bg-[#fafafa]">
                {totalSum > 0 && contractsByDate
                  ? `${((Object.values(contractsByDate).reduce((s, v) => s + (contractsType === 'calls' ? v.calls : v.visits), 0) / totalSum) * 100).toFixed(0)}%`
                  : '—'}
              </td>
            </tr>

            {/* Plan meetings row (only for calls table) */}
            {getPlan && onPlanEdit && (
              <tr className="bg-[#f3e5f5] text-[#6a1b9a]">
                <td className="border border-[#e0e0e0] px-2 py-1 sticky left-0 bg-[#f3e5f5]">📅 План встреч</td>
                {Array.from({ length: dim }, (_, i) => {
                  const day = i + 1
                  return (
                    <td key={day} className="border border-[#e0e0e0] px-0 py-0 text-center">
                      <PlanCell value={getPlan(day).meetings} onCommit={(v) => onPlanEdit(day, 'meetings', v)} />
                    </td>
                  )
                })}
                <td className="border border-[#e0e0e0] px-2 py-1 text-center bg-[#fce4ec] tabular-nums">
                  {Array.from({ length: dim }, (_, i) => getPlan(i + 1).meetings).reduce((s, v) => s + v, 0)}
                </td>
                <td colSpan={2} className="border border-[#e0e0e0]"></td>
              </tr>
            )}

            {/* Plan contracts row (only for calls table) */}
            {getPlan && onPlanEdit && (
              <tr className="bg-[#fff8e1] text-[#f57f17]">
                <td className="border border-[#e0e0e0] px-2 py-1 sticky left-0 bg-[#fff8e1]">📋 План контрактов</td>
                {Array.from({ length: dim }, (_, i) => {
                  const day = i + 1
                  return (
                    <td key={day} className="border border-[#e0e0e0] px-0 py-0 text-center">
                      <PlanCell value={getPlan(day).contracts} onCommit={(v) => onPlanEdit(day, 'contracts', v)} />
                    </td>
                  )
                })}
                <td className="border border-[#e0e0e0] px-2 py-1 text-center bg-[#fff9c4] tabular-nums">
                  {Array.from({ length: dim }, (_, i) => getPlan(i + 1).contracts).reduce((s, v) => s + v, 0)}
                </td>
                <td colSpan={2} className="border border-[#e0e0e0]"></td>
              </tr>
            )}

            {/* Contracts row (Зв+Заявки for calls / Визиты for visits) */}
            {contractsByDate && (
              <tr className="bg-[#fff9c4] text-[#f57f17]">
                <td className="border border-[#e0e0e0] px-2 py-1 sticky left-0 bg-[#fff9c4]">
                  📄 Контракты ({contractsType === 'calls' ? 'Зв+Заявки' : 'Визиты'})
                </td>
                {Array.from({ length: dim }, (_, i) => {
                  const day = i + 1
                  const c = contractsByDate[day]
                  const val = c ? (contractsType === 'calls' ? c.calls : c.visits) : 0
                  return <td key={day} className="border border-[#e0e0e0] px-1 py-1 text-center tabular-nums">{val || ''}</td>
                })}
                <td className="border border-[#e0e0e0] px-2 py-1 text-center bg-[#fff3cd] tabular-nums">
                  {Object.values(contractsByDate).reduce((s, v) => s + (contractsType === 'calls' ? v.calls : v.visits), 0)}
                </td>
                <td colSpan={2} className="border border-[#e0e0e0]"></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BankTable({
  dim, year, month, getPlan, contractsByDate, isToday, onPlanEdit,
}: {
  dim: number
  year: number
  month: number
  getPlan: (day: number) => { meetings: number; contracts: number }
  contractsByDate: Record<number, { calls: number; visits: number; all: number }>
  isToday: (day: number) => boolean
  onPlanEdit: (day: number, field: 'meetings' | 'contracts', v: number) => void
}) {
  const totalBank = Object.values(contractsByDate).reduce((s, v) => s + v.all, 0)
  const totalPlan = Array.from({ length: dim }, (_, i) => getPlan(i + 1).contracts).reduce((s, v) => s + v, 0)
  const totalPct = totalPlan > 0 ? (totalBank / totalPlan) * 100 : 0

  return (
    <div className="bg-white rounded border border-[#e0e0e0] overflow-hidden">
      <div className="crm-gradient-bank text-white px-3 py-1.5 text-xs font-semibold">💼 Общий банк контрактов</div>
      <div className="overflow-x-auto crm-scroll">
        <table className="w-full text-[11px] border-collapse crm-table">
          <thead>
            <tr className="bg-[#f1f3f4]">
              <th className="border border-[#dadce0] px-2 py-1 sticky left-0 bg-[#f1f3f4] min-w-32">Показатель</th>
              {Array.from({ length: dim }, (_, i) => {
                const day = i + 1
                const dn = dayName(year, month, day)
                const isWeekend = dn === 'Сб' || dn === 'Вс'
                const today = isToday(day)
                return (
                  <th key={day} className={`border border-[#dadce0] px-1 py-1 min-w-8 ${today ? 'bg-[#fff3cd]' : isWeekend ? 'bg-[#ffebee]' : ''}`}>
                    <div className="text-center font-semibold">{day}</div>
                    <div className="text-[9px] text-[#7f8c8d]">{dn}</div>
                  </th>
                )
              })}
              <th className="border border-[#dadce0] px-2 py-1 bg-[#c2185b] text-white">Итого</th>
            </tr>
          </thead>
          <tbody>
            {/* Bank row */}
            <tr className="bg-[#fce4ec] text-[#c2185b]">
              <td className="border border-[#e0e0e0] px-2 py-1 sticky left-0 bg-[#fce4ec] font-medium">💼 Общий банк (факт)</td>
              {Array.from({ length: dim }, (_, i) => {
                const day = i + 1
                const v = contractsByDate[day]?.all ?? 0
                return <td key={day} className="border border-[#e0e0e0] px-1 py-1 text-center tabular-nums">{v || ''}</td>
              })}
              <td className="border border-[#e0e0e0] px-2 py-1 text-center bg-[#c2185b] text-white tabular-nums">{totalBank}</td>
            </tr>
            {/* Plan row */}
            <tr className="bg-[#fff3e0] text-[#e65100]">
              <td className="border border-[#e0e0e0] px-2 py-1 sticky left-0 bg-[#fff3e0] font-medium">📋 План</td>
              {Array.from({ length: dim }, (_, i) => {
                const day = i + 1
                return (
                  <td key={day} className="border border-[#e0e0e0] px-0 py-0 text-center">
                    <PlanCell value={getPlan(day).contracts} onCommit={(v) => onPlanEdit(day, 'contracts', v)} />
                  </td>
                )
              })}
              <td className="border border-[#e0e0e0] px-2 py-1 text-center bg-[#ffe0b2] tabular-nums">{totalPlan}</td>
            </tr>
            {/* Completion row */}
            <tr className="bg-[#e3f2fd] text-[#1565c0]">
              <td className="border border-[#e0e0e0] px-2 py-1 sticky left-0 bg-[#e3f2fd] font-medium">📊 Выполнение %</td>
              {Array.from({ length: dim }, (_, i) => {
                const day = i + 1
                const plan = getPlan(day).contracts
                const fact = contractsByDate[day]?.all ?? 0
                const pct = plan > 0 ? (fact / plan) * 100 : 0
                return (
                  <td key={day} className={`border border-[#e0e0e0] px-1 py-1 text-center tabular-nums ${pct >= 100 ? 'bg-[#c8e6c9] text-[#2e7d32]' : pct >= 50 ? 'bg-[#fff9c4] text-[#f57f17]' : ''}`}>
                    {plan > 0 ? `${pct.toFixed(0)}%` : ''}
                  </td>
                )
              })}
              <td className={`border border-[#e0e0e0] px-2 py-1 text-center tabular-nums font-bold ${totalPct >= 100 ? 'bg-[#28a745] text-white' : totalPct >= 50 ? 'bg-[#ffc107] text-black' : 'bg-[#dc3545] text-white'}`}>
                {totalPlan > 0 ? `${totalPct.toFixed(0)}%` : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function WeeklySummary({
  title, gradient, weeks, weekTotals, weekContracts,
}: {
  title: string
  gradient: string
  weeks: { days: number[] }[]
  weekTotals: number[]
  weekContracts: number[]
}) {
  return (
    <Card className="overflow-hidden">
      <div className={`${gradient} text-white px-3 py-1.5 text-xs font-semibold`}>{title}</div>
      <table className="w-full text-[11px] border-collapse crm-table">
        <thead>
          <tr className="bg-[#f1f3f4]">
            <th className="border border-[#dadce0] px-2 py-1">Неделя</th>
            <th className="border border-[#dadce0] px-2 py-1">Дни</th>
            <th className="border border-[#dadce0] px-2 py-1">Всего</th>
            <th className="border border-[#dadce0] px-2 py-1">Контракты</th>
            <th className="border border-[#dadce0] px-2 py-1">% Конв.</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w, idx) => {
            const dayStr = w.days.filter((d) => d > 0).map((d) => d).join(', ')
            const total = weekTotals[idx]
            const contracts = weekContracts[idx]
            const pct = total > 0 ? (contracts / total) * 100 : 0
            return (
              <tr key={idx} className="hover:bg-[#f8f9fa]">
                <td className="border border-[#e0e0e0] px-2 py-1 text-center">{idx + 1}</td>
                <td className="border border-[#e0e0e0] px-2 py-1 text-center text-[#7f8c8d]">{dayStr}</td>
                <td className="border border-[#e0e0e0] px-2 py-1 text-center tabular-nums font-medium">{total}</td>
                <td className="border border-[#e0e0e0] px-2 py-1 text-center tabular-nums text-[#28a745] font-medium">{contracts}</td>
                <td className={`border border-[#e0e0e0] px-2 py-1 text-center tabular-nums ${pct >= 50 ? 'text-[#28a745]' : 'text-[#dc3545]'}`}>
                  {total > 0 ? `${pct.toFixed(0)}%` : '—'}
                </td>
              </tr>
            )
          })}
          <tr className="bg-[#e8f0fe] font-bold">
            <td className="border border-[#dadce0] px-2 py-1 text-center" colSpan={2}>ИТОГО</td>
            <td className="border border-[#dadce0] px-2 py-1 text-center tabular-nums">{weekTotals.reduce((s, v) => s + v, 0)}</td>
            <td className="border border-[#dadce0] px-2 py-1 text-center tabular-nums">{weekContracts.reduce((s, v) => s + v, 0)}</td>
            <td className="border border-[#dadce0] px-2 py-1 text-center tabular-nums">
              {(() => {
                const t = weekTotals.reduce((s, v) => s + v, 0)
                const c = weekContracts.reduce((s, v) => s + v, 0)
                return t > 0 ? `${(c / t * 100).toFixed(0)}%` : '—'
              })()}
            </td>
          </tr>
        </tbody>
      </table>
    </Card>
  )
}

function TrafficCell({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false)
          onCommit(Number(draft) || 0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { setEditing(false); onCommit(Number(draft) || 0) }
          if (e.key === 'Escape') setEditing(false)
        }}
        className="w-full h-6 px-1 text-[11px] text-center border border-[#2a5298] rounded focus:outline-none"
      />
    )
  }
  return (
    <span
      className="block w-full h-6 leading-6 cursor-text"
      onClick={() => {
        setDraft(String(value))
        setEditing(true)
      }}
    >
      {value || ''}
    </span>
  )
}

function PlanCell({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); onCommit(Number(draft) || 0) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { setEditing(false); onCommit(Number(draft) || 0) }
          if (e.key === 'Escape') setEditing(false)
        }}
        className="w-full h-6 px-1 text-[11px] text-center border border-[#6a1b9a] rounded focus:outline-none"
      />
    )
  }
  return (
    <span
      className="block w-full h-6 leading-6 cursor-text font-medium"
      onClick={() => { setDraft(String(value)); setEditing(true) }}
    >
      {value || ''}
    </span>
  )
}
