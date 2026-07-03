'use client'

import { useMemo, useState } from 'react'
import { useCrmStore } from '@/lib/store'
import { api } from '@/lib/api'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Plus, Download, Upload, Trash2, Copy, ArrowUp, ArrowDown, Link as LinkIcon,
  ExternalLink, Filter, Printer, ChevronUp, ChevronDown, FileSpreadsheet,
} from 'lucide-react'
import { formatNumber, parseRuNumber } from '@/lib/utils-crm'
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
    evalLinks,
    saveEvalLink,
    removeEvalLink,
    addOption,
  } = useCrmStore()

  const [filters, setFilters] = useState<FilterState>({})
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [linkDialog, setLinkDialog] = useState<{ dealId: string; currentUrl?: string } | null>(null)
  const [linkInput, setLinkInput] = useState('')

  // Filter dropdowns: only first 4 select-type columns
  const filterColumns = useMemo(() => {
    return columns.filter((c) => c.type === 'select').slice(0, 4)
  }, [columns])

  // Apply filters and sort
  const filteredDeals = useMemo(() => {
    let result = [...deals]

    // Apply filters
    for (const [key, value] of Object.entries(filters)) {
      if (value) {
        result = result.filter((d) => String((d as Record<string, unknown>)[key] ?? '') === value)
      }
    }

    // Apply sort
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
  }, [deals, filters, sortKey, sortDir])

  // Compute totals for number columns
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
      setSortKey(key)
      setSortDir('asc')
    } else if (sortDir === 'asc') {
      setSortDir('desc')
    } else if (sortDir === 'desc') {
      setSortKey(null)
      setSortDir(null)
    } else {
      setSortDir('asc')
    }
  }

  const handleCellEdit = async (deal: Deal, key: string, value: string, col: DealColumn) => {
    const oldValue = String((deal as Record<string, unknown>)[key] ?? '')
    if (oldValue === value) return

    let parsed: string | number = value
    if (col.type === 'number') {
      parsed = parseRuNumber(value)
    }
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

  // Excel Export (simple HTML table — opens in Excel)
  const handleExportExcel = () => {
    const headers = columns.map((c) => c.label)
    const rows = filteredDeals.map((d) =>
      columns.map((c) => String((d as Record<string, unknown>)[c.key] ?? ''))
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

  const handlePrint = () => window.print()

  const allSelected = filteredDeals.length > 0 && filteredDeals.every((d) => selectedDealIds.has(d.id))

  // Empty state
  if (deals.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-3">📦</div>
          <h2 className="text-lg font-semibold mb-2">Список сделок пуст</h2>
          <p className="text-sm text-[#7f8c8d] mb-4">
            Нажмите «Сделка» в шапке, чтобы добавить первую запись.
          </p>
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
            className="h-7 px-2 text-xs border border-[#ddd] rounded focus:outline-none focus:border-[#2a5298]"
          >
            <option value="">{col.label}: все</option>
            {(options[col.options ?? ''] ?? []).map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => setFilters({})}
          disabled={Object.values(filters).every((v) => !v)}
        >
          Сбросить
        </Button>

        <div className="flex-1" />

        {selectedDealIds.size > 0 && (
          <>
            <Badge variant="secondary" className="bg-[#e8f0fe] text-[#1a73e8]">
              Выбрано: {selectedDealIds.size}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => duplicateDealsBulk(Array.from(selectedDealIds))}
            >
              <Copy className="w-3 h-3 mr-1" /> Дублировать
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs"
              onClick={handleBulkDelete}
            >
              <Trash2 className="w-3 h-3 mr-1" /> Удалить выбранные
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={clearSelection}
            >
              Снять выделение
            </Button>
          </>
        )}

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
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-[#f1f3f4]">
              <th className="border border-[#dadce0] px-2 py-1.5 w-8 sticky left-0 z-20">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(v) => (v ? selectAll() : clearSelection())}
                />
              </th>
              <th className="border border-[#dadce0] px-2 py-1.5 w-10">№</th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="border border-[#dadce0] px-2 py-1.5 cursor-pointer select-none whitespace-nowrap hover:bg-[#e8f0fe]"
                  style={{ minWidth: col.width, width: col.width }}
                  onClick={() => toggleSort(col.key)}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{col.label}</span>
                    {sortKey === col.key && (
                      sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> :
                      sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : null
                    )}
                  </div>
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
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelection(deal.id)}
                        />
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
            <DialogTitle>Ссылка ТИ</DialogTitle>
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (linkDialog) window.open(linkDialog.currentUrl, '_blank', 'noopener,noreferrer')
                }}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1" /> Открыть текущую
              </Button>
            )}
          </div>
          <DialogFooter>
            {linkDialog?.currentUrl && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (linkDialog) handleRemoveLink(linkDialog.dealId)
                  setLinkDialog(null)
                }}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Удалить
              </Button>
            )}
            <Button variant="outline" onClick={() => setLinkDialog(null)}>Отмена</Button>
            <Button onClick={handleSaveLink}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

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

  // TI cell with link — special behaviour
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

  // text
  return (
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
        if (isTiWithLink) {
          e.preventDefault()
          onOpenLinkMenu()
        }
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
  )
}
