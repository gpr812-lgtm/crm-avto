'use client'

import { useMemo, useState } from 'react'
import { useCrmStore } from '@/lib/store'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trash2, Download } from 'lucide-react'
import { toast } from 'sonner'

const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  add: { label: 'Добавление', color: '#28a745', bg: '#e8f5e9' },
  edit: { label: 'Изменение', color: '#856404', bg: '#fff3cd' },
  delete: { label: 'Удаление', color: '#dc3545', bg: '#ffebee' },
  bulk: { label: 'Массовое', color: '#1a73e8', bg: '#e8f0fe' },
}

export function HistoryTab() {
  const { history, clearHistory } = useCrmStore()
  const [filter, setFilter] = useState<string>('')

  const filtered = useMemo(() => {
    if (!filter) return history
    return history.filter((h) => h.type === filter)
  }, [history, filter])

  const exportCSV = () => {
    const rows: string[][] = [['Дата', 'Тип', 'Описание']]
    for (const h of history) {
      rows.push([
        new Date(h.createdAt).toLocaleString('ru-RU'),
        TYPE_LABELS[h.type]?.label ?? h.type,
        h.description,
      ])
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\r\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `history-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success('CSV экспортирован')
  }

  const handleClear = async () => {
    if (!confirm(`Очистить всю историю (${history.length} записей)?`)) return
    await clearHistory()
    toast.success('История очищена')
  }

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b px-3 py-2 flex items-center gap-2 flex-wrap text-xs flex-shrink-0">
        <div className="font-semibold">📜 История изменений ({history.length})</div>
        <div className="flex gap-1">
          <Button size="sm" variant={filter === '' ? 'default' : 'ghost'} className="h-7 text-xs" onClick={() => setFilter('')}>Все</Button>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <Button
              key={k}
              size="sm"
              variant={filter === k ? 'default' : 'ghost'}
              className="h-7 text-xs"
              onClick={() => setFilter(k)}
            >
              {v.label}
            </Button>
          ))}
        </div>
        <div className="flex-1" />
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={exportCSV}>
          <Download className="w-3 h-3 mr-1" /> CSV
        </Button>
        <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={handleClear}>
          <Trash2 className="w-3 h-3 mr-1" /> Очистить
        </Button>
      </div>

      <div className="flex-1 overflow-auto crm-scroll p-3">
        <Card className="divide-y">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-[#7f8c8d]">
              <div className="text-4xl mb-2">📜</div>
              <div className="text-sm">История пуста</div>
            </div>
          ) : (
            filtered.map((h) => {
              const t = TYPE_LABELS[h.type] ?? { label: h.type, color: '#7f8c8d', bg: '#f8f9fa' }
              return (
                <div key={h.id} className="px-3 py-2 flex items-start gap-3 text-xs hover:bg-[#f8f9fa]">
                  <Badge
                    className="flex-shrink-0"
                    style={{ backgroundColor: t.bg, color: t.color, border: `1px solid ${t.color}33` }}
                  >
                    {t.label}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="break-words">{h.description}</div>
                    <div className="text-[10px] text-[#7f8c8d] mt-0.5">
                      {new Date(h.createdAt).toLocaleString('ru-RU')}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </Card>
      </div>
    </div>
  )
}
