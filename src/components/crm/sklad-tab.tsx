'use client'

import { useMemo, useRef, useState } from 'react'
import { useCrmStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Plus, Download, Upload, Trash2, Copy, ArrowUp, ArrowDown, Link as LinkIcon,
  ExternalLink, Filter, Printer, ChevronUp, ChevronDown, FileSpreadsheet, X, Settings, Calendar,
} from 'lucide-react'
import { formatNumber, parseRuNumber, highlightMatch } from '@/lib/utils-crm'
import { toast } from 'sonner'
import type { Deal, DealColumn } from '@/lib/types'

interface SkladTabProps {
  deals: Deal[]
  columns: DealColumn[]
  options: Record<string, string[]>
}

type SortDir = 'asc' | 'desc' | null

interface FilterState {
  [key: string]: string
}

const COLUMN_TYPES = [
  { value: 'text', label: 'Текст' },
  { value: 'number', label: 'Число' },
  { value: 'date', label: 'Дата' },
  { value: 'select', label: 'Список' },
  { value: 'url', label: 'Ссылка' },
]

export function SkladTab({ deals, columns, options }: SkladTabProps) {
  const {
    selectedDealIds,
    toggleSelection,
    selectAll,
    clearSelection,
    removeDeal,
    removeDealsBulk,
    duplicateDealsBulk,
    editDeal,
    addDeal,
    evalLinks,
    saveEvalLink,
    removeEvalLink,
    addOption,
    saveColumn,
    addColumn,
    removeColumn,
    importDeals,
    options: allOptions,
  } = useCrmStore()

  const [filters, setFilters] = useState<FilterState>({})
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [linkDialog, setLinkDialog] = useState<{ dealId: string; currentUrl?: string } | null>(null)
  const [linkInput, setLinkInput] = useState('')
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [columnDialog, setColumnDialog] = useState<{ mode: 'create' | 'rename' | 'changeType'; col?: DealColumn; insertAfter?: string } | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [listsSettingsOpen, setListsSettingsOpen] = useState(false)

  const importFileRef = useRef<HTMLInputElement>(null)
  const csvFileRef = useRef<HTMLInputElement>(null)

  // Filter dropdowns: first 4 select-type columns
  const filterColumns = useMemo(() => {
    return columns.filter((c) => c.type === 'select').slice(0, 4)
  }, [columns])

  // Apply filters and sort
  const filteredDeals = useMemo(() => {
    let result = [...deals]
    for (const [key, value] of Object.entries(filters)) {
      if (value) {
        result = result.filter((d) => String((d as Record<string, unknown>)[key] ?? '') === value)
      }
    }
    // Date DKP range filter
    if (dateFrom) {
      result = result.filter((d) => {
        const v = (d as Record<string, unknown>).dateDkp as string | null
        return v && v >= dateFrom
      })
    }
    if (dateTo) {
      result = result.filter((d) => {
        const v = (d as Record<string, unknown>).dateDkp as string | null
        return v && v <= dateTo
      })
    }
    if (sortKey && sortDir) {
      result.sort((a, b) => {
        const av = (a as Record<string, unknown>)[sortKey]
        const bv = (b as Record<string, unknown>)[sortKey]
        const an = typeof av === 'number' ? av : parseFloat(String(av ?? '0').replace(/\s/g, '').replace(',', '.'))
        const bn = typeof bv === 'number' ? bv : parseFloat(String(bv ?? '0').replace(/\s/g, '').replace(',', '.'))
        if (!Number.isNaN(an) && !Number.isNaN(bn)) {
          return sortDir === 'asc' ? an - bn : bn - an
        }
        return sortDir === 'asc'
          ? String(av ?? '').localeCompare(String(bv ?? ''))
          : String(bv ?? '').localeCompare(String(av ?? ''))
      })
    }
    return result
  }, [deals, filters, dateFrom, dateTo, sortKey, sortDir])

  // Totals for number columns
  const totals = useMemo(() => {
    const t: Record<string, number> = {}
    for (const c of columns) {
      if (c.type === 'number') {
        t[c.key] = filteredDeals.reduce((sum, d) => sum + ((d as Record<string, unknown>)[c.key] as number ?? 0), 0)
      }
    }
    return t
  }, [filteredDeals, columns])

  const toggleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key); setSortDir('asc')
    } else if (sortDir === 'asc') {
      setSortDir('desc')
    } else if (sortDir === 'desc') {
      setSortKey(null); setSortDir(null)
    } else {
      setSortDir('asc')
    }
  }

  const handleCellEdit = async (deal: Deal, key: string, value: string, col: DealColumn) => {
    const oldValue = String((deal as Record<string, unknown>)[key] ?? '')
    if (oldValue === value) return
    let parsed: string | number = value
    if (col.type === 'number') parsed = parseRuNumber(value)
    try {
      await editDeal(deal.id, { [key]: parsed })
    } catch (e) {
      toast.error('Не удалось сохранить изменение')
    }
  }

  const handleDuplicate = async (deal: Deal) => {
    await duplicateDealsBulk([deal.id])
    toast.success('Сделка дублирована')
  }

  const handleInsertAbove = async (deal: Deal) => {
    // Insert an empty row above (decrement orders of this deal and below, then create new)
    const newDeal: Partial<Deal> = {}
    for (const col of columns) {
      ;(newDeal as Record<string, unknown>)[col.key] = col.type === 'number' ? 0 : col.default ?? ''
    }
    newDeal.order = deal.order
    // Shift this deal and below by +1
    await editDeal(deal.id, { order: deal.order + 1 })
    await addDeal(newDeal)
    toast.success('Строка добавлена выше')
  }

  const handleInsertBelow = async (deal: Deal) => {
    const newDeal: Partial<Deal> = {}
    for (const col of columns) {
      ;(newDeal as Record<string, unknown>)[col.key] = col.type === 'number' ? 0 : col.default ?? ''
    }
    newDeal.order = deal.order + 1
    await addDeal(newDeal)
    toast.success('Строка добавлена ниже')
  }

  const handleDelete = async (deal: Deal) => {
    if (!confirm(`Удалить сделку: ${deal.model} — ${deal.client || 'без клиента'}?`)) return
    await removeDeal(deal.id)
    toast.success('Сделка удалена')
  }

  const handleBulkDelete = async () => {
    if (selectedDealIds.size === 0) {
      toast.warning('Нет выбранных сделок')
      return
    }
    if (!confirm(`Удалить ${selectedDealIds.size} выбранных сделок?`)) return
    await removeDealsBulk(Array.from(selectedDealIds))
    toast.success('Сделки удалены')
  }

  const handleOpenLink = (deal: Deal) => {
    const url = evalLinks[deal.id]
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleSaveLink = async () => {
    if (!linkDialog) return
    try {
      await saveEvalLink(linkDialog.dealId, linkInput.trim())
      toast.success('Ссылка сохранена')
      setLinkDialog(null)
      setLinkInput('')
    } catch (e) {
      toast.error('Не удалось сохранить ссылку')
    }
  }

  const handleRemoveLink = async (dealId: string) => {
    if (!confirm('Удалить ссылку ТИ?')) return
    await removeEvalLink(dealId)
    toast.success('Ссылка удалена')
  }

  // CSV Export
  const handleExportCSV = () => {
    const headers = [...columns.map((c) => c.label), 'Ссылка ТИ']
    const rows = filteredDeals.map((d) => [
      ...columns.map((c) => String((d as Record<string, unknown>)[c.key] ?? '')),
      evalLinks[d.id] ?? '',
    ])
    const csv = [headers, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sklad-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success('CSV экспортирован')
  }

  // Excel Export (HTML table opens in Excel)
  const handleExportExcel = () => {
    const headers = columns.map((c) => c.label)
    const rows = filteredDeals.map((d) =>
      columns.map((c) => String((d as Record<string, unknown>)[c.key] ?? '')),
    )
    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8"></head>
      <body><table border="1">
        <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></body></html>`
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sklad-${new Date().toISOString().slice(0, 10)}.xls`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success('Excel экспортирован')
  }

  // CSV Import
  const handleImportCSVFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      // Parse CSV: split by \r\n or \n, then by ; (handle quoted)
      const lines = text.split(/\r\n|\n/).filter((l) => l.trim() && !l.startsWith('\ufeff'))
      if (lines.length === 0) throw new Error('Empty CSV')

      // Parse a single CSV line accounting for quoted values
      const parseLine = (line: string): string[] => {
        const out: string[] = []
        let cur = ''
        let inQuotes = false
        for (let i = 0; i < line.length; i++) {
          const ch = line[i]
          if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
            else inQuotes = !inQuotes
          } else if (ch === ';' && !inQuotes) {
            out.push(cur); cur = ''
          } else {
            cur += ch
          }
        }
        out.push(cur)
        return out
      }

      const header = parseLine(lines[0]).map((h) => h.trim())
      // Map header labels to column keys
      const labelToKey = new Map(columns.map((c) => [c.label.toLowerCase(), c.key]))
      const keyIndexes: { key: string; idx: number }[] = []
      header.forEach((h, i) => {
        const k = labelToKey.get(h.toLowerCase())
        if (k) keyIndexes.push({ key: k, idx: i })
      })

      if (keyIndexes.length === 0) {
        // Try by key directly
        const keySet = new Set(columns.map((c) => c.key))
        header.forEach((h, i) => {
          if (keySet.has(h)) keyIndexes.push({ key: h, idx: i })
        })
      }

      if (keyIndexes.length === 0) {
        throw new Error('Не удалось сопоставить заголовки CSV с колонками таблицы')
      }

      const rows: Record<string, unknown>[] = []
      for (let i = 1; i < lines.length; i++) {
        const cells = parseLine(lines[i])
        const row: Record<string, unknown> = {}
        for (const { key, idx } of keyIndexes) {
          const col = columns.find((c) => c.key === key)
          const val = cells[idx] ?? ''
          if (col?.type === 'number') {
            row[key] = parseRuNumber(val)
          } else {
            row[key] = val
          }
        }
        rows.push(row)
      }

      const imported = await importDeals(rows, 'append')
      toast.success(`Импортировано ${imported} сделок`)
    } catch (err) {
      console.error(err)
      toast.error(`Ошибка импорта CSV: ${err instanceof Error ? err.message : 'неизвестная'}`)
    } finally {
      if (csvFileRef.current) csvFileRef.current.value = ''
    }
  }

  // Column actions
  const handleRenameColumn = (col: DealColumn) => {
    setColumnDialog({ mode: 'rename', col })
  }

  const handleChangeColumnType = (col: DealColumn) => {
    setColumnDialog({ mode: 'changeType', col })
  }

  const handleInsertColumnLeft = (col: DealColumn) => {
    // Find previous column to insert after
    const idx = columns.findIndex((c) => c.id === col.id)
    const prevCol = idx > 0 ? columns[idx - 1] : undefined
    setColumnDialog({ mode: 'create', insertAfter: prevCol?.key })
  }

  const handleInsertColumnRight = (col: DealColumn) => {
    setColumnDialog({ mode: 'create', insertAfter: col.key })
  }

  const handleDeleteColumn = async (col: DealColumn) => {
    if (!confirm(`Удалить колонку "${col.label}"?\nДанные в этой колонке будут потеряны.`)) return
    await removeColumn(col.id)
    toast.success('Колонка удалена')
  }

  // Bulk delete by filters
  const [bulkDeleteFilters, setBulkDeleteFilters] = useState<{ status: string; model: string; dateFrom: string; dateTo: string }>({
    status: '', model: '', dateFrom: '', dateTo: '',
  })
  const bulkDeleteCount = useMemo(() => {
    return deals.filter((d) => {
      if (bulkDeleteFilters.status && d.status !== bulkDeleteFilters.status) return false
      if (bulkDeleteFilters.model && d.model !== bulkDeleteFilters.model) return false
      if (bulkDeleteFilters.dateFrom && d.dateDkp && d.dateDkp < bulkDeleteFilters.dateFrom) return false
      if (bulkDeleteFilters.dateTo && d.dateDkp && d.dateDkp > bulkDeleteFilters.dateTo) return false
      return true
    }).length
  }, [deals, bulkDeleteFilters])

  const handleBulkDeleteByFilters = async () => {
    if (bulkDeleteCount === 0) {
      toast.warning('Нет сделок под выбранные фильтры')
      return
    }
    if (!confirm(`Удалить ${bulkDeleteCount} сделок по фильтрам?`)) return
    const ids = deals.filter((d) => {
      if (bulkDeleteFilters.status && d.status !== bulkDeleteFilters.status) return false
      if (bulkDeleteFilters.model && d.model !== bulkDeleteFilters.model) return false
      if (bulkDeleteFilters.dateFrom && d.dateDkp && d.dateDkp < bulkDeleteFilters.dateFrom) return false
      if (bulkDeleteFilters.dateTo && d.dateDkp && d.dateDkp > bulkDeleteFilters.dateTo) return false
      return true
    }).map((d) => d.id)
    await removeDealsBulk(ids)
    setBulkDeleteOpen(false)
    setBulkDeleteFilters({ status: '', model: '', dateFrom: '', dateTo: '' })
    toast.success(`Удалено ${ids.length} сделок`)
  }

  const handlePrint = () => window.print()
  const allSelected = filteredDeals.length > 0 && filteredDeals.every((d) => selectedDealIds.has(d.id))

  // Empty state
  if (deals.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-md crm-fade-in">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[hsl(221,60%,95%)] to-[hsl(217,91%,95%)] flex items-center justify-center crm-pulse">
            <span className="text-4xl">📦</span>
          </div>
          <h2 className="text-lg font-semibold mb-2 text-[hsl(215,28%,22%)]">Список сделок пуст</h2>
          <p className="text-sm text-[hsl(215,16%,47%)] mb-5 leading-relaxed">
            Добавьте первую сделку вручную или импортируйте готовый CSV-файл,
            чтобы начать работу с CRM.
          </p>
          <div className="flex items-center gap-2 justify-center">
            <Button onClick={() => useCrmStore.getState().setActiveTab('sklad')} size="sm" className="bg-[hsl(221,60%,38%)] hover:bg-[hsl(221,60%,33%)]">
              <Plus className="w-3.5 h-3.5 mr-1" /> Добавить сделку
            </Button>
            <Button onClick={() => csvFileRef.current?.click()} variant="outline" size="sm">
              <Upload className="w-3.5 h-3.5 mr-1" /> Импорт CSV
            </Button>
          </div>
          <input ref={csvFileRef} type="file" accept=".csv" onChange={handleImportCSVFile} className="hidden" />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="bg-white border-b px-3 py-2 flex items-center gap-2 flex-wrap text-xs flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-[#7f8c8d]" />
          <span className="text-[#7f8c8d]">Фильтры:</span>
        </div>
        {filterColumns.map((col) => (
          <select
            key={col.key}
            value={filters[col.key] ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, [col.key]: e.target.value }))}
            className="h-7 px-2 text-xs border border-[hsl(220,16%,90%)] rounded focus:outline-none focus:border-[hsl(221,60%,38%)] bg-white"
          >
            <option value="">{col.label}: все</option>
            {(options[col.options ?? ''] ?? []).map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        ))}

        {/* Date DKP range filter */}
        <div className="flex items-center gap-1 px-2 py-0.5 border border-[hsl(220,16%,90%)] rounded bg-white">
          <Calendar className="w-3 h-3 text-[hsl(215,16%,47%)]" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-6 text-[10px] bg-transparent border-0 focus:outline-none"
            title="Дата ДКП с"
          />
          <span className="text-[hsl(215,16%,47%)] text-[10px]">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-6 text-[10px] bg-transparent border-0 focus:outline-none"
            title="Дата ДКП по"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo('') }}
              className="text-[hsl(215,16%,47%)] hover:text-[hsl(0,72%,51%)]"
              title="Сбросить даты"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <Button size="sm" variant="ghost" className="h-7 text-xs"
          onClick={() => { setFilters({}); setDateFrom(''); setDateTo('') }}
          disabled={Object.values(filters).every((v) => !v) && !dateFrom && !dateTo}
        >
          Сбросить
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => setListsSettingsOpen(true)}
          title="Управление справочниками (модели, продавцы, статусы и т.д.)"
        >
          <Settings className="w-3 h-3 mr-1" /> Списки
        </Button>

        <div className="flex-1" />

        {selectedDealIds.size > 0 && (
          <>
            <Badge variant="secondary" className="bg-[#e8f0fe] text-[#1a73e8]">
              Выбрано: {selectedDealIds.size}
            </Badge>
            <Button size="sm" variant="outline" className="h-7 text-xs"
              onClick={() => duplicateDealsBulk(Array.from(selectedDealIds))}
            >
              <Copy className="w-3 h-3 mr-1" /> Дублировать
            </Button>
            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={handleBulkDelete}>
              <Trash2 className="w-3 h-3 mr-1" /> Удалить выбранные
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearSelection}>
              Снять выделение
            </Button>
          </>
        )}

        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setBulkDeleteOpen(true)}>
          <Trash2 className="w-3 h-3 mr-1" /> По фильтрам
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs">
              <Upload className="w-3 h-3 mr-1" /> Импорт
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => csvFileRef.current?.click()}>
              <Upload className="w-3.5 h-3.5 mr-2" /> CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <input ref={csvFileRef} type="file" accept=".csv" onChange={handleImportCSVFile} className="hidden" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs">
              <Download className="w-3 h-3 mr-1" /> Экспорт
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={handleExportCSV}>
              <Download className="w-3.5 h-3.5 mr-2" /> CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportExcel}>
              <FileSpreadsheet className="w-3.5 h-3.5 mr-2" /> Excel (.xls)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handlePrint}>
          <Printer className="w-3 h-3 mr-1" /> Печать
        </Button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto crm-scroll">
        <table className="w-full border-collapse text-xs crm-table">
          <thead>
            <tr className="bg-[#f1f3f4]">
              <th className="border border-[#dadce0] px-2 py-1.5 w-8 sticky left-0 z-20 bg-[#f1f3f4]">
                <Checkbox checked={allSelected} onCheckedChange={(v) => (v ? selectAll() : clearSelection())} />
              </th>
              <th className="border border-[#dadce0] px-2 py-1.5 w-10">№</th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="border border-[#dadce0] px-2 py-1.5 select-none whitespace-nowrap hover:bg-[#e8f0fe] group relative"
                  style={{ minWidth: col.width, width: col.width }}
                >
                  <HeaderCell
                    col={col}
                    sortDir={sortKey === col.key ? sortDir : null}
                    onSort={() => toggleSort(col.key)}
                    onRename={() => handleRenameColumn(col)}
                    onChangeType={() => handleChangeColumnType(col)}
                    onInsertLeft={() => handleInsertColumnLeft(col)}
                    onInsertRight={() => handleInsertColumnRight(col)}
                    onDelete={() => handleDeleteColumn(col)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredDeals.map((deal, idx) => {
              const rowClass =
                deal.status === 'Продан' ? 'crm-status-sold' :
                deal.status === 'Склад' ? 'crm-status-stock' :
                deal.status === 'Отказ' ? 'crm-status-refusal' : ''
              const isSelected = selectedDealIds.has(deal.id)
              const hasLink = !!evalLinks[deal.id]

              return (
                <ContextMenu key={deal.id}>
                  <ContextMenuTrigger asChild>
                    <tr className={`${rowClass} ${isSelected ? 'ring-2 ring-[#1a73e8] ring-inset' : ''} hover:bg-[#f8f9fa]/70`}>
                      <td className="border border-[#e0e0e0] px-2 py-1 text-center sticky left-0 z-10 bg-inherit">
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleSelection(deal.id)} />
                      </td>
                      <td className="border border-[#e0e0e0] px-2 py-1 text-center text-[#7f8c8d]">{idx + 1}</td>
                      {columns.map((col) => (
                        <DealCell
                          key={col.key}
                          deal={deal}
                          col={col}
                          options={options[col.options ?? ''] ?? []}
                          hasLink={hasLink}
                          onEdit={(value) => handleCellEdit(deal, col.key, value, col)}
                          onAddOption={async (value) => {
                            if (col.options) await addOption(col.options, value)
                          }}
                          onOpenLinkMenu={() => setLinkDialog({ dealId: deal.id, currentUrl: evalLinks[deal.id] })}
                          onOpenLink={() => handleOpenLink(deal)}
                          onRemoveLink={() => handleRemoveLink(deal.id)}
                        />
                      ))}
                    </tr>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => handleDuplicate(deal)}>
                      <Copy className="w-3.5 h-3.5 mr-2" /> Дублировать
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleInsertAbove(deal)}>
                      <ArrowUp className="w-3.5 h-3.5 mr-2" /> Вставить выше
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleInsertBelow(deal)}>
                      <ArrowDown className="w-3.5 h-3.5 mr-2" /> Вставить ниже
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => setLinkDialog({ dealId: deal.id, currentUrl: evalLinks[deal.id] })}>
                      <LinkIcon className="w-3.5 h-3.5 mr-2" /> Ссылка ТИ
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem className="text-[#dc3545]" onClick={() => handleDelete(deal)}>
                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Удалить
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-[#e8f0fe] font-bold sticky bottom-0">
              <td colSpan={2} className="border border-[#dadce0] px-2 py-1.5 text-right">Σ</td>
              {columns.map((col) => (
                <td key={col.key} className="border border-[#dadce0] px-2 py-1.5 text-center tabular-nums">
                  {col.type === 'number' ? formatNumber(totals[col.key] ?? 0) : ''}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Link Dialog */}
      <Dialog open={linkDialog !== null} onOpenChange={(v) => !v && setLinkDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>🔗 Ссылка ТИ</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="ti-link">URL оценки</Label>
              <Input
                id="ti-link"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                placeholder="https://..."
                defaultValue={linkDialog?.currentUrl ?? ''}
                autoFocus
              />
            </div>
            {linkDialog?.currentUrl && (
              <Button variant="outline" size="sm" onClick={() => {
                if (linkDialog) window.open(linkDialog.currentUrl, '_blank', 'noopener,noreferrer')
              }}>
                <ExternalLink className="w-3.5 h-3.5 mr-1" /> Открыть текущую
              </Button>
            )}
          </div>
          <DialogFooter>
            {linkDialog?.currentUrl && (
              <Button variant="destructive" onClick={() => {
                if (linkDialog) handleRemoveLink(linkDialog.dealId)
                setLinkDialog(null)
              }}>
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Удалить
              </Button>
            )}
            <Button variant="outline" onClick={() => setLinkDialog(null)}>Отмена</Button>
            <Button onClick={handleSaveLink}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk delete by filters */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>🗑️ Массовое удаление по фильтрам</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Статус</Label>
              <select
                value={bulkDeleteFilters.status}
                onChange={(e) => setBulkDeleteFilters((f) => ({ ...f, status: e.target.value }))}
                className="w-full h-9 px-2 text-xs border border-[#ddd] rounded"
              >
                <option value="">Все</option>
                {(options.status ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <Label>Модель</Label>
              <select
                value={bulkDeleteFilters.model}
                onChange={(e) => setBulkDeleteFilters((f) => ({ ...f, model: e.target.value }))}
                className="w-full h-9 px-2 text-xs border border-[#ddd] rounded"
              >
                <option value="">Все</option>
                {(options.model ?? []).map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Дата ДКП с</Label>
                <Input type="date" value={bulkDeleteFilters.dateFrom}
                  onChange={(e) => setBulkDeleteFilters((f) => ({ ...f, dateFrom: e.target.value }))} />
              </div>
              <div>
                <Label>Дата ДКП по</Label>
                <Input type="date" value={bulkDeleteFilters.dateTo}
                  onChange={(e) => setBulkDeleteFilters((f) => ({ ...f, dateTo: e.target.value }))} />
              </div>
            </div>
            <div className="bg-[#fff3cd] border border-[#ffc107] rounded p-2 text-xs text-center">
              Найдено сделок: <b className="text-[#dc3545]">{bulkDeleteCount}</b>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Отмена</Button>
            <Button variant="destructive" onClick={handleBulkDeleteByFilters} disabled={bulkDeleteCount === 0}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Удалить {bulkDeleteCount || ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Column dialog (create / rename / changeType) */}
      <ColumnDialog
        state={columnDialog}
        onClose={() => setColumnDialog(null)}
        columns={columns}
        onSave={async (data) => {
          if (columnDialog?.mode === 'rename' && columnDialog.col) {
            await saveColumn(columnDialog.col.id, { label: data.label })
            toast.success('Колонка переименована')
          } else if (columnDialog?.mode === 'changeType' && columnDialog.col) {
            await saveColumn(columnDialog.col.id, { type: data.type as DealColumn['type'], options: data.type === 'select' ? data.options : null })
            toast.success('Тип колонки изменён')
          } else if (columnDialog?.mode === 'create') {
            await addColumn({
              key: data.key!,
              label: data.label,
              type: data.type,
              options: data.type === 'select' ? data.options : null,
              width: 100,
              insertAfter: columnDialog.insertAfter,
            })
            toast.success('Колонка добавлена')
          }
          setColumnDialog(null)
        }}
      />

      <ListsSettingsDialog open={listsSettingsOpen} onOpenChange={setListsSettingsOpen} />
    </div>
  )
}

// ============================
// Header cell with context menu + sort + resize
// ============================
interface HeaderCellProps {
  col: DealColumn
  sortDir: SortDir
  onSort: () => void
  onRename: () => void
  onChangeType: () => void
  onInsertLeft: () => void
  onInsertRight: () => void
  onDelete: () => void
}

function HeaderCell({ col, sortDir, onSort, onRename, onChangeType, onInsertLeft, onInsertRight, onDelete }: HeaderCellProps) {
  const [width, setWidth] = useState(col.width)
  const [resizing, setResizing] = useState(false)

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setResizing(true)
    const startX = e.clientX
    const startWidth = col.width

    const onMove = (ev: MouseEvent) => {
      const newWidth = Math.max(40, startWidth + (ev.clientX - startX))
      setWidth(newWidth)
    }
    const onUp = async () => {
      setResizing(false)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      // Persist width
      try {
        const { useCrmStore } = await import('@/lib/store')
        useCrmStore.getState().saveColumn(col.id, { width })
      } catch (e) {
        console.error('Failed to save width', e)
      }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="flex items-center justify-center gap-1 cursor-pointer" onClick={onSort}>
          <span>{col.label}</span>
          {sortDir === 'asc' && <ChevronUp className="w-3 h-3" />}
          {sortDir === 'desc' && <ChevronDown className="w-3 h-3" />}
          <div
            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[#2a5298] group-hover:opacity-100"
            onMouseDown={startResize}
            style={{ background: resizing ? '#2a5298' : 'transparent' }}
          />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onRename}>✏️ Переименовать</ContextMenuItem>
        <ContextMenuItem onClick={onChangeType}>🔄 Изменить тип</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onInsertLeft}>⬅️ Вставить слева</ContextMenuItem>
        <ContextMenuItem onClick={onInsertRight}>➡️ Вставить справа</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem className="text-[#dc3545]" onClick={onDelete}>🗑️ Удалить колонку</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

// ============================
// Column create/rename/changeType dialog
// ============================
interface ColumnDialogProps {
  state: { mode: 'create' | 'rename' | 'changeType'; col?: DealColumn; insertAfter?: string } | null
  onClose: () => void
  columns: DealColumn[]
  onSave: (data: { key?: string; label: string; type: string; options?: string | null }) => Promise<void>
}

function ColumnDialog({ state, onClose, columns, onSave }: ColumnDialogProps) {
  const [label, setLabel] = useState('')
  const [key, setKey] = useState('')
  const [type, setType] = useState('text')
  const [options, setOptions] = useState('')
  const { options: allOptions } = useCrmStore()

  // Sync state when dialog opens
  useMemo(() => {
    if (!state) return
    if (state.mode === 'rename' && state.col) {
      setLabel(state.col.label); setKey(state.col.key); setType(state.col.type)
    } else if (state.mode === 'changeType' && state.col) {
      setLabel(state.col.label); setKey(state.col.key); setType(state.col.type); setOptions(state.col.options ?? '')
    } else {
      setLabel(''); setKey(`col_${Date.now()}`); setType('text'); setOptions('')
    }
  }, [state])

  if (!state) return null

  const title = state.mode === 'create' ? '➕ Новая колонка' : state.mode === 'rename' ? '✏️ Переименовать' : '🔄 Изменить тип'

  return (
    <Dialog open={state !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {state.mode === 'create' && (
            <>
              <div>
                <Label>Ключ (латиницей, без пробелов)</Label>
                <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="my_column" />
              </div>
              <div>
                <Label>Тип</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COLUMN_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {type === 'select' && (
                <div>
                  <Label>Справочник</Label>
                  <Select value={options} onValueChange={setOptions}>
                    <SelectTrigger><SelectValue placeholder="(выберите)" /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(allOptions).map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
          {state.mode === 'rename' && (
            <div>
              <Label>Название</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
            </div>
          )}
          {state.mode === 'changeType' && (
            <>
              <div className="text-xs text-[#7f8c8d]">Колонка: <b>{label}</b></div>
              <div>
                <Label>Тип</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COLUMN_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {type === 'select' && (
                <div>
                  <Label>Справочник</Label>
                  <Select value={options} onValueChange={setOptions}>
                    <SelectTrigger><SelectValue placeholder="(выберите)" /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(allOptions).map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={() => onSave({ key: state.mode === 'create' ? key : undefined, label, type, options: type === 'select' ? options : null })}>
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================
// DealCell — inline editing by type
// ============================
interface DealCellProps {
  deal: Deal
  col: DealColumn
  options: string[]
  hasLink: boolean
  onEdit: (value: string) => void
  onAddOption: (value: string) => Promise<void>
  onOpenLinkMenu: () => void
  onOpenLink: () => void
  onRemoveLink: () => void
}

function DealCell({ deal, col, options, hasLink, onEdit, onAddOption, onOpenLinkMenu, onOpenLink, onRemoveLink }: DealCellProps) {
  const rawValue = (deal as Record<string, unknown>)[col.key]
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const startEdit = () => {
    setDraft(col.type === 'number' ? formatNumber(Number(rawValue) || 0) : String(rawValue ?? ''))
    setEditing(true)
  }

  const commit = () => {
    setEditing(false)
    onEdit(draft)
  }

  const isTiWithLink = col.key === 'ti' && hasLink

  if (col.type === 'select') {
    return (
      <td className="border border-[#e0e0e0] px-1 py-0.5 text-center">
        <select
          value={String(rawValue ?? '')}
          onChange={(e) => onEdit(e.target.value)}
          className="w-full h-7 px-1 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-[#2a5298] rounded"
        >
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </td>
    )
  }

  if (col.type === 'date') {
    return (
      <td className="border border-[#e0e0e0] px-1 py-0.5 text-center">
        <input
          type="date"
          value={String(rawValue ?? '')}
          onChange={(e) => onEdit(e.target.value)}
          className="w-full h-7 px-1 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-[#2a5298] rounded"
        />
      </td>
    )
  }

  if (col.type === 'number') {
    const n = Number(rawValue) || 0
    const cls = n > 0 ? 'text-[#28a745]' : n < 0 ? 'text-[#dc3545]' : ''
    return (
      <td
        className={`border border-[#e0e0e0] px-2 py-1 text-center tabular-nums crm-editable cursor-text ${cls}`}
        onClick={() => !editing && startEdit()}
      >
        {editing ? (
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') setEditing(false)
            }}
            className="w-full h-6 px-1 text-xs border border-[#2a5298] rounded focus:outline-none"
          />
        ) : (
          formatNumber(n)
        )}
      </td>
    )
  }

  // text — with TI special handling
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <td
          className={`border border-[#e0e0e0] px-2 py-1 crm-editable cursor-text ${isTiWithLink ? 'crm-cell-ti-link' : ''}`}
          onClick={() => {
            if (isTiWithLink) {
              onOpenLinkMenu()
              return
            }
            if (!editing) startEdit()
          }}
          onContextMenu={(e) => {
            if (isTiWithLink) e.preventDefault() // let our menu open
          }}
        >
          {editing ? (
            <input
              autoFocus
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') setEditing(false)
              }}
              className="w-full h-6 px-1 text-xs border border-[#2a5298] rounded focus:outline-none"
            />
          ) : (
            <span className="text-xs">{String(rawValue ?? '') || '—'}</span>
          )}
        </td>
      </ContextMenuTrigger>
      {isTiWithLink && (
        <ContextMenuContent>
          <ContextMenuItem onClick={onOpenLinkMenu}>🔗 Внести/редактировать ссылку</ContextMenuItem>
          <ContextMenuItem onClick={onOpenLink}>🌐 Открыть ссылку</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem className="text-[#dc3545]" onClick={onRemoveLink}>🗑️ Удалить ссылку</ContextMenuItem>
        </ContextMenuContent>
      )}
    </ContextMenu>
  )
}

// ============================
// Lists Settings Dialog — manage dropdown options (models, sellers, etc.)
// ============================
const DICT_LABELS: Record<string, string> = {
  model: '🚗 Модели автомобилей',
  status: '📊 Статусы сделок',
  seller: '👤 Продавцы',
  review: '⭐ Источники отзывов',
  traffic: '🎯 Источники трафика',
  risk: '⚠️ Уровни риска',
  kr: '💳 КР (кредит)',
  ti: '🔗 ТИ (ти_insurance)',
}

interface ListsSettingsDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
}

function ListsSettingsDialog({ open, onOpenChange }: ListsSettingsDialogProps) {
  const { options, addOption, loadOptions } = useCrmStore()
  const [activeDict, setActiveDict] = useState<string>('model')
  const [newValue, setNewValue] = useState('')

  const handleAdd = async () => {
    const v = newValue.trim()
    if (!v) {
      toast.warning('Введите значение')
      return
    }
    if ((options[activeDict] ?? []).includes(v)) {
      toast.warning('Такое значение уже есть')
      return
    }
    await addOption(activeDict, v)
    setNewValue('')
    toast.success(`Добавлено: ${v}`)
  }

  const handleDelete = async (value: string) => {
    if (!confirm(`Удалить значение "${value}" из справочника "${DICT_LABELS[activeDict] ?? activeDict}"?`)) return
    const { api } = await import('@/lib/api')
    await api.removeOption(activeDict, value)
    await loadOptions()
    toast.success('Удалено')
  }

  const handleRename = async (oldValue: string) => {
    const newValue = prompt(`Переименовать "${oldValue}" на:`, oldValue)
    if (!newValue || newValue === oldValue) return
    const { api } = await import('@/lib/api')
    await api.removeOption(activeDict, oldValue)
    await addOption(activeDict, newValue.trim())
    await loadOptions()
    toast.success('Переименовано')
  }

  const dicts = Object.keys(DICT_LABELS)
  const currentValues = options[activeDict] ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Управление справочниками
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-3 min-h-0 flex-1">
          {/* Dict selector */}
          <div className="w-56 flex-shrink-0 space-y-1 overflow-y-auto crm-scroll">
            {dicts.map((d) => (
              <button
                key={d}
                onClick={() => setActiveDict(d)}
                className={`w-full text-left px-3 py-2 rounded text-xs transition-colors ${
                  activeDict === d
                    ? 'bg-[hsl(221,60%,38%)] text-white font-semibold'
                    : 'bg-[hsl(220,20%,98%)] hover:bg-[hsl(220,20%,95%)] text-[hsl(215,28%,22%)]'
                }`}
              >
                {DICT_LABELS[d]}
                <span className={`block text-[10px] mt-0.5 ${activeDict === d ? 'text-white/70' : 'text-[hsl(215,16%,47%)]'}`}>
                  {options[d]?.length ?? 0} значений
                </span>
              </button>
            ))}
          </div>

          {/* Values list */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex gap-2 mb-3">
              <Input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
                placeholder={`Новое значение для «${DICT_LABELS[activeDict]}»...`}
                className="h-8 text-xs"
              />
              <Button size="sm" onClick={handleAdd} className="h-8">
                <Plus className="w-3.5 h-3.5 mr-1" /> Добавить
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto crm-scroll border border-[hsl(220,16%,90%)] rounded">
              {currentValues.length === 0 ? (
                <div className="text-center py-8 text-xs text-[hsl(215,16%,47%)]">
                  Справочник пуст. Добавьте первое значение выше.
                </div>
              ) : (
                <div className="divide-y">
                  {currentValues.map((v, idx) => (
                    <div key={v} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-[hsl(220,23%,98%)] group">
                      <span className="text-[hsl(215,16%,47%)] w-6 text-right">{idx + 1}.</span>
                      <span className="flex-1">{v}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                        onClick={() => handleRename(v)}
                        title="Переименовать"
                      >
                        ✏️
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-[hsl(0,72%,51%)]"
                        onClick={() => handleDelete(v)}
                        title="Удалить"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-2 text-[10px] text-[hsl(215,16%,47%)] flex items-center gap-1">
              💡 Подсказка: новые значения сразу появятся в выпадающих списках Склада и формы сделки.
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Закрыть</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
