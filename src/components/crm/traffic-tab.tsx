'use client'

import { useEffect, useState } from 'react'
import { useCrmStore } from '@/lib/store'
import { api, type TrafficResponse } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { monthKey, daysInMonth, dayName, DAY_NAMES_MON_FIRST, formatNumber } from '@/lib/utils-crm'
import { toast } from 'sonner'

export function TrafficTab() {
  const { options, comments, loadComments, saveComment, removeComment } = useCrmStore()
  const models = options.model ?? []

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1) // 1-based

  const [data, setData] = useState<TrafficResponse | null>(null)
  const [loading, setLoading] = useState(false)
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

  // Ensure model has entries
  const getModel = (m: string) => {
    return data?.models[m] ?? { callsAndApps: {}, visits: {} }
  }
  const getPlan = (day: number) => data?.plans[day] ?? { meetings: 0, contracts: 0 }

  // Update cell value (local + server) — FIX: no full re-render, just update local state
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

  // Compute totals per model (direct, no useMemo — React Compiler handles)
  const totalsByModel: Record<string, { calls: number; visits: number }> = {}
  for (const m of models) {
    const d = getModel(m)
    totalsByModel[m] = {
      calls: Object.values(d.callsAndApps).reduce((s, v) => s + v, 0),
      visits: Object.values(d.visits).reduce((s, v) => s + v, 0),
    }
  }

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
        </div>

        <div className="flex-1" />
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={exportCSV}>
          <Download className="w-3 h-3 mr-1" /> CSV
        </Button>
      </div>

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
          type="callsAndApps"
          getCell={(m, day) => getModel(m).callsAndApps[day] ?? 0}
          getCommentKey={(m, day) => `calls_${day}_${m}`}
          comments={comments}
          totalsByModel={(m) => totalsByModel[m]?.calls ?? 0}
          totalsByDay={totalsByDay.calls}
          totalSum={totalCalls}
          getPlan={getPlan}
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
          year={month}
          month={month}
          type="visits"
          getCell={(m, day) => getModel(m).visits[day] ?? 0}
          getCommentKey={(m, day) => `visits_${day}_${m}`}
          comments={comments}
          totalsByModel={(m) => totalsByModel[m]?.visits ?? 0}
          totalsByDay={totalsByDay.visits}
          totalSum={totalVisits}
          onCellEdit={(m, day, v) => updateCell(m, 'visits', day, v)}
          onCommentClick={(day, m) => handleOpenComment('visits', day, m)}
        />
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
              <Button variant="destructive" onClick={handleRemoveComment}>
                Удалить
              </Button>
            )}
            <Button variant="outline" onClick={() => setCommentDialog(null)}>Отмена</Button>
            <Button onClick={handleSaveComment}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  type: 'callsAndApps' | 'visits'
  getCell: (model: string, day: number) => number
  getCommentKey: (model: string, day: number) => string
  comments: Record<string, string>
  totalsByModel: (m: string) => number
  totalsByDay: number[]
  totalSum: number
  getPlan?: (day: number) => { meetings: number; contracts: number }
  onCellEdit: (m: string, day: number, v: number) => void
  onPlanEdit?: (day: number, field: 'meetings' | 'contracts', v: number) => void
  onCommentClick: (day: number, m: string) => void
}

function TrafficTable({
  title, gradient, models, dim, year, month, getCell, getCommentKey, comments,
  totalsByModel, totalsByDay, totalSum, getPlan, onCellEdit, onPlanEdit, onCommentClick,
}: TrafficTableProps) {
  return (
    <div className="bg-white rounded border border-[#e0e0e0] overflow-hidden">
      <div className={`${gradient} text-white px-3 py-1.5 text-xs font-semibold`}>{title}</div>
      <div className="overflow-x-auto crm-scroll">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="bg-[#f1f3f4]">
              <th className="border border-[#dadce0] px-2 py-1 sticky left-0 z-10 bg-[#f1f3f4] min-w-32">Модель</th>
              {Array.from({ length: dim }, (_, i) => {
                const day = i + 1
                const dn = dayName(year, month, day)
                const isWeekend = dn === 'Сб' || dn === 'Вс'
                return (
                  <th key={day} className={`border border-[#dadce0] px-1 py-1 min-w-8 ${isWeekend ? 'bg-[#ffebee]' : ''}`}>
                    <div className="text-center font-semibold">{day}</div>
                    <div className="text-[9px] text-[#7f8c8d]">{dn}</div>
                  </th>
                )
              })}
              <th className="border border-[#dadce0] px-2 py-1 bg-[#e8f5e9] text-[#1e7e34]">Итого</th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={m} className="hover:bg-[#f8f9fa]">
                <td className="border border-[#e0e0e0] px-2 py-1 sticky left-0 bg-white font-medium">{m}</td>
                {Array.from({ length: dim }, (_, i) => {
                  const day = i + 1
                  const value = getCell(m, day)
                  const ck = getCommentKey(m, day)
                  const hasComment = !!comments[ck]
                  return (
                    <td
                      key={day}
                      className={`border border-[#e0e0e0] px-0 py-0 text-center tabular-nums relative ${hasComment ? 'crm-cell-has-comment' : ''}`}
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
                <td className="border border-[#e0e0e0] px-2 py-1 text-center bg-[#e8f5e9] text-[#1e7e34] font-bold tabular-nums">
                  {totalsByModel(m)}
                </td>
              </tr>
            ))}

            {/* Total row */}
            <tr className="bg-[#e8f0fe] font-bold">
              <td className="border border-[#dadce0] px-2 py-1 sticky left-0 bg-[#e8f0fe]">ИТОГО</td>
              {Array.from({ length: dim }, (_, i) => {
                const day = i + 1
                return <td key={day} className="border border-[#dadce0] px-1 py-1 text-center tabular-nums">{totalsByDay[day]}</td>
              })}
              <td className="border border-[#dadce0] px-2 py-1 text-center bg-[#28a745] text-white tabular-nums">{totalSum}</td>
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
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
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
