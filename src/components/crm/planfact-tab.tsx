'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
import type { Channel, Deal } from '@/lib/types'

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
  const { channels, loadChannels, addChannel, editChannel, removeChannel, deals } = useCrmStore()

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)

  const [data, setData] = useState<PlanFactResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const mk = monthKey(year, month)
  const dim = daysInMonth(year, month)

  useEffect(() => {
    let cancelled = false
    Promise.all([api.getPlanFact(mk), loadChannels()]).then(([res]) => {
      if (cancelled) return
      setData(res)
      setLoading(false)
      dataLoadedRef.current = true
    })
    return () => { cancelled = true }
  }, [mk, loadChannels])

  // Reload plan-fact data when channels change (e.g., after editing in Settings dialog)
  // Hash channels by id+budget+rl+sr+group+name to detect real changes
  const channelsHash = useMemo(() => {
    return channels.map((c) => `${c.id}:${c.name}:${c.group}:${c.budget}:${c.rl}:${c.sr}`).join('|')
  }, [channels])

  const dataLoadedRef = useRef(false)
  useEffect(() => {
    if (!dataLoadedRef.current) return
    let cancelled = false
    api.getPlanFact(mk).then((res) => {
      if (cancelled) return
      setData(res)
    })
    return () => { cancelled = true }
  }, [channelsHash, mk])

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

  const updateChannelFact = async (channel: string, field: 'contracts' | 'issued', value: number) => {
    setData((prev) => {
      if (!prev) return prev
      const cur = prev.channelFacts?.[channel] ?? { contracts: 0, issued: 0 }
      return {
        ...prev,
        channelFacts: { ...prev.channelFacts, [channel]: { ...cur, [field]: value } },
      }
    })
    try {
      await api.updateChannelFact({
        monthKey: mk,
        channel,
        ...(field === 'contracts' ? { channelFactContracts: value } : {}),
        ...(field === 'issued' ? { channelFactIssued: value } : {}),
      })
    } catch (e) {
      toast.error('Не удалось сохранить факт')
    }
  }

  // Compute grand totals — matches Excel column formulas
  // РЛ (plan) = sum of p.rl (NOT sum of days!)
  // ΣЛ (fact) = sum of days
  const grandTotals = useMemo(() => {
    let budget = 0, totalLeads = 0, totalRl = 0
    let factContractsSum = 0, factIssuedSum = 0
    for (const ch of channels) {
      const p = getPlan(ch.name)
      budget += p.budget
      totalLeads += calcTotalLeads(p.days)
      totalRl += p.rl
      const cf = data?.channelFacts?.[ch.name]
      factContractsSum += cf?.contracts ?? 0
      factIssuedSum += cf?.issued ?? 0
    }
    const planCpl = totalRl > 0 ? budget / totalRl : 0
    const factCpl = calcFactCPL(budget, totalLeads)
    const factSR = calcFactSR(factContractsSum, totalLeads)
    return {
      budget, totalLeads, totalRl,
      planCpl, factCpl, factSR,
      factContractsSum, factIssuedSum,
    }
  }, [channels, data, getPlan])

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
          <Badge variant="outline" className="bg-[hsl(220,20%,95%)]">РЛ: {grandTotals.totalRl}</Badge>
          <Badge variant="outline" className="bg-[hsl(220,20%,95%)]">ΣЛ: {grandTotals.totalLeads}</Badge>
          <Badge className="bg-[hsl(142,60%,35%)] hover:bg-[hsl(142,60%,35%)]">К.факт: {grandTotals.factContractsSum}</Badge>
          <Badge className="bg-[hsl(217,91%,45%)] hover:bg-[hsl(217,91%,45%)]">В.факт: {grandTotals.factIssuedSum}</Badge>
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

      {/* Plan/Fact table — full width, edge to edge */}
      <div className="flex-1 overflow-auto crm-scroll">
        <div className="crm-header-gradient text-white px-3 py-1.5 text-xs font-semibold sticky top-0 z-20">
          📋 План/Факт — {['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][month - 1]} {year}
        </div>
        <div className="overflow-x-auto crm-scroll">
            <table className="text-[10px] border-collapse crm-table w-full" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '140px' }} />
                <col style={{ width: '70px' }} />
                <col style={{ width: '55px' }} />
                <col style={{ width: '40px' }} />
                <col style={{ width: '45px' }} />
                {Array.from({ length: dim }, (_, i) => <col key={i} />)}
                <col style={{ width: '50px' }} />
                <col style={{ width: '50px' }} />
                <col style={{ width: '40px' }} />
                <col style={{ width: '45px' }} />
                <col style={{ width: '50px' }} />
                <col style={{ width: '50px' }} />
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
                  let gBudget = 0, gLeads = 0, gRl = 0, gFactC = 0, gFactI = 0
                  for (const ch of chs) {
                    const p = getPlan(ch.name)
                    gBudget += p.budget
                    gLeads += calcTotalLeads(p.days)
                    gRl += p.rl
                    const cf = data?.channelFacts?.[ch.name]
                    gFactC += cf?.contracts ?? 0
                    gFactI += cf?.issued ?? 0
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
                      getChannelFact={(name) => data?.channelFacts?.[name] ?? { contracts: 0, issued: 0 }}
                      onUpdateDay={updateDay}
                      onUpdateParam={updateParam}
                      onUpdateChannelFact={updateChannelFact}
                      groupBudget={gBudget}
                      groupLeads={gLeads}
                      groupRl={gRl}
                      groupFactContracts={gFactC}
                      groupFactIssued={gFactI}
                    />
                  )
                })}

                {/* Grand total — РЛ (plan) = sum of p.rl; ΣЛ (fact) = sum of days */}
                <tr className="bg-[hsl(217,91%,95%)] font-bold">
                  <td className="border border-[hsl(220,16%,90%)] px-2 py-1 sticky left-0 bg-[hsl(217,91%,95%)]">ИТОГО</td>
                  <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center tabular-nums">{formatNumber(grandTotals.budget)}</td>
                  <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center tabular-nums text-[hsl(215,16%,47%)]" title={`= Бюджет / РЛ = ${grandTotals.budget} / ${grandTotals.totalRl}`}>
                    {grandTotals.planCpl > 0 ? formatNumber(Math.round(grandTotals.planCpl)) : '—'}
                  </td>
                  <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center tabular-nums" title="Сумма РЛ по всем каналам">{grandTotals.totalRl}</td>
                  <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center tabular-nums text-[hsl(215,16%,47%)]">—</td>
                  {Array.from({ length: dim }, (_, i) => {
                    const day = i + 1
                    let sum = 0
                    for (const ch of channels) sum += getPlan(ch.name).days[day] ?? 0
                    return <td key={day} className="border border-[hsl(220,16%,90%)] px-0.5 py-1 text-center tabular-nums">{sum || ''}</td>
                  })}
                  <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center bg-[hsl(289,60%,90%)] tabular-nums">{formatNumber(grandTotals.budget)}</td>
                  <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center bg-[hsl(289,60%,90%)] tabular-nums" title={`= Бюджет / ΣЛ = ${grandTotals.budget} / ${grandTotals.totalLeads}`}>
                    {grandTotals.factCpl > 0 ? formatNumber(Math.round(grandTotals.factCpl)) : '—'}
                  </td>
                  <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center bg-[hsl(289,60%,90%)] tabular-nums" title="Сумма дней по всем каналам">{grandTotals.totalLeads}</td>
                  <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center bg-[hsl(38,90%,90%)] tabular-nums" title={`= К.факт / ΣЛ = ${grandTotals.factContractsSum} / ${grandTotals.totalLeads}`}>
                    {grandTotals.factSR.toFixed(1)}%
                  </td>
                  <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center bg-[hsl(142,60%,90%)] tabular-nums" title="Сумма К. по каналам">{grandTotals.factContractsSum}</td>
                  <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center bg-[hsl(217,91%,90%)] tabular-nums" title="Сумма В. по каналам">{grandTotals.factIssuedSum}</td>
                </tr>
              </tbody>
            </table>
          </div>

        {/* Formula legend */}
        <div className="bg-[hsl(220,20%,98%)] border-t border-[hsl(220,16%,90%)] px-3 py-1.5 text-[10px] text-[hsl(215,16%,47%)] flex items-center gap-3 flex-wrap">
          <span className="font-semibold text-[hsl(215,28%,22%)]">📐 Формулы (по Excel):</span>
          <span><code className="bg-white px-1 rounded">CPL (план) = Бюджет / РЛ</code></span>
          <span><code className="bg-white px-1 rounded">ΣЛ = SUM(дней)</code></span>
          <span><code className="bg-white px-1 rounded">CPL (факт) = Бюджет / ΣЛ</code></span>
          <span><code className="bg-white px-1 rounded">SR% (факт) = К.факт / ΣЛ × 100</code></span>
          <span className="text-[hsl(142,60%,35%)]"><code className="bg-white px-1 rounded">К.факт, В.факт — вводятся вручную</code></span>
        </div>

        {/* New: План/Факт по показателям — summary table */}
        <PlanFactSummaryTable
          monthKey={mk}
          planFactData={data}
          skladDeals={deals}
          onPlanUpdated={(field, value) => {
            setData((prev) => {
              if (!prev) return prev
              return {
                ...prev,
                fact: { ...prev.fact, [field]: value },
              }
            })
          }}
        />
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
  getChannelFact: (name: string) => { contracts: number; issued: number }
  onUpdateDay: (channel: string, day: number, leads: number) => void
  onUpdateParam: (channel: string, field: 'budget' | 'cpl' | 'rl' | 'sr', value: number) => void
  onUpdateChannelFact: (channel: string, field: 'contracts' | 'issued', value: number) => void
  groupBudget: number
  groupLeads: number
  groupRl: number
  groupFactContracts: number
  groupFactIssued: number
}

function FragmentGroup({
  group, channels, dim, year, month, getPlan, getChannelFact, onUpdateDay, onUpdateParam, onUpdateChannelFact,
  groupBudget, groupLeads, groupRl, groupFactContracts, groupFactIssued,
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
        const cf = getChannelFact(ch.name)
        const totalLeads = calcTotalLeads(p.days)
        const planCpl = calcPlanCPL(p.budget, p.rl)
        const factCpl = calcFactCPL(p.budget, totalLeads)
        const factSr = calcFactSR(cf.contracts, totalLeads)
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
            <td className="border border-[hsl(220,16%,90%)] px-1 py-0.5 text-center bg-[hsl(38,90%,90%)] tabular-nums" title={`= ${cf.contracts} / ${totalLeads} × 100`}>
              {factSr > 0 ? `${factSr.toFixed(1)}%` : '—'}
            </td>
            {/* К. and В. — manual input per channel */}
            <ParamCell value={cf.contracts} onCommit={(v) => onUpdateChannelFact(ch.name, 'contracts', v)} />
            <ParamCell value={cf.issued} onCommit={(v) => onUpdateChannelFact(ch.name, 'issued', v)} />
          </tr>
        )
      })}
      <tr className="bg-[hsl(220,20%,96%)] font-medium">
        <td className="border border-[hsl(220,16%,90%)] px-2 py-1 sticky left-0 bg-[hsl(220,20%,96%)]">Σ {group}</td>
        <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center tabular-nums">{formatNumber(groupBudget)}</td>
        <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center tabular-nums text-[hsl(215,16%,47%)]">
          {groupRl > 0 ? formatNumber(Math.round(groupBudget / groupRl)) : ''}
        </td>
        <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center tabular-nums">{groupRl}</td>
        <td className="border border-[hsl(220,16%,90%)] px-1 py-1"></td>
        {Array.from({ length: dim }, (_, i) => <td key={i} className="border border-[hsl(220,16%,90%)] px-0.5 py-1"></td>)}
        <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center bg-[hsl(289,60%,90%)] tabular-nums">{formatNumber(groupBudget)}</td>
        <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center bg-[hsl(289,60%,90%)] tabular-nums">
          {groupLeads > 0 ? formatNumber(Math.round(groupBudget / groupLeads)) : ''}
        </td>
        <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center bg-[hsl(289,60%,90%)] tabular-nums">{groupLeads}</td>
        <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center bg-[hsl(38,90%,90%)] tabular-nums">
          {groupLeads > 0 && groupFactContracts > 0 ? `${(groupFactContracts / groupLeads * 100).toFixed(1)}%` : '—'}
        </td>
        <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center bg-[hsl(142,60%,90%)] tabular-nums">{groupFactContracts}</td>
        <td className="border border-[hsl(220,16%,90%)] px-1 py-1 text-center bg-[hsl(217,91%,90%)] tabular-nums">{groupFactIssued}</td>
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
// Channels Settings Dialog — full CRUD with inline editing
// ============================
function ChannelsSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { channels, addChannel, editChannel, removeChannel } = useCrmStore()
  const [newName, setNewName] = useState('')
  const [newGroup, setNewGroup] = useState('Digital')
  const [newBudget, setNewBudget] = useState(0)
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
    await addChannel({ name: newName.trim(), group: newGroup, budget: newBudget, cpl: 0, rl: newRl, sr: newSr })
    toast.success(`Канал "${newName.trim()}" добавлен`)
    setNewName('')
    setNewBudget(0); setNewRl(0); setNewSr(0)
  }

  const handleDelete = async (ch: Channel) => {
    if (!confirm(`Удалить канал "${ch.name}"?\n\nВсе плановые данные по этому каналу также будут удалены безвозвратно.`)) return
    await removeChannel(ch.id)
    toast.success(`Канал "${ch.name}" удалён`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Управление каналами трафика
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto crm-scroll pr-1 -mr-1 space-y-3">
          {/* Add new channel form */}
          <div className="border border-[hsl(221,60%,80%)] rounded-lg p-3 bg-[hsl(217,91%,97%)]">
            <div className="text-xs font-semibold mb-2 flex items-center gap-1 text-[hsl(221,60%,30%)]">
              <Plus className="w-3.5 h-3.5" /> Добавить новый канал
            </div>
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-4">
                <Label className="text-[10px] uppercase text-[hsl(215,16%,47%)]">Название</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="h-8 text-xs" placeholder="Например: Авито" />
              </div>
              <div className="col-span-3">
                <Label className="text-[10px] uppercase text-[hsl(215,16%,47%)]">Группа</Label>
                <Select value={newGroup} onValueChange={setNewGroup}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-[10px] uppercase text-[hsl(215,16%,47%)]">Бюджет ₽</Label>
                <Input type="number" value={newBudget} onChange={(e) => setNewBudget(Number(e.target.value) || 0)} className="h-8 text-xs" />
              </div>
              <div className="col-span-1">
                <Label className="text-[10px] uppercase text-[hsl(215,16%,47%)]">РЛ</Label>
                <Input type="number" value={newRl} onChange={(e) => setNewRl(Number(e.target.value) || 0)} className="h-8 text-xs" />
              </div>
              <div className="col-span-1">
                <Label className="text-[10px] uppercase text-[hsl(215,16%,47%)]">SR%</Label>
                <Input type="number" value={newSr} onChange={(e) => setNewSr(Number(e.target.value) || 0)} className="h-8 text-xs" />
              </div>
              <div className="col-span-1 flex items-end">
                <Button size="sm" onClick={handleAdd} className="w-full h-8" title="Добавить канал">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="text-[10px] text-[hsl(215,16%,60%)] mt-2">
              💡 CPL вычисляется автоматически = Бюджет / РЛ. Можно изменить позже в таблице.
            </div>
          </div>

          {/* List of channels by group with inline editing */}
          <div className="text-xs font-semibold text-[hsl(215,28%,22%)] mb-1">
            Существующие каналы ({channels.length})
          </div>
          {GROUPS.map((g) => {
            const chs = grouped[g] ?? []
            if (chs.length === 0) return null
            return (
              <div key={g} className="border border-[hsl(220,16%,90%)] rounded-lg overflow-hidden">
                <div className="text-xs font-semibold bg-[hsl(224,56%,25%)] text-white px-3 py-1.5 flex items-center justify-between">
                  <span>{g}</span>
                  <span className="text-[10px] opacity-70">{chs.length} канал(ов)</span>
                </div>
                <div className="divide-y">
                  {chs.map((ch) => (
                    <ChannelRow key={ch.id} channel={ch} onEdit={editChannel} onDelete={handleDelete} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <DialogFooter className="border-t pt-3">
          <div className="text-[10px] text-[hsl(215,16%,47%)] flex-1">
            💡 Все изменения (бюджет, РЛ, SR%) сохраняются автоматически и сразу применяются в таблице План/Факт
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Закрыть</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================
// ChannelRow — single channel with inline-editable fields
// ============================
function ChannelRow({ channel, onEdit, onDelete }: {
  channel: Channel
  onEdit: (id: number, updates: Partial<Channel>) => Promise<void>
  onDelete: (ch: Channel) => Promise<void>
}) {
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(channel.name)
  const [editingGroup, setEditingGroup] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const commitName = async () => {
    setEditingName(false)
    const trimmed = nameDraft.trim()
    if (trimmed && trimmed !== channel.name) {
      await onEdit(channel.id, { name: trimmed })
      toast.success(`Канал переименован: ${trimmed}`)
    } else {
      setNameDraft(channel.name)
    }
  }

  const commitField = async (field: 'budget' | 'rl' | 'sr', value: number) => {
    if (value === channel[field]) return
    await onEdit(channel.id, { [field]: value })
  }

  const commitGroup = async (newGroup: string) => {
    setEditingGroup(false)
    if (newGroup !== channel.group) {
      await onEdit(channel.id, { group: newGroup })
      toast.success(`Группа изменена: ${newGroup}`)
    }
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[hsl(220,23%,98%)]">
      {/* Name (click to edit) */}
      <div className="flex-1 min-w-0">
        {editingName ? (
          <input
            autoFocus
            type="text"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName()
              if (e.key === 'Escape') { setEditingName(false); setNameDraft(channel.name) }
            }}
            className="w-full h-6 px-1.5 text-xs border border-[hsl(221,60%,38%)] rounded focus:outline-none"
          />
        ) : (
          <span
            className="block truncate cursor-text hover:bg-[hsl(217,91%,95%)] px-1.5 py-0.5 rounded"
            onClick={() => { setNameDraft(channel.name); setEditingName(true) }}
            title="Клик для переименования"
          >
            {channel.name}
          </span>
        )}
      </div>

      {/* Group (click to change) */}
      {editingGroup ? (
        <select
          autoFocus
          value={channel.group}
          onChange={(e) => commitGroup(e.target.value)}
          onBlur={() => setEditingGroup(false)}
          className="h-6 px-1 text-[10px] border border-[hsl(221,60%,38%)] rounded focus:outline-none bg-white"
        >
          {GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      ) : (
        <button
          onClick={() => setEditingGroup(true)}
          className="text-[10px] text-[hsl(215,16%,47%)] hover:text-[hsl(221,60%,38%)] hover:underline px-1.5 py-0.5 rounded bg-[hsl(220,20%,95%)]"
          title="Клик для смены группы"
        >
          {channel.group}
        </button>
      )}

      {/* Budget */}
      <ChannelNumberField
        value={channel.budget}
        onCommit={(v) => commitField('budget', v)}
        format="currency"
        label="Бюдж"
      />
      {/* RL */}
      <ChannelNumberField
        value={channel.rl}
        onCommit={(v) => commitField('rl', v)}
        label="РЛ"
      />
      {/* SR */}
      <ChannelNumberField
        value={channel.sr}
        onCommit={(v) => commitField('sr', v)}
        suffix="%"
        label="SR"
      />

      {/* Delete button */}
      {confirmDelete ? (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="destructive" className="h-6 px-2 text-[10px]" onClick={() => onDelete(channel)}>
            <Trash2 className="w-3 h-3 mr-1" /> Да
          </Button>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setConfirmDelete(false)}>
            Нет
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-[hsl(0,72%,51%)] hover:bg-[hsl(0,70%,96%)]"
          onClick={() => setConfirmDelete(true)}
          title={`Удалить канал "${channel.name}"`}
          aria-label={`Удалить канал ${channel.name}`}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      )}
    </div>
  )
}

// Number field with inline editing
function ChannelNumberField({ value, onCommit, format, suffix, label }: {
  value: number
  onCommit: (v: number) => void
  format?: 'currency'
  suffix?: string
  label: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const display = format === 'currency' ? formatNumber(value) : String(value)

  if (editing) {
    return (
      <div className="flex flex-col">
        <span className="text-[8px] text-[hsl(215,16%,47%)] uppercase">{label}</span>
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
          className="w-16 h-6 px-1 text-[10px] text-right border border-[hsl(221,60%,38%)] rounded focus:outline-none"
        />
      </div>
    )
  }
  return (
    <div className="flex flex-col" title="Клик для редактирования">
      <span className="text-[8px] text-[hsl(215,16%,47%)] uppercase">{label}</span>
      <button
        onClick={() => { setDraft(String(value)); setEditing(true) }}
        className="text-[10px] text-right tabular-nums px-1 py-0.5 rounded hover:bg-[hsl(217,91%,95%)] cursor-text min-w-16"
      >
        {display}{suffix}
      </button>
    </div>
  )
}

// ============================
// PlanFactSummaryTable — План/Факт по показателям (Контракты, Выдачи, Ж/О/К/ЖОК, КР, ТИ)
// План — manual input (stored in FactEntry.planX fields)
// Факт — computed from Sklad deals for the month (excluding Отказ/Призрак/РИСК4)
// ============================
function PlanFactSummaryTable({
  monthKey: mk,
  planFactData,
  skladDeals,
  onPlanUpdated,
}: {
  monthKey: string
  planFactData: PlanFactResponse | null
  skladDeals: Deal[]
  onPlanUpdated?: (field: 'planContracts' | 'planIssued' | 'planJ' | 'planO' | 'planK' | 'planKr' | 'planTi', value: number) => void
}) {
  const [skladFact, setSkladFact] = useState<{
    contracts: number; issued: number; j: number; o: number; k: number; jok: number; kr: number; ti: number
  } | null>(null)

  // Fetch sklad fact for the month
  useEffect(() => {
    let cancelled = false
    api.getSkladMonthFact(mk).then((res) => {
      if (!cancelled) setSkladFact(res)
    })
    return () => { cancelled = true }
  }, [mk, skladDeals])

  const plan = planFactData?.fact ?? {
    planContracts: 0, planIssued: 0,
    planJ: 0, planO: 0, planK: 0,
    planKr: 0, planTi: 0,
    contracts: 0, issued: 0,
  }

  const fact = skladFact ?? { contracts: 0, issued: 0, j: 0, o: 0, k: 0, jok: 0, kr: 0, ti: 0 }

  // ЖОК plan = planJ + planO + planK
  const planJok = (plan.planJ || 0) + (plan.planO || 0) + (plan.planK || 0)

  type PlanField = 'planContracts' | 'planIssued' | 'planJ' | 'planO' | 'planK' | 'planKr' | 'planTi'

  const updatePlan = async (field: PlanField, value: number) => {
    try {
      await api.updateFact(mk, { [field]: value })
      // Optimistically update parent's planFactData via callback
      if (onPlanUpdated) {
        onPlanUpdated(field, value)
      }
    } catch (e) {
      toast.error('Не удалось сохранить план')
    }
  }

  const rows: { label: string; planValue: number; planField?: PlanField; factValue: number; isComputed?: boolean; format?: 'number' | 'currency' }[] = [
    { label: '📄 Контракты', planValue: plan.planContracts, planField: 'planContracts', factValue: fact.contracts },
    { label: '📤 Выдачи', planValue: plan.planIssued, planField: 'planIssued', factValue: fact.issued },
    { label: 'Ж', planValue: plan.planJ, planField: 'planJ', factValue: fact.j, format: 'currency' },
    { label: 'О', planValue: plan.planO, planField: 'planO', factValue: fact.o, format: 'currency' },
    { label: 'К', planValue: plan.planK, planField: 'planK', factValue: fact.k, format: 'currency' },
    { label: 'ЖОК', planValue: planJok, factValue: fact.jok, isComputed: true, format: 'currency' },
    { label: '💳 КР', planValue: plan.planKr, planField: 'planKr', factValue: fact.kr },
    { label: '🔗 ТИ', planValue: plan.planTi, planField: 'planTi', factValue: fact.ti },
  ]

  return (
    <div className="mt-3">
      <div className="crm-header-gradient text-white px-3 py-1.5 text-xs font-semibold">
        📊 План/Факт по показателям — {mk}
      </div>
      <table className="w-full text-xs border-collapse crm-table">
        <colgroup>
          <col style={{ width: '200px' }} />
          <col style={{ width: '150px' }} />
          <col style={{ width: '150px' }} />
          <col style={{ width: '120px' }} />
        </colgroup>
        <thead>
          <tr className="bg-[hsl(220,20%,96%)]">
            <th className="border border-[hsl(220,16%,90%)] px-2 py-1.5 text-left">Показатель</th>
            <th className="border border-[hsl(220,16%,90%)] px-2 py-1.5 bg-[hsl(224,56%,25%)] text-white">План</th>
            <th className="border border-[hsl(220,16%,90%)] px-2 py-1.5 bg-[hsl(289,60%,45%)] text-white">Факт (из Склада)</th>
            <th className="border border-[hsl(220,16%,90%)] px-2 py-1.5">% выполнения</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const pct = row.planValue > 0 ? (row.factValue / row.planValue) * 100 : 0
            const fmt = (v: number) => row.format === 'currency' ? formatNumber(v) : String(v)
            return (
              <tr key={row.label} className="hover:bg-[hsl(220,23%,97%)]">
                <td className="border border-[hsl(220,16%,90%)] px-2 py-1 font-medium">{row.label}</td>
                <td className="border border-[hsl(220,16%,90%)] px-1 py-0.5 text-center bg-[hsl(217,91%,95%)]">
                  {row.isComputed ? (
                    <span className="tabular-nums font-semibold text-[hsl(221,60%,30%)]" title="= Ж + О + К (авто-расчёт)">
                      {fmt(row.planValue)}
                    </span>
                  ) : row.planField ? (
                    <SummaryInput
                      value={row.planValue}
                      onCommit={(v) => updatePlan(row.planField!, v)}
                      format={row.format}
                    />
                  ) : (
                    <span className="tabular-nums">{fmt(row.planValue)}</span>
                  )}
                </td>
                <td className="border border-[hsl(220,16%,90%)] px-2 py-1 text-center bg-[hsl(289,60%,95%)] tabular-nums font-semibold">
                  {fmt(row.factValue)}
                </td>
                <td className={`border border-[hsl(220,16%,90%)] px-2 py-1 text-center tabular-nums ${pct >= 100 ? 'bg-[hsl(142,60%,90%)] text-[hsl(142,60%,25%)]' : pct >= 50 ? 'bg-[hsl(38,90%,90%)] text-[hsl(32,80%,30%)]' : pct > 0 ? 'bg-[hsl(0,70%,96%)] text-[hsl(0,70%,40%)]' : ''}`}>
                  {row.planValue > 0 ? `${pct.toFixed(0)}%` : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="bg-[hsl(220,20%,98%)] border-t border-[hsl(220,16%,90%)] px-3 py-1.5 text-[10px] text-[hsl(215,16%,47%)] flex items-center gap-3 flex-wrap">
        <span className="font-semibold text-[hsl(215,28%,22%)]">📐 Логика:</span>
        <span><code className="bg-white px-1 rounded">План — вводится вручную</code></span>
        <span><code className="bg-white px-1 rounded">Факт — из Склада (статус=Продан, дата ДКП в месяце)</code></span>
        <span><code className="bg-white px-1 rounded">ЖОК план = Ж + О + К (авто)</code></span>
        <span className="text-[hsl(0,70%,40%)]"><code className="bg-white px-1 rounded">Исключаются: Отказ, Призрак, РИСК=4</code></span>
      </div>
    </div>
  )
}

// Inline input for summary table plan values
function SummaryInput({ value, onCommit, format }: {
  value: number
  onCommit: (v: number) => void
  format?: 'currency' | 'number'
}) {
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
        className="w-full h-6 px-1 text-xs text-center border border-[hsl(221,60%,38%)] rounded focus:outline-none tabular-nums"
      />
    )
  }
  return (
    <span
      className="block w-full h-6 leading-6 cursor-text tabular-nums px-1 hover:bg-[hsl(217,91%,90%)] rounded"
      onClick={() => { setDraft(String(value)); setEditing(true) }}
      title="Клик для редактирования"
    >
      {format === 'currency' ? formatNumber(value) : value}
    </span>
  )
}
