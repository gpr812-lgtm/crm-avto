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

export function PlanFactTab() {
  const { channels, loadChannels, addChannel, editChannel, removeChannel } = useCrmStore()

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)

  const [data, setData] = useState<PlanFactResponse | null>(null)
  const [loading, setLoading] = useState(false)
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

  // Group channels by their group
  const groupedChannels = useMemo(() => {
    const out: Record<string, Channel[]> = {}
    for (const ch of channels) {
      if (!out[ch.group]) out[ch.group] = []
      out[ch.group].push(ch)
    }
    return out
  }, [channels])

  // Get plan for a channel
  const getPlan = (channelName: string) => {
    return data?.plan[channelName] ?? { days: {}, budget: 0, cpl: 0, rl: 0, sr: 0 }
  }

  // Update day leads
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

  // Update channel param (budget/cpl/rl/sr)
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

  // Save fact
  const saveFact = async () => {
    try {
      await api.updateFact(mk, { contracts: factContracts, issued: factIssued })
      toast.success('Факт сохранён')
    } catch (e) {
      toast.error('Не удалось сохранить факт')
    }
  }

  // Compute totals (direct computation, no useMemo — React Compiler handles memoization)
  let grandBudget = 0, grandLeads = 0, grandContracts = 0, grandIssued = 0
  for (const ch of channels) {
    const p = getPlan(ch.name)
    grandBudget += p.budget
    const totalLeads = Object.values(p.days).reduce((s, v) => s + v, 0)
    grandLeads += totalLeads
    grandContracts += Math.round((p.rl * p.sr) / 100)
    grandIssued += Math.round((totalLeads * p.sr) / 100)
  }
  const grandTotals = { budget: grandBudget, leads: grandLeads, contracts: grandContracts, issued: grandIssued }

  const exportExcel = () => {
    const headers = ['Канал', 'Группа', 'Бюджет', 'CPL', 'РЛ', 'SR%', ...Array.from({ length: dim }, (_, i) => String(i + 1)), 'Контр.(план)', 'Выдачи(план)']
    const rows: string[][] = [headers]
    for (const ch of channels) {
      const p = getPlan(ch.name)
      const totalLeads = Object.values(p.days).reduce((s, v) => s + v, 0)
      const planContracts = Math.round((p.rl * p.sr) / 100)
      const planIssued = Math.round((totalLeads * p.sr) / 100)
      rows.push([
        ch.name, ch.group,
        String(p.budget), String(p.cpl), String(p.rl), String(p.sr),
        ...Array.from({ length: dim }, (_, i) => String(p.days[i + 1] ?? 0)),
        String(planContracts), String(planIssued),
      ])
    }
    rows.push(['ИТОГО', '', String(grandTotals.budget), '', '', '', ...Array.from({ length: dim }, () => ''), String(grandTotals.contracts), String(grandTotals.issued)])
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
      <div className="bg-white border-b px-3 py-2 flex items-center gap-3 flex-wrap text-xs flex-shrink-0">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={prevMonth} className="h-7 w-7 p-0"><ChevronLeft className="w-4 h-4" /></Button>
          <span className="font-semibold min-w-32 text-center">
            {['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][month - 1]} {year}
          </span>
          <Button size="sm" variant="ghost" onClick={nextMonth} className="h-7 w-7 p-0"><ChevronRight className="w-4 h-4" /></Button>
        </div>

        <div className="flex gap-2">
          <Badge variant="outline">Бюджет: {formatNumber(grandTotals.budget)} ₽</Badge>
          <Badge variant="outline">Лиды: {grandTotals.leads}</Badge>
          <Badge className="bg-[#28a745] hover:bg-[#28a745]">Контр.(план): {grandTotals.contracts}</Badge>
          <Badge className="bg-[#1a73e8] hover:bg-[#1a73e8]">Выдачи(план): {grandTotals.issued}</Badge>
        </div>

        <div className="flex-1" />
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSettingsOpen(true)}>
          <Settings className="w-3 h-3 mr-1" /> Каналы
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={exportExcel}>
          <Download className="w-3 h-3 mr-1" /> Excel
        </Button>
      </div>

      {/* Plan/Fact table */}
      <div className="flex-1 overflow-auto crm-scroll p-2">
        <div className="bg-white rounded border border-[#e0e0e0] overflow-hidden">
          <div className="crm-header-gradient text-white px-3 py-1.5 text-xs font-semibold">
            📋 План/Факт — {['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][month - 1]} {year}
          </div>
          <div className="overflow-x-auto crm-scroll">
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr className="bg-[#f1f3f4]">
                  <th rowSpan={2} className="border border-[#dadce0] px-2 py-1 sticky left-0 z-10 bg-[#1e3c72] text-white min-w-32">Канал</th>
                  <th rowSpan={2} className="border border-[#dadce0] px-2 py-1 bg-[#1e3c72] text-white">Бюджет</th>
                  <th rowSpan={2} className="border border-[#dadce0] px-2 py-1 bg-[#1e3c72] text-white">CPL</th>
                  <th rowSpan={2} className="border border-[#dadce0] px-2 py-1 bg-[#1e3c72] text-white">РЛ</th>
                  <th rowSpan={2} className="border border-[#dadce0] px-2 py-1 bg-[#1e3c72] text-white">SR%</th>
                  <th colSpan={dim} className="border border-[#dadce0] px-2 py-1 bg-[#2a5298] text-white">ПЛАН (по дням)</th>
                  <th colSpan={2} className="border border-[#dadce0] px-2 py-1 bg-[#4a7bc7] text-white">ИТОГО</th>
                  <th colSpan={3} className="border border-[#dadce0] px-2 py-1 bg-[#1e3c72] text-white">ФАКТ</th>
                </tr>
                <tr className="bg-[#f1f3f4]">
                  {Array.from({ length: dim }, (_, i) => {
                    const day = i + 1
                    const dn = dayName(year, month, day)
                    const isWeekend = dn === 'Сб' || dn === 'Вс'
                    return (
                      <th key={day} className={`border border-[#dadce0] px-0.5 py-0.5 min-w-7 ${isWeekend ? 'bg-[#ffebee]' : ''}`}>
                        <div className="text-center">{day}</div>
                        <div className="text-[8px] text-[#7f8c8d]">{dn}</div>
                      </th>
                    )
                  })}
                  <th className="border border-[#dadce0] px-1 py-1 bg-[#28a745] text-white">К</th>
                  <th className="border border-[#dadce0] px-1 py-1 bg-[#1a73e8] text-white">В</th>
                  <th className="border border-[#dadce0] px-1 py-1 bg-[#28a745] text-white">К</th>
                  <th className="border border-[#dadce0] px-1 py-1 bg-[#1a73e8] text-white">В</th>
                  <th className="border border-[#dadce0] px-1 py-1 bg-[#2a5298] text-white">SR%</th>
                </tr>
              </thead>
              <tbody>
                {GROUPS.map((group) => {
                  const chs = groupedChannels[group] ?? []
                  if (chs.length === 0) return null
                  let groupBudget = 0, groupLeads = 0, groupContracts = 0, groupIssued = 0
                  for (const ch of chs) {
                    const p = getPlan(ch.name)
                    groupBudget += p.budget
                    const tl = Object.values(p.days).reduce((s, v) => s + v, 0)
                    groupLeads += tl
                    groupContracts += Math.round((p.rl * p.sr) / 100)
                    groupIssued += Math.round((tl * p.sr) / 100)
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
                      groupBudget={groupBudget}
                      groupLeads={groupLeads}
                      groupContracts={groupContracts}
                      groupIssued={groupIssued}
                    />
                  )
                })}

                {/* Grand total */}
                <tr className="bg-[#e8f0fe] font-bold">
                  <td className="border border-[#dadce0] px-2 py-1 sticky left-0 bg-[#e8f0fe]">ИТОГО</td>
                  <td className="border border-[#dadce0] px-1 py-1 text-center tabular-nums">{formatNumber(grandTotals.budget)}</td>
                  <td className="border border-[#dadce0] px-1 py-1"></td>
                  <td className="border border-[#dadce0] px-1 py-1 text-center tabular-nums">{grandTotals.leads}</td>
                  <td className="border border-[#dadce0] px-1 py-1"></td>
                  {Array.from({ length: dim }, (_, i) => {
                    const day = i + 1
                    let sum = 0
                    for (const ch of channels) sum += getPlan(ch.name).days[day] ?? 0
                    return <td key={day} className="border border-[#dadce0] px-1 py-1 text-center tabular-nums">{sum || ''}</td>
                  })}
                  <td className="border border-[#dadce0] px-1 py-1 text-center bg-[#28a745] text-white tabular-nums">{grandTotals.contracts}</td>
                  <td className="border border-[#dadce0] px-1 py-1 text-center bg-[#1a73e8] text-white tabular-nums">{grandTotals.issued}</td>
                  <td colSpan={3} className="border border-[#dadce0] px-1 py-1 text-center">
                    <div className="flex items-center gap-1 justify-center">
                      <Input
                        type="number"
                        value={factContracts}
                        onChange={(e) => setFactContracts(Number(e.target.value) || 0)}
                        className="h-6 w-16 text-[10px]"
                        placeholder="К"
                      />
                      <Input
                        type="number"
                        value={factIssued}
                        onChange={(e) => setFactIssued(Number(e.target.value) || 0)}
                        className="h-6 w-16 text-[10px]"
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
  groupContracts: number
  groupIssued: number
}

function FragmentGroup({
  group, channels, dim, year, month, getPlan, onUpdateDay, onUpdateParam,
  groupBudget, groupLeads, groupContracts, groupIssued,
}: FragmentGroupProps) {
  return (
    <>
      <tr className="bg-[#1e3c72] text-white font-semibold">
        <td colSpan={5 + dim + 2 + 3} className="border border-[#dadce0] px-2 py-1 sticky left-0 bg-[#1e3c72]">
          {group}
        </td>
      </tr>
      {channels.map((ch) => {
        const p = getPlan(ch.name)
        const totalLeads = Object.values(p.days).reduce((s, v) => s + v, 0)
        const planContracts = Math.round((p.rl * p.sr) / 100)
        const planIssued = Math.round((totalLeads * p.sr) / 100)
        return (
          <tr key={ch.id} className="hover:bg-[#f8f9fa]">
            <td className="border border-[#e0e0e0] px-2 py-0.5 sticky left-0 bg-white truncate max-w-32" title={ch.name}>{ch.name}</td>
            <ParamCell value={p.budget} onCommit={(v) => onUpdateParam(ch.name, 'budget', v)} />
            <ParamCell value={p.cpl} onCommit={(v) => onUpdateParam(ch.name, 'cpl', v)} />
            <ParamCell value={p.rl} onCommit={(v) => onUpdateParam(ch.name, 'rl', v)} />
            <ParamCell value={p.sr} onCommit={(v) => onUpdateParam(ch.name, 'sr', v)} />
            {Array.from({ length: dim }, (_, i) => {
              const day = i + 1
              return (
                <td key={day} className="border border-[#e0e0e0] px-0 py-0 text-center">
                  <DayCell value={p.days[day] ?? 0} onCommit={(v) => onUpdateDay(ch.name, day, v)} />
                </td>
              )
            })}
            <td className="border border-[#e0e0e0] px-1 py-0.5 text-center bg-[#e8f5e9] tabular-nums">{planContracts}</td>
            <td className="border border-[#e0e0e0] px-1 py-0.5 text-center bg-[#e3f2fd] tabular-nums">{planIssued}</td>
            <td className="border border-[#e0e0e0] px-1 py-0.5 text-center bg-[#fafafa]"></td>
            <td className="border border-[#e0e0e0] px-1 py-0.5 text-center bg-[#fafafa]"></td>
            <td className="border border-[#e0e0e0] px-1 py-0.5 text-center bg-[#fafafa]"></td>
          </tr>
        )
      })}
      <tr className="bg-[#f1f3f4] font-medium">
        <td className="border border-[#dadce0] px-2 py-1 sticky left-0 bg-[#f1f3f4]">Σ {group}</td>
        <td className="border border-[#dadce0] px-1 py-1 text-center tabular-nums">{formatNumber(groupBudget)}</td>
        <td className="border border-[#dadce0] px-1 py-1"></td>
        <td className="border border-[#dadce0] px-1 py-1 text-center tabular-nums">{groupLeads}</td>
        <td className="border border-[#dadce0] px-1 py-1"></td>
        {Array.from({ length: dim }, (_, i) => <td key={i} className="border border-[#dadce0] px-1 py-1"></td>)}
        <td className="border border-[#dadce0] px-1 py-1 text-center bg-[#c8e6c9] tabular-nums">{groupContracts}</td>
        <td className="border border-[#dadce0] px-1 py-1 text-center bg-[#bbdefb] tabular-nums">{groupIssued}</td>
        <td colSpan={3} className="border border-[#dadce0]"></td>
      </tr>
    </>
  )
}

function ParamCell({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  if (editing) {
    return (
      <td className="border border-[#e0e0e0] p-0">
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
          className="w-full h-6 px-1 text-[10px] text-center border border-[#2a5298] rounded focus:outline-none"
        />
      </td>
    )
  }
  return (
    <td
      className="border border-[#e0e0e0] px-1 py-0.5 text-center tabular-nums cursor-text hover:bg-[#e8f0fe]"
      onClick={() => { setDraft(String(value)); setEditing(true) }}
    >
      {value || ''}
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
        className="w-full h-6 px-0.5 text-[10px] text-center border border-[#2a5298] rounded focus:outline-none"
      />
    )
  }
  return (
    <span
      className="block w-full h-6 leading-6 cursor-text tabular-nums"
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
          <div className="border border-[#e0e0e0] rounded p-3 bg-[#f8f9fa]">
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
                <Label className="text-[10px]">CPL (₽)</Label>
                <Input type="number" value={newCpl} onChange={(e) => setNewCpl(Number(e.target.value) || 0)} className="h-8 text-xs" />
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
                <div className="text-xs font-semibold bg-[#1e3c72] text-white px-2 py-1 rounded-t">{g}</div>
                <div className="border border-t-0 border-[#e0e0e0] rounded-b divide-y">
                  {chs.map((ch) => (
                    <div key={ch.id} className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-[#f8f9fa]">
                      <span className="flex-1 truncate">{ch.name}</span>
                      <span className="text-[#7f8c8d]">Б: {formatNumber(ch.budget)}</span>
                      <span className="text-[#7f8c8d]">РЛ: {ch.rl}</span>
                      <span className="text-[#7f8c8d]">SR: {ch.sr}%</span>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleEdit(ch)}>✏️</Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-[#dc3545]" onClick={() => handleDelete(ch)}>
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
