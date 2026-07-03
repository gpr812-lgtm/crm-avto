'use client'

import { useEffect, useMemo, useState } from 'react'
import { useCrmStore } from '@/lib/store'
import { useDebouncedCallback, useDebouncedValue } from '@/hooks/use-debounce'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Plus, Download, Upload, Printer, Calendar, Keyboard, X } from 'lucide-react'
import { SkladTab } from '@/components/crm/sklad-tab'
import { TrafficTab } from '@/components/crm/traffic-tab'
import { PlanFactTab } from '@/components/crm/planfact-tab'
import { AnalyticsTab } from '@/components/crm/analytics-tab'
import { CalendarTab } from '@/components/crm/calendar-tab'
import { HistoryTab } from '@/components/crm/history-tab'
import { DealFormDialog } from '@/components/crm/deal-form-dialog'
import { BackupDialog } from '@/components/crm/backup-dialog'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { highlightMatch } from '@/lib/utils-crm'
import type { TabKey, Deal } from '@/lib/types'

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'sklad', label: 'Склад', icon: '📦' },
  { key: 'traffic', label: 'Трафик', icon: '📊' },
  { key: 'planfact', label: 'План/Факт', icon: '📋' },
  { key: 'analytics', label: 'Аналитика', icon: '📈' },
  { key: 'calendar', label: 'Календарь', icon: '📅' },
  { key: 'history', label: 'История', icon: '📜' },
]

const KEYBOARD_SHORTCUTS = [
  { key: 'Ctrl + S', desc: 'Создать бэкап' },
  { key: 'Ctrl + F', desc: 'Фокус на глобальный поиск' },
  { key: 'Ctrl + P', desc: 'Печать' },
  { key: 'Ctrl + A', desc: 'Выделить все сделки (вкладка Склад)' },
  { key: '?', desc: 'Показать эту подсказку' },
]

export default function HomePage() {
  const {
    activeTab, setActiveTab,
    deals, columns, options, channels,
    loadDeals, loadColumns, loadOptions, loadChannels, loadStats,
    loadComments, loadEvalLinks, loadHistory,
    stats,
  } = useCrmStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [dealFormOpen, setDealFormOpen] = useState(false)
  const [backupOpen, setBackupOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)

  // Initial load
  useEffect(() => {
    loadDeals()
    loadColumns()
    loadOptions()
    loadChannels()
    loadStats()
    loadComments()
    loadEvalLinks()
    loadHistory()
  }, [loadDeals, loadColumns, loadOptions, loadChannels, loadStats, loadComments, loadEvalLinks, loadHistory])

  // Debounced search — only triggers API call for sklad filter; the dropdown uses local filter below
  const debouncedSearch = useDebouncedCallback((q: string) => {
    loadDeals(q ? { search: q } : undefined)
  }, 300)

  const todayStr = useMemo(() => {
    const d = new Date()
    return d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }, [])

  // Local search results for dropdown (across all deals, no API call needed for dropdown)
  const searchResults = useMemo<Deal[]>(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return deals
      .filter((d) => {
        return (
          d.client?.toLowerCase().includes(q) ||
          d.model?.toLowerCase().includes(q) ||
          d.seller?.toLowerCase().includes(q) ||
          d.comment?.toLowerCase().includes(q) ||
          d.status?.toLowerCase().includes(q)
        )
      })
      .slice(0, 10)
  }, [searchQuery, deals])

  const handleBackup = () => setBackupOpen(true)
  const handlePrint = () => window.print()

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable

      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleBackup()
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        document.getElementById('global-search')?.focus()
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault()
        handlePrint()
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !inInput && activeTab === 'sklad') {
        e.preventDefault()
        useCrmStore.getState().selectAll()
      } else if (e.key === '?' && !inInput) {
        e.preventDefault()
        setShortcutsOpen((v) => !v)
      } else if (e.key === 'Escape' && searchFocused) {
        setSearchFocused(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeTab, searchFocused])

  const goToDeal = (dealId: string) => {
    setActiveTab('sklad')
    setSearchQuery('')
    setSearchFocused(false)
    // Scroll to deal — would need element ref; for now just switch tab
    setTimeout(() => {
      const el = document.querySelector(`[data-deal-id="${dealId}"]`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('ring-2', 'ring-[#1a73e8]')
        setTimeout(() => el.classList.remove('ring-2', 'ring-[#1a73e8]'), 2000)
      }
    }, 300)
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="crm-header-gradient text-white px-4 py-2 flex items-center justify-between flex-wrap gap-2 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-2xl">🚗</div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold truncate">CRM Отдел продаж</h1>
            <p className="text-[11px] opacity-85 truncate">Управление сделками и аналитика</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Global search with dropdown */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/70 pointer-events-none" />
            <Input
              id="global-search"
              type="text"
              placeholder="Поиск по сделкам..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                debouncedSearch(e.target.value)
              }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              className="pl-7 h-8 w-56 bg-white/15 border-white/20 text-white placeholder:text-white/70 focus:bg-white/25"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); debouncedSearch('') }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}

            {/* Search results dropdown */}
            {searchFocused && searchQuery.trim() && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white text-[#2c3e50] rounded-md shadow-lg max-h-80 overflow-y-auto z-50 border border-[#e0e0e0]">
                {searchResults.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-[#7f8c8d] text-center">Ничего не найдено</div>
                ) : (
                  <>
                    <div className="px-3 py-1 text-[10px] text-[#7f8c8d] border-b bg-[#f8f9fa]">
                      Найдено: {searchResults.length}{searchResults.length === 10 ? '+' : ''}
                    </div>
                    {searchResults.map((d) => (
                      <button
                        key={d.id}
                        data-deal-id={d.id}
                        onMouseDown={() => goToDeal(d.id)}
                        className="w-full text-left px-3 py-1.5 hover:bg-[#f0f2f5] border-b last:border-b-0 flex items-center justify-between gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">
                            <HighlightedText text={d.model} query={searchQuery} /> —{' '}
                            <HighlightedText text={d.client || 'без клиента'} query={searchQuery} />
                          </div>
                          <div className="text-[10px] text-[#7f8c8d]">
                            {d.seller} • {d.dateDkp || '—'}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] flex-shrink-0">
                          {d.status}
                        </Badge>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          <Button size="sm" variant="secondary"
            onClick={() => setDealFormOpen(true)}
            className="bg-white text-[#2a5298] hover:bg-white/90 h-8"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Сделка
          </Button>

          <Button size="sm" variant="secondary"
            onClick={handleBackup}
            className="bg-white/15 text-white border-white/20 hover:bg-white/25 h-8"
          >
            <Download className="w-3.5 h-3.5 mr-1" /> Бэкап
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShortcutsOpen(true)}
            className="text-white hover:bg-white/15 h-8 w-8 p-0"
            title="Горячие клавиши (?)"
          >
            <Keyboard className="w-4 h-4" />
          </Button>

          <div className="text-[11px] opacity-85 hidden md:block">
            <Calendar className="w-3 h-3 inline mr-1" />
            {todayStr}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-white px-3 flex gap-1 border-b-2 border-[#e0e0e0] flex-shrink-0 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-3.5 py-2 text-xs font-medium whitespace-nowrap border-b-[3px] -mb-[2px] transition-colors ${
              activeTab === t.key
                ? 'text-[#2a5298] border-[#2a5298] font-semibold'
                : 'text-[#7f8c8d] border-transparent hover:text-[#2a5298] hover:bg-[#f8f9fa]'
            }`}
          >
            <span className="mr-1">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {/* Stats bar (only on sklad tab) */}
      {activeTab === 'sklad' && stats && (
        <div className="bg-white border-b px-4 py-2 flex items-center gap-4 text-xs flex-shrink-0 flex-wrap">
          <Badge variant="secondary" className="bg-[#e8f0fe] text-[#1a73e8]">Всего: {stats.total}</Badge>
          <Badge className="bg-[#28a745] hover:bg-[#28a745]">Продан: {stats.sold}</Badge>
          <Badge className="bg-[#ffc107] hover:bg-[#ffc107] text-black">Склад: {stats.inStock}</Badge>
          <Badge className="bg-[#dc3545] hover:bg-[#dc3545]">Отказ: {stats.refused}</Badge>
          <Badge variant="outline">Σ ЖОК: {new Intl.NumberFormat('ru-RU').format(stats.sumJok)} ₽</Badge>
          <Badge variant="outline">Σ К: {new Intl.NumberFormat('ru-RU').format(stats.sumK)} ₽</Badge>
          <Badge variant="outline">ТИ: {stats.tiCount}</Badge>
          <Badge variant="outline">КР: {stats.krCount}</Badge>
        </div>
      )}

      {/* Tab content */}
      <main className="flex-1 overflow-hidden bg-[#f0f2f5]">
        {activeTab === 'sklad' && (
          <SkladTab deals={deals} columns={columns} options={options} />
        )}
        {activeTab === 'traffic' && <TrafficTab />}
        {activeTab === 'planfact' && <PlanFactTab />}
        {activeTab === 'analytics' && <AnalyticsTab />}
        {activeTab === 'calendar' && <CalendarTab />}
        {activeTab === 'history' && <HistoryTab />}
      </main>

      {/* Modals */}
      <DealFormDialog open={dealFormOpen} onOpenChange={setDealFormOpen} />
      <BackupDialog open={backupOpen} onOpenChange={setBackupOpen} />

      {/* Keyboard shortcuts modal */}
      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>⌨️ Горячие клавиши</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {KEYBOARD_SHORTCUTS.map((s) => (
              <div key={s.key} className="flex items-center justify-between text-xs py-1 border-b last:border-b-0">
                <span className="text-[#7f8c8d]">{s.desc}</span>
                <kbd className="px-2 py-1 bg-[#f1f3f4] rounded text-[10px] font-mono border border-[#dadce0]">{s.key}</kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Highlighted text component for search results
function HighlightedText({ text, query }: { text: string; query: string }) {
  const chunks = highlightMatch(text, query)
  return (
    <>
      {chunks.map((c, i) => (
        <span key={i} className={c.isMatch ? 'bg-[#fff3cd] font-semibold' : ''}>
          {c.text}
        </span>
      ))}
    </>
  )
}
