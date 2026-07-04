'use client'

import { useEffect, useMemo, useState } from 'react'
import { useCrmStore } from '@/lib/store'
import { api } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { monthKey, daysInMonth, DAY_NAMES_MON_FIRST } from '@/lib/utils-crm'
import { toast } from 'sonner'

interface DayData {
  meetings: number
  contracts: number
  factContracts: number
  factIssued: number
}

export function CalendarTab() {
  const { deals } = useCrmStore()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [plans, setPlans] = useState<Record<number, { meetings: number; contracts: number }>>({})
  const [dayDialog, setDayDialog] = useState<number | null>(null)
  const [draft, setDraft] = useState({ meetings: 0, contracts: 0 })

  const mk = monthKey(year, month)
  const dim = daysInMonth(year, month)

  useEffect(() => {
    let cancelled = false
    api.getTraffic(mk).then((res) => {
      if (!cancelled) setPlans(res.plans)
    })
    return () => { cancelled = true }
  }, [mk])

  // Compute fact by day from deals
  const factsByDay = useMemo(() => {
    const out: Record<number, { contracts: number; issued: number }> = {}
    for (let day = 1; day <= dim; day++) {
      const dateStr = `${mk}-${String(day).padStart(2, '0')}`
      const dayDeals = deals.filter((d) => d.dateDkp === dateStr && d.status === 'Продан')
      const issued = deals.filter((d) => d.dateIssued === dateStr && d.status === 'Продан')
      out[day] = { contracts: dayDeals.length, issued: issued.length }
    }
    return out
  }, [deals, mk, dim])

  const firstDay = new Date(year, month - 1, 1)
  // Convert Sunday (0) to 6, Monday (1) to 0, etc. — Monday-first
  const firstDayIdx = (firstDay.getDay() + 6) % 7

  const daysArray: (number | null)[] = []
  for (let i = 0; i < firstDayIdx; i++) daysArray.push(null)
  for (let d = 1; d <= dim; d++) daysArray.push(d)
  while (daysArray.length % 7 !== 0) daysArray.push(null)

  const todayDate = today.getDate()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month

  const openDay = (day: number) => {
    setDayDialog(day)
    setDraft(plans[day] ?? { meetings: 0, contracts: 0 })
  }

  const savePlan = async () => {
    if (dayDialog === null) return
    try {
      await api.updateTodayPlan({
        monthKey: mk,
        day: dayDialog,
        meetings: draft.meetings,
        contracts: draft.contracts,
      })
      setPlans((p) => ({ ...p, [dayDialog]: draft }))
      toast.success('План сохранён')
      setDayDialog(null)
    } catch (e) {
      toast.error('Не удалось сохранить план')
    }
  }

  const prevMonth = () => { if (month === 1) { setYear(year - 1); setMonth(12) } else setMonth(month - 1) }
  const nextMonth = () => { if (month === 12) { setYear(year + 1); setMonth(1) } else setMonth(month + 1) }

  const totals = useMemo(() => {
    let m = 0, c = 0, fc = 0, fi = 0
    for (let d = 1; d <= dim; d++) {
      const p = plans[d] ?? { meetings: 0, contracts: 0 }
      const f = factsByDay[d] ?? { contracts: 0, issued: 0 }
      m += p.meetings
      c += p.contracts
      fc += f.contracts
      fi += f.issued
    }
    return { meetings: m, contracts: c, factContracts: fc, factIssued: fi }
  }, [plans, factsByDay, dim])

  return (
    <div className="h-full overflow-auto crm-scroll p-3 space-y-3">
      {/* Toolbar — всё в одну линию по горизонтали */}
      <div className="bg-white border border-[hsl(220,16%,90%)] rounded-lg p-2.5 flex items-center gap-2 flex-nowrap text-xs overflow-x-auto crm-scroll shadow-sm">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button size="sm" variant="ghost" onClick={prevMonth} className="h-7 w-7 p-0"><ChevronLeft className="w-4 h-4" /></Button>
          <span className="font-semibold min-w-36 text-center text-sm whitespace-nowrap">
            {['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][month - 1]} {year}
          </span>
          <Button size="sm" variant="ghost" onClick={nextMonth} className="h-7 w-7 p-0"><ChevronRight className="w-4 h-4" /></Button>
        </div>
        <div className="w-px h-6 bg-[hsl(220,16%,90%)] flex-shrink-0" />
        <Badge variant="outline" className="whitespace-nowrap bg-[hsl(220,20%,95%)] flex-shrink-0">📅 Встречи: {totals.meetings}</Badge>
        <Badge variant="outline" className="whitespace-nowrap bg-[hsl(220,20%,95%)] flex-shrink-0">📋 План: {totals.contracts}</Badge>
        <Badge className="bg-[hsl(142,60%,35%)] hover:bg-[hsl(142,60%,35%)] whitespace-nowrap flex-shrink-0">📄 Факт: {totals.factContracts}</Badge>
        <Badge className="bg-[hsl(217,91%,45%)] hover:bg-[hsl(217,91%,45%)] whitespace-nowrap flex-shrink-0">📤 Выдачи: {totals.factIssued}</Badge>
      </div>

      {/* Calendar grid */}
      <Card className="p-3">
        <div className="crm-calendar-grid">
          {DAY_NAMES_MON_FIRST.map((dn) => (
            <div key={dn} className={`text-center text-xs font-semibold py-1 ${dn === 'Сб' || dn === 'Вс' ? 'text-[#dc3545]' : 'text-[#7f8c8d]'}`}>
              {dn}
            </div>
          ))}
          {daysArray.map((day, idx) => {
            if (day === null) {
              return <div key={idx} className="bg-[#f8f9fa] rounded min-h-20" />
            }
            const p = plans[day] ?? { meetings: 0, contracts: 0 }
            const f = factsByDay[day] ?? { contracts: 0, issued: 0 }
            const isWeekend = [6, 0].includes(new Date(year, month - 1, day).getDay())
            const isToday = isCurrentMonth && day === todayDate
            return (
              <button
                key={idx}
                onClick={() => openDay(day)}
                className={`text-center rounded border min-h-24 p-1.5 hover:border-[#2a5298] hover:shadow-sm transition-all ${
                  isToday ? 'border-[#2a5298] bg-[#e8f0fe]' : isWeekend ? 'border-[#ffebee] bg-[#fff8f8]' : 'border-[#e0e0e0] bg-white'
                }`}
              >
                <div className={`text-sm font-bold mb-1 ${isToday ? 'text-[#2a5298]' : isWeekend ? 'text-[#dc3545]' : 'text-[#2c3e50]'}`}>
                  {day}
                </div>
                <div>
                  {(p.meetings > 0 || p.contracts > 0 || f.contracts > 0 || f.issued > 0) ? (
                    <div className="space-y-0.5">
                      {p.meetings > 0 && (
                        <div className="text-xs text-[#6a1b9a] font-medium">📅 {p.meetings}</div>
                      )}
                      {p.contracts > 0 && (
                        <div className="text-xs text-[#f57f17] font-medium">📋 {p.contracts}</div>
                      )}
                      {f.contracts > 0 && (
                        <div className="text-xs text-[#28a745] font-medium">📄 {f.contracts}</div>
                      )}
                      {f.issued > 0 && (
                        <div className="text-xs text-[#1a73e8] font-medium">📤 {f.issued}</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-[#bbb]">+</div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      {/* Day dialog */}
      <Dialog open={dayDialog !== null} onOpenChange={(v) => !v && setDayDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dayDialog !== null && `${dayDialog} ${['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'][month - 1]} ${year}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="meetings">📅 План встреч</Label>
                <Input id="meetings" type="number" value={draft.meetings} onChange={(e) => setDraft((d) => ({ ...d, meetings: Number(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label htmlFor="contracts">📋 План контрактов</Label>
                <Input id="contracts" type="number" value={draft.contracts} onChange={(e) => setDraft((d) => ({ ...d, contracts: Number(e.target.value) || 0 }))} />
              </div>
            </div>
            {dayDialog !== null && (
              <div className="bg-[#f8f9fa] border border-[#e0e0e0] rounded p-3 text-xs space-y-1">
                <div className="font-semibold mb-1">Фактически:</div>
                <div className="flex justify-between"><span>📄 Контракты:</span><Badge className="bg-[#28a745] hover:bg-[#28a745]">{factsByDay[dayDialog]?.contracts ?? 0}</Badge></div>
                <div className="flex justify-between"><span>📤 Выдачи:</span><Badge className="bg-[#1a73e8] hover:bg-[#1a73e8]">{factsByDay[dayDialog]?.issued ?? 0}</Badge></div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDayDialog(null)}>Отмена</Button>
            <Button onClick={savePlan}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
