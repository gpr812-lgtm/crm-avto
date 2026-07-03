'use client'

import { useEffect, useMemo, useState } from 'react'
import { useCrmStore } from '@/lib/store'
import { api, type PlanFactResponse } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Settings, Plus, Trash2, Download, ChevronLeft, ChevronRight, Save } from 'lucide-react'
import { monthKey, daysInMonth, dayName, formatNumber } from '@/lib/utils-crm'
import { toast } from 'sonner'
import type { Channel } from '@/lib/types'

const GROUPS = ['Digital', 'Классифайды', 'Геосервисы и SERM', 'Direct', 'Offline', 'Обязательное', 'Прочее']

// ============================
// Formulas (matching Excel file exactly)
// ============================
// Excel structure:
//   ПЛАН:  Бюджет (input) | CPL = Бюджет/РЛ | РЛ (input) | SR% (input)
//   Days:  1..31 (input leads per day)
//   ФАКТ:  Бюджет (=plan) | CPL = Бюджет/ΣЛ | РЛ = SUM(days) | SR% = К.факт/ΣЛ | Контракты (input) | Выдачи (input)
//
// In Excel "РЛ" in fact section is actually Σ leads (sum of days, mislabeled)

function calcPlanCPL(budget: number, rl: number): number {
  return rl > 0 ? budget / rl : 0
}
function calcTotalLeads(days: Record<number, number>): number {
  return Object.values(days).reduce((s, v) => s + v, 0)
}
function calcFactCPL(budget: number, totalLeads: number): number {
  return totalLeads > 0 ? budget / totalLeads : 0
}
function calcFactSR(contractsFact: number, totalLeads: number): number {
  return contractsFact > 0 && totalLeads > 0 ? (contractsFact / totalLeads) * 100 : 0
}

export function PlanFactTab() {
  const { channels, loadChannels, addChannel, editChannel, removeChannel } = useCrmStore()

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)

  const [data, setData] = useState<PlanFactResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [factContracts, setFactContracts] = useState(0)
  const [factIssued, setFactIssued] = useState(0)

  const mk = monthKey(year, month)
  const dim = daysInMonth(year, month)

  useEffect(() => {
    let cancelled = false
    Promise.all([api.getPlanFact(mk), loadChannels()]).then(([res]) => {
      if (cancelled) return
      setData(res)
      setFactContracts(res.fact.contracts)
      setFactIssued(res.fact.issued)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [mk, loadChannels])

  const groupedChannels = useMemo(() => {
    const out: Record<string, Channel[]> = {}
    for (const ch of channels) {
      if (!out[ch.group]) out[ch.group] = []
      out[ch.group].push(ch)
    }
    return out
  }, [channels])

  const getPlan = (channelName: string) => {
    return data?.plan[channelName] ?? { days: {}, budget: 0, cpl: 0, rl: 0, sr: 0 }
  }

  const updateDay = async (channel: string, day: number, leads: number) => {
    setData((prev) => {
      if (!prev) return prev
      const cur = prev.plan[channel] ?? { days: {}, budget: 0, cpl: 0, rl: 0, sr: 0 }
      return {
        ...prev,
        plan: { ...prev.plan, [channel]: { ...cur, days: { ...cur.days, [day]: leads } } },
      }
    })
    try {
      await api.updatePlanDay({ monthKey: mk, channel, day, leads })
    } catch (e) {
      toast.error('Не удалось сохранить значение')
    }
  }

  const updateParam = async (channel: string, field: 'budget' | 'cpl' | 'rl' | 'sr', value: number) => {
    setData((prev) => {
      if (!prev) return prev
      const cur = prev.plan[channel] ?? { days: {}, budget: 0, cpl: 0, rl: 0, sr: 0 }
      return {
        ...prev,
        plan: { ...prev.plan, [channel]: { ...cur, [field]: value } },
      }
    })
    try {
      await api.updatePlanChannelParam({ monthKey: mk, channel, [field]: value })
    } catch (e) {
      toast.error('Не удалось сохранить параметр')
    }
  }

  const saveFact = async () => {
    try {
      await api.updateFact(mk, { contracts: factContracts, issued: factIssued })
      toast.success('Факт сохранён')
    } catch (e) {
      toast.error('Не удалось сохранить факт')
    }
  }

  // Compute grand totals — matches Excel column formulas
  const grandTotals = useMemo(() => {
    let budget = 0, totalLeads = 0
    for (const ch of channels) {
      const p = getPlan(ch.name)
      budget += p.budget
      totalLeads += calcTotalLeads(p.days)
    }
    const factCpl = calcFactCPL(budget, totalLeads)
    const factSR = calcFactSR(factContracts, totalLeads)
    return { budget, totalLeads, factCpl, factSR, factContracts, factIssued }
  }, [channels, data, factContracts, factIssued, getPlan])

  const exportExcel = () => {
    const headers = [
      'Канал', 'Группа',
      'Бюджет', 'CPL (план)', 'РЛ', 'SR%',
      ...Array.from({ length: dim }, (_, i) => String(i + 1)),
      'Бюджет', 'CPL (факт)', 'ΣЛ', 'SR% (факт)', 'Контракты (факт)', 'Выдачи (факт)',
    ]
    const rows: string[][] = [headers]
    for (const ch of channels) {
      const p = getPlan(ch.name)
      const tl = calcTotalLeads(p.days)
      const planCpl = calcPlanCPL(p.budget, p.rl)
      const factCpl = calcFactCPL(p.budget, tl)
      const factSr = calcFactSR(0, tl) // per-channel fact not tracked
      rows.push([
        ch.name, ch.group,
        String(p.budget), planCpl.toFixed(2), String(p.rl), String(p.sr),
        ...Array.from({ length: dim }, (_, i) => String(p.days[i + 1] ?? 0)),
        String(p.budget), factCpl.toFixed(2), String(tl), `${factSr.toFixed(1)}%`, '0', '0',
      ])
    }
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"></head><body><table border="1"><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `plan-fact-${mk}.xls`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success('Excel экспортирован')
  }

  const prevMonth = () => { if (month === 1) { setYear(year - 1); setMonth(12) } else setMonth(month - 1) }
  const nextMonth = () => { if (month === 12) { setYear(year + 1); setMonth(1) } else setMonth(month + 1) }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="bg-white border-b border-[hsl(220,16%,90%)] px-3 py-2 flex items-center gap-3 flex-wrap text-xs flex-shrink-0">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={prevMonth} className="h-7 w-7 p-0"><ChevronLeft className="w-4 h-4" /></Button>
          <span className="font-semibold min-w-32 text-center">
            {['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][month - 1]} {year}
          </span>
          <Button size="sm" variant="ghost" onClick={nextMonth} className="h-7 w-7 p-0"><ChevronRight className="w-4 h-4" /></Button>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="bg-[hsl(220,20%,95%)]">Бюджет: {formatNumber(grandTotals.budget)} ₽</Badge>
          <Badge variant="outline" className="bg-[hsl(220,20%,95%)]">ΣЛ: {grandTotals.totalLeads}</Badge>
          <Badge className="bg-[hsl(142,60%,35%)] hover:bg-[hsl(142,60%,35%)]">К.факт: {grandTotals.factContracts}</Badge>
          <Badge className="bg-[hsl(217,91%,45%)] hover:bg-[hsl(217,91%,45%)]">В.факт: {grandTotals.factIssued}</Badge>
          <Badge className="bg-[hsl(38,90%,40%)] hover:bg-[hsl(38,90%,40%)]">SR%: {grandTotals.factSR.toFixed(1)}%</Badge>
        </div>

        <div className="flex-1" />
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSettingsOpen(true)}>
          <Settings className="w-3 h-3 mr-1" /> Каналы
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={exportExcel}>
          <Download className="w-3 h-3 mr-1" /> Excel
        </Button>
      </div>

      {/* Plan/Fact table — compact, fits 1280px+ */}
      <div className="flex-1 overflow-auto crm-scroll p-2">
        <div className="bg-white rounded-lg border border-[hsl(220,16%,90%)] overflow-hidden crm-card-shadow">
          <div className="crm-header-gradient text-white px-3 py-1.5 text-xs font-semibold">
            📋 План/Факт — {['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][month - 1]} {year}
          </div>
          <div className="overflow-x-auto crm-scroll">
            <table className="text-[10px] border-collapse crm-table" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '110px' }} />
                <col style={{ width: '55px' }} />
                <col style={{ width: '45px' }} />
                <col style={{ width: '30px' }} />
                <col style={{ width: '35px' }} />
                {Array.from({ length: dim }, (_, i) => <col key={i} style={{ width: '22px' }} />)}
                <col style={{ width: '40px' }} />
                <col style={{ width: '40px' }} />
                <col style={{ width: '30px' }} />
                <col style={{ width: '35px' }} />
                <col style={{ width: '38px' }} />
                <col style={{ width: '38px' }} />
              </colgroup>
              <thead>
                <tr className="bg-[hsl(220,20%,96%)]">
                  <th rowSpan={2} className="border border-[hsl(220,16%,90%)] px-1 py-1 sticky left-0 z-10 bg-[hsl(224,56%,25%)] text-white text-left">Канал</th>
                  <th colSpan={4} className="border border-[hsl(220,16%,90%)] px-1 py-1 bg-[hsl(224,56%,25%)] text-white">ПЛАН</th>
                  <th colSpan={dim} className="border border-[hsl(220,16%,90%)] px-1 py-1 bg-[hsl(221,60%,38%)] text-white">ПЛАН (по дням)</th>
                  <th colSpan={6} className="border border-[hsl(220,16%,90%)] px-1 py-1 bg-[hsl(289,60%,45%)] text-white">ФАКТ</th>
                </tr>
                <tr className="bg-[hsl(220,20%,96%)] text-[9px]">
                  <th className="border border-[hsl(220,16%,90%)] px-0.5 py-1 bg-[hsl(224,56%,25%)] text-white">Бюдж</th>
                  <th className="border border-[hsl(220,16%,90%)] px-0.5 py-1 bg-[hsl(224,56%,25%)] text-white">CPL</th>
                  <th className="border border-[hsl(220,16%,90%)] px-0.5 py-1 bg-[hsl(224,56%,25%)] text-white">РЛ</th>
                  <th className="border border-[hsl(220,16%,90%)] px-0.5 py-1 bg-[hsl(224,56%,25%)] text-white">SR%</th>
                  {Array.from({ length: dim }, (_, i) => {
                    const day = i + 1
                    const dn = dayName(year, month, day)
                    const isWeekend = dn === 'Сб' || dn === 'Вс'
                    return (
                      <th key={day} className={`border border-[hsl(220,16%,90%)] px-0 py-0.5 ${isWeekend ? 'bg-[hsl(0,70%,97%)]' : ''}`}>
                        <div className="text-center leading-none">{day}</div>
                        <div className="text-[7px] text-[hsl(215,16%,60%)] leading-none">{dn}</div>
                      </th>
                    )
                  })}
                  <th className="border border-[hsl(220,16%,90%)] px-0.5 py-1 bg-[hsl(289,60%,45%)] text-white">Бюдж</th>
                  <th className="border border-[hsl(220,16%,90%)] px-0.5 py-1 bg-[hsl(289,60%,45%)] text-white">CPL</th>
                  <th className="border border-[hsl(220,16%,90%)] px-0.5 py-1 bg-[hsl(289,60%,45%)] text-white">ΣЛ</th>
                  <th className="border border-[hsl(220,16%,90%)] px-0.5 py-1 bg-[hsl(289,60%,45%)] text-white">SR%</th>
                  <th className="border border-[hsl(220,16%,90%)] px-0.5 py-1 bg-[hsl(142,60%,35%)] text-white">К.</th>
                  <th className="border border-[hsl(220,16%,90%)] px-0.5 py-1 bg-[hsl(217,91%,45%)] text-white">В.</th>
                </tr>
              </thead>
              <tbody>
                {GROUPS.map((group) => {
                  const chs = groupedChannels[group] ?? []
                  if (chs.length === 0) return null
                  let gBudget = 0, gLeads = 0
                  for (const ch of chs) {
                    const p = getPlan(ch.name)
                    gBudget += p.budget
                    gLeads += calcTotalLeads(p.days)
                  }
                  return (
                    <FragmentGroup
                      key={group}
                      group={group}
                      channels={chs}
                      dim={dim}
                      year={year}
                      month={month}
                      getPlan={getPlan}
                      onUpdateDay={updateDay}
                      onUpdateParam={updateParam}
                      groupBudget={gBudget}
                      groupLeads={gLeads}
                    />
                  )
                })}

                {/* Grand total */}
                <tr className="bg-[hsl(217,91%,95%)] font-bold">
                  <td className="border border-[hsl(220,16%,90%)] px-2 py-1 sticky left-0 bg-[hsl(217,91%,95%)]">ИТОГО</td>
                  <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center tabular-nums">{formatNumber(grandTotals.budget)}</td>
                  <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center tabular-nums text-[hsl(215,16%,47%)]">—</td>
                  <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center tabular-nums">{grandTotals.totalLeads}</td>
                  <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center tabular-nums text-[hsl(215,16%,47%)]">—</td>
                  {Array.from({ length: dim }, (_, i) => {
                    const day = i + 1
                    let sum = 0
                    for (const ch of channels) sum += getPlan(ch.name).days[day] ?? 0
                    return <td key={day} className="border border-[hsl(220,16%,90%)] px-0.5 py-1 text-center tabular-nums">{sum || ''}</td>
                  })}
                  <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center bg-[hsl(289,60%,90%)] tabular-nums">{formatNumber(grandTotals.budget)}</td>
                  <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center bg-[hsl(289,60%,90%)] tabular-nums">
                    {grandTotals.factCpl > 0 ? formatNumber(Math.round(grandTotals.factCpl)) : '—'}
                  </td>
                  <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center bg-[hsl(289,60%,90%)] tabular-nums">{grandTotals.totalLeads}</td>
                  <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center bg-[hsl(38,90%,90%)] tabular-nums">{grandTotals.factSR.toFixed(1)}%</td>
                  <td colSpan={2} className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center">
                    <div className="flex items-center gap-1 justify-center">
                      <Input
                        type="number"
                        value={factContracts}
                        onChange={(e) => setFactContracts(Number(e.target.value) || 0)}
                        className="h-6 w-14 text-[10px]"
                        placeholder="К"
                      />
                      <Input
                        type="number"
                        value={factIssued}
                        onChange={(e) => setFactIssued(Number(e.target.value) || 0)}
                        className="h-6 w-14 text-[10px]"
                        placeholder="В"
                      />
                      <Button size="sm" onClick={saveFact} className="h-6 px-2 text-[10px]">
                        <Save className="w-2.5 h-2.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Formula legend */}
        <div className="mt-2 bg-[hsl(220,20%,98%)] border border-[hsl(220,16%,90%)] rounded p-2 text-[10px] text-[hsl(215,16%,47%)] flex items-center gap-3 flex-wrap">
          <span className="font-semibold text-[hsl(215,28%,22%)]">📐 Формулы (по Excel):</span>
          <span><code className="bg-white px-1 rounded">CPL (план) = Бюджет / РЛ</code></span>
          <span><code className="bg-white px-1 rounded">ΣЛ = SUM(дней)</code></span>
          <span><code className="bg-white px-1 rounded">CPL (факт) = Бюджет / ΣЛ</code></span>
          <span><code className="bg-white px-1 rounded">SR% (факт) = К.факт / ΣЛ × 100</code></span>
          <span className="text-[hsl(142,60%,35%)]"><code className="bg-white px-1 rounded">К.факт, В.факт — вводятся вручную</code></span>
        </div>
      </div>

      <ChannelsSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}

interface FragmentGroupProps {
  group: string
  channels: Channel[]
  dim: number
  year: number
  month: number
  getPlan: (name: string) => { days: Record<number, number>; budget: number; cpl: number; rl: number; sr: number }
  onUpdateDay: (channel: string, day: number, leads: number) => void
  onUpdateParam: (channel: string, field: 'budget' | 'cpl' | 'rl' | 'sr', value: number) => void
  groupBudget: number
  groupLeads: number
}

function FragmentGroup({
  group, channels, dim, year, month, getPlan, onUpdateDay, onUpdateParam,
  groupBudget, groupLeads,
}: FragmentGroupProps) {
  const totalCols = 1 + 4 + dim + 6
  return (
    <>
      <tr className="bg-[hsl(224,56%,25%)] text-white font-semibold">
        <td colSpan={totalCols} className="border border-[hsl(220,16%,90%)] px-2 py-1 sticky left-0 bg-[hsl(224,56%,25%)]">
          {group}
        </td>
      </tr>
      {channels.map((ch) => {
        const p = getPlan(ch.name)
        const totalLeads = calcTotalLeads(p.days)
        const planCpl = calcPlanCPL(p.budget, p.rl)
        const factCpl = calcFactCPL(p.budget, totalLeads)
        // Per-channel fact contracts/issued not tracked (only grand total) — show dash
        return (
          <tr key={ch.id} className="hover:bg-[hsl(220,23%,97%)]">
            <td className="border border-[hsl(220,16%,90%)] px-1 py-0.5 sticky left-0 bg-white truncate" title={ch.name}>{ch.name}</td>
            {/* ПЛАН */}
            <ParamCell value={p.budget} onCommit={(v) => onUpdateParam(ch.name, 'budget', v)} />
            <ComputedCell value={planCpl} title={`= ${p.budget} / ${p.rl}`} />
            <ParamCell value={p.rl} onCommit={(v) => onUpdateParam(ch.name, 'rl', v)} />
            <ParamCell value={p.sr} onCommit={(v) => onUpdateParam(ch.name, 'sr', v)} suffix="%" />
            {/* Days */}
            {Array.from({ length: dim }, (_, i) => {
              const day = i + 1
              return (
                <td key={day} className="border border-[hsl(220,16%,90%)] px-0 py-0 text-center">
                  <DayCell value={p.days[day] ?? 0} onCommit={(v) => onUpdateDay(ch.name, day, v)} />
                </td>
              )
            })}
            {/* ФАКТ */}
            <td className="border border-[hsl(220,16%,90%)] px-1 py-0.5 text-center bg-[hsl(289,60%,95%)] tabular-nums" title="Бюджет = план">{formatNumber(p.budget)}</td>
            <td className="border border-[hsl(220,16%,90%)] px-1 py-0.5 text-center bg-[hsl(289,60%,95%)] tabular-nums" title={`= ${p.budget} / ${totalLeads}`}>
              {factCpl > 0 ? formatNumber(Math.round(factCpl)) : '—'}
            </td>
            <td className="border border-[hsl(220,16%,90%)] px-1 py-0.5 text-center bg-[hsl(289,60%,95%)] tabular-nums font-semibold" title="= Σ дней">{totalLeads || ''}</td>
            <td className="border border-[hsl(220,16%,90%)] px-1 py-0.5 text-center bg-[hsl(220,20%,98%)] tabular-nums text-[hsl(215,16%,47%)]" title="SR% факт — на уровне итога">—</td>
            <td className="border border-[hsl(220,16%,90%)] px-1 py-0.5 text-center bg-[hsl(220,20%,98%)] tabular-nums text-[hsl(215,16%,47%)]">—</td>
            <td className="border border-[hsl(220,16%,90%)] px-1 py-0.5 text-center bg-[hsl(220,20%,98%)] tabular-nums text-[hsl(215,16%,47%)]">—</td>
          </tr>
        )
      })}
      <tr className="bg-[hsl(220,20%,96%)] font-medium">
        <td className="border border-[hsl(220,16%,90%)] px-2 py-1 sticky left-0 bg-[hsl(220,20%,96%)]">Σ {group}</td>
        <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center tabular-nums">{formatNumber(groupBudget)}</td>
        <td className="border border-[hsl(220,16%,90%)] px-1 py-1"></td>
        <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center tabular-nums">{groupLeads}</td>
        <td className="border border-[hsl(220,16%,90%)] px-1 py-1"></td>
        {Array.from({ length: dim }, (_, i) => <td key={i} className="border border-[hsl(220,16%,90%)] px-0.5 py-1"></td>)}
        <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center bg-[hsl(289,60%,90%)] tabular-nums">{formatNumber(groupBudget)}</td>
        <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center bg-[hsl(289,60%,90%)] tabular-nums">
          {groupLeads > 0 ? formatNumber(Math.round(groupBudget / groupLeads)) : ''}
        </td>
        <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center bg-[hsl(289,60%,90%)] tabular-nums">{groupLeads}</td>
        <td colSpan={3} className="border border-[hsl(220,16%,90%)]"></td>
      </tr>
    </>
  )
}

function ParamCell({ value, onCommit, suffix }: { value: number; onCommit: (v: number) => void; suffix?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  if (editing) {
    return (
      <td className="border border-[hsl(220,16%,90%)] p-0">
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
          className="w-full h-5 px-0.5 text-[10px] text-center border border-[hsl(221,60%,38%)] rounded focus:outline-none"
        />
      </td>
    )
  }
  return (
    <td
      className="border border-[hsl(220,16%,90%)] px-0.5 py-0.5 text-center tabular-nums cursor-text hover:bg-[hsl(217,91%,95%)]"
      onClick={() => { setDraft(String(value)); setEditing(true) }}
      title="Клик для редактирования"
    >
      {value || ''}{suffix && value ? suffix : ''}
    </td>
  )
}

function ComputedCell({ value, title }: { value: number; title?: string }) {
  return (
    <td
      className="border border-[hsl(220,16%,90%)] px-0.5 py-0.5 text-center tabular-nums bg-[hsl(220,20%,98%)] text-[hsl(215,16%,47%)] italic"
      title={title}
    >
      {value > 0 ? formatNumber(Math.round(value)) : ''}
    </td>
  )
}

function DayCell({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
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
        className="w-full h-5 px-0 text-[10px] text-center border border-[hsl(221,60%,38%)] rounded focus:outline-none"
      />
    )
  }
  return (
    <span
      className="block w-full h-5 leading-5 cursor-text tabular-nums"
      onClick={() => { setDraft(String(value)); setEditing(true) }}
    >
      {value || ''}
    </span>
  )
}

// ============================
// Channels Settings Dialog
// ============================
function ChannelsSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { channels, addChannel, editChannel, removeChannel } = useCrmStore()
  const [newName, setNewName] = useState('')
  const [newGroup, setNewGroup] = useState('Digital')
  const [newBudget, setNewBudget] = useState(0)
  const [newCpl, setNewCpl] = useState(0)
  const [newRl, setNewRl] = useState(0)
  const [newSr, setNewSr] = useState(0)

  const grouped = useMemo(() => {
    const out: Record<string, Channel[]> = {}
    for (const ch of channels) {
      if (!out[ch.group]) out[ch.group] = []
      out[ch.group].push(ch)
    }
    return out
  }, [channels])

  const handleAdd = async () => {
    if (!newName.trim()) {
      toast.warning('Введите название канала')
      return
    }
    await addChannel({ name: newName.trim(), group: newGroup, budget: newBudget, cpl: newCpl, rl: newRl, sr: newSr })
    toast.success('Канал добавлен')
    setNewName('')
    setNewBudget(0); setNewCpl(0); setNewRl(0); setNewSr(0)
  }

  const handleEdit = async (ch: Channel) => {
    const newName = prompt('Новое название канала:', ch.name)
    if (newName && newName !== ch.name) {
      await editChannel(ch.id, { name: newName })
      toast.success('Канал переименован')
    }
  }

  const handleDelete = async (ch: Channel) => {
    if (!confirm(`Удалить канал "${ch.name}"?\nВсе плановые данные по этому каналу также будут удалены.`)) return
    await removeChannel(ch.id)
    toast.success('Канал удалён')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>⚙️ Управление каналами</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Add new channel form */}
          <div className="border border-[hsl(220,16%,90%)] rounded p-3 bg-[hsl(220,20%,98%)]">
            <div className="text-xs font-semibold mb-2">➕ Добавить канал</div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <Label className="text-[10px]">Название</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="h-8 text-xs" placeholder="Например: Авито" />
              </div>
              <div>
                <Label className="text-[10px]">Группа</Label>
                <Select value={newGroup} onValueChange={setNewGroup}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px]">Бюджет (₽)</Label>
                <Input type="number" value={newBudget} onChange={(e) => setNewBudget(Number(e.target.value) || 0)} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[10px]">РЛ</Label>
                <Input type="number" value={newRl} onChange={(e) => setNewRl(Number(e.target.value) || 0)} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-[10px]">SR%</Label>
                <Input type="number" value={newSr} onChange={(e) => setNewSr(Number(e.target.value) || 0)} className="h-8 text-xs" />
              </div>
            </div>
            <Button size="sm" onClick={handleAdd} className="w-full h-8">
              <Plus className="w-3.5 h-3.5 mr-1" /> Добавить
            </Button>
          </div>

          {/* List of channels by group */}
          {GROUPS.map((g) => {
            const chs = grouped[g] ?? []
            if (chs.length === 0) return null
            return (
              <div key={g}>
                <div className="text-xs font-semibold bg-[hsl(224,56%,25%)] text-white px-2 py-1 rounded-t">{g}</div>
                <div className="border border-t-0 border-[hsl(220,16%,90%)] rounded-b divide-y">
                  {chs.map((ch) => (
                    <div key={ch.id} className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-[hsl(220,23%,98%)]">
                      <span className="flex-1 truncate">{ch.name}</span>
                      <span className="text-[hsl(215,16%,47%)]">Б: {formatNumber(ch.budget)}</span>
                      <span className="text-[hsl(215,16%,47%)]">РЛ: {ch.rl}</span>
                      <span className="text-[hsl(215,16%,47%)]">SR: {ch.sr}%</span>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleEdit(ch)}>✏️</Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-[hsl(0,72%,51%)]" onClick={() => handleDelete(ch)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Закрыть</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
