'use client'

import { useEffect, useMemo, useState } from 'react'
import { useCrmStore } from '@/lib/store'
import { useDebouncedCallback } from '@/hooks/use-debounce'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Search, Plus, Download, Printer, Calendar, Keyboard, X, Car,
} from 'lucide-react'
import { SkladTab } from '@/components/crm/sklad-tab'
import { TrafficTab } from '@/components/crm/traffic-tab'
import { PlanFactTab } from '@/components/crm/planfact-tab'
import { AnalyticsTab } from '@/components/crm/analytics-tab'
import { CalendarTab } from '@/components/crm/calendar-tab'
import { HistoryTab } from '@/components/crm/history-tab'
import { DealFormDialog } from '@/components/crm/deal-form-dialog'
import { BackupDialog } from '@/components/crm/backup-dialog'
import {
  SkladSkeleton, TrafficSkeleton, PlanFactSkeleton,
  AnalyticsSkeleton, CalendarSkeleton, HistorySkeleton,
} from '@/components/crm/skeletons'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
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
    deals, columns, options,
    loadDeals, loadColumns, loadOptions, loadChannels, loadStats,
    loadComments, loadEvalLinks, loadHistory,
    stats,
    loading,
  } = useCrmStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [dealFormOpen, setDealFormOpen] = useState(false)
  const [backupOpen, setBackupOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

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
    const t = setTimeout(() => setInitialLoading(false), 800)
    return () => clearTimeout(t)
  }, [loadDeals, loadColumns, loadOptions, loadChannels, loadStats, loadComments, loadEvalLinks, loadHistory])

  const debouncedSearch = useDebouncedCallback((q: string) => {
    loadDeals(q ? { search: q } : undefined)
  }, 300)

  const todayStr = useMemo(() => {
    const d = new Date()
    return d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }, [])

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
    setTimeout(() => {
      const el = document.querySelector(`[data-deal-id="${dealId}"]`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('ring-2', 'ring-[hsl(217,91%,60%)]')
        setTimeout(() => el.classList.remove('ring-2', 'ring-[hsl(217,91%,60%)]'), 2000)
      }
    }, 300)
  }

  // Show skeleton on initial load
  const showSkeleton = initialLoading || loading.deals

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header — компактнее, с Lucide-иконками */}
      <header className="crm-header-gradient text-white px-4 py-2 flex items-center justify-between flex-wrap gap-2 flex-shrink-0 shadow-md">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center backdrop-blur-sm">
            <Car className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold truncate leading-tight">CRM Отдел продаж</h1>
            <p className="text-[11px] opacity-75 truncate leading-tight">Управление сделками и аналитика</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Global search with dropdown */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70 pointer-events-none" />
            <Input
              id="global-search"
              type="text"
              placeholder="Поиск..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                debouncedSearch(e.target.value)
              }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              className="pl-8 pr-7 h-8 w-56 bg-white/10 border-white/15 text-white placeholder:text-white/60 focus:bg-white/20 focus:border-white/30 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); debouncedSearch('') }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                aria-label="Очистить поиск"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Search results dropdown */}
            {searchFocused && searchQuery.trim() && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white text-[hsl(215,28%,22%)] rounded-lg shadow-xl max-h-80 overflow-y-auto z-50 border border-[hsl(220,16%,90%)] crm-scroll">
                {searchResults.length === 0 ? (
                  <div className="px-4 py-6 text-xs text-[hsl(215,16%,47%)] text-center">
                    <Search className="w-5 h-5 mx-auto mb-2 opacity-40" />
                    Ничего не найдено по запросу «{searchQuery}»
                  </div>
                ) : (
                  <>
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-[hsl(215,16%,47%)] border-b bg-[hsl(220,23%,98%)] font-semibold">
                      Найдено: {searchResults.length}{searchResults.length === 10 ? '+' : ''}
                    </div>
                    {searchResults.map((d) => (
                      <button
                        key={d.id}
                        data-deal-id={d.id}
                        onMouseDown={() => goToDeal(d.id)}
                        className="w-full text-left px-3 py-2 hover:bg-[hsl(220,23%,97%)] border-b last:border-b-0 flex items-center justify-between gap-2 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">
                            <HighlightedText text={d.model} query={searchQuery} /> —{' '}
                            <HighlightedText text={d.client || 'без клиента'} query={searchQuery} />
                          </div>
                          <div className="text-[10px] text-[hsl(215,16%,47%)] mt-0.5">
                            {d.seller} • {d.dateDkp || '—'}
                          </div>
                        </div>
                        <StatusBadge status={d.status} />
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Primary action */}
          <Button
            size="sm"
            onClick={() => setDealFormOpen(true)}
            className="bg-white text-[hsl(221,60%,38%)] hover:bg-white/90 h-8 shadow-sm crm-btn font-medium"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Сделка
          </Button>

          {/* Secondary actions */}
          <div className="flex items-center gap-1 bg-white/10 rounded-md p-0.5 border border-white/10">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleBackup}
              className="text-white hover:bg-white/15 h-7 px-2 crm-btn"
              title="Бэкап (Ctrl+S)"
            >
              <Download className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShortcutsOpen(true)}
              className="text-white hover:bg-white/15 h-7 px-2 crm-btn"
              title="Горячие клавиши (?)"
            >
              <Keyboard className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="text-[11px] opacity-75 hidden lg:flex items-center gap-1 pl-2 border-l border-white/15">
            <Calendar className="w-3 h-3" />
            {todayStr}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-white px-3 flex gap-1 border-b border-[hsl(220,16%,90%)] flex-shrink-0 overflow-x-auto shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-all flex items-center gap-1.5 ${
              activeTab === t.key
                ? 'text-[hsl(221,60%,38%)] border-[hsl(221,60%,38%)] font-semibold'
                : 'text-[hsl(215,16%,47%)] border-transparent hover:text-[hsl(221,60%,38%)] hover:bg-[hsl(220,23%,98%)]'
            }`}
          >
            <span className="text-sm">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {/* Stats bar (only on sklad tab) */}
      {activeTab === 'sklad' && stats && (
        <div className="bg-white border-b border-[hsl(220,16%,90%)] px-4 py-2 flex items-center gap-2 text-xs flex-shrink-0 flex-wrap">
          <StatBadge label="Всего" value={stats.total} variant="neutral" />
          <StatBadge label="Продан" value={stats.sold} variant="success" />
          <StatBadge label="Склад" value={stats.inStock} variant="warning" />
          <StatBadge label="Призраки" value={stats.ghost} variant="ghost" />
          <StatBadge label="Отказ" value={stats.refused} variant="danger" />
        </div>
      )}

      {/* Tab content with skeletons */}
      <main className="flex-1 overflow-hidden bg-[hsl(220,23%,96%)]">
        <div key={activeTab} className="crm-fade-in h-full">
          {activeTab === 'sklad' && (showSkeleton
            ? <SkladSkeleton />
            : <SkladTab deals={deals} columns={columns} options={options} />)}
          {activeTab === 'traffic' && <TrafficTab />}
          {activeTab === 'planfact' && <PlanFactTab />}
          {activeTab === 'analytics' && <AnalyticsTab />}
          {activeTab === 'calendar' && <CalendarTab />}
          {activeTab === 'history' && <HistoryTab />}
        </div>
      </main>

      {/* Modals */}
      <DealFormDialog open={dealFormOpen} onOpenChange={setDealFormOpen} />
      <BackupDialog open={backupOpen} onOpenChange={setBackupOpen} />

      {/* Keyboard shortcuts modal */}
      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="w-4 h-4" />
              Горячие клавиши
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1 py-2">
            {KEYBOARD_SHORTCUTS.map((s) => (
              <div key={s.key} className="flex items-center justify-between text-sm py-2 border-b last:border-b-0">
                <span className="text-[hsl(215,16%,47%)]">{s.desc}</span>
                <kbd className="px-2 py-1 bg-[hsl(220,20%,95%)] rounded text-[11px] font-mono border border-[hsl(220,16%,90%)] shadow-sm">{s.key}</kbd>
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
        <span key={i} className={c.isMatch ? 'bg-[hsl(38,92%,90%)] font-semibold rounded px-0.5' : ''}>
          {c.text}
        </span>
      ))}
    </>
  )
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    'Продан': 'bg-[hsl(142,60%,95%)] text-[hsl(142,60%,30%)] border-[hsl(142,50%,70%)]',
    'Склад': 'bg-[hsl(38,90%,95%)] text-[hsl(32,80%,35%)] border-[hsl(38,80%,70%)]',
    'Отказ': 'bg-[hsl(0,70%,96%)] text-[hsl(0,70%,40%)] border-[hsl(0,60%,75%)]',
    'Призрак': 'bg-[hsl(280,20%,95%)] text-[hsl(280,30%,40%)] border-[hsl(280,20%,70%)]',
  }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${styles[status] || 'bg-gray-100 text-gray-700 border-gray-300'}`}>
      {status}
    </span>
  )
}

// Stat badge component
function StatBadge({ label, value, variant }: { label: string; value: string | number; variant: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'ghost' }) {
  const styles = {
    neutral: 'bg-[hsl(220,20%,95%)] text-[hsl(215,28%,22%)]',
    success: 'bg-[hsl(142,60%,95%)] text-[hsl(142,60%,30%)]',
    warning: 'bg-[hsl(38,90%,95%)] text-[hsl(32,80%,35%)]',
    danger: 'bg-[hsl(0,70%,96%)] text-[hsl(0,70%,40%)]',
    info: 'bg-[hsl(217,91%,95%)] text-[hsl(221,60%,35%)]',
    ghost: 'bg-[hsl(280,20%,95%)] text-[hsl(280,30%,40%)]',
  }
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${styles[variant]}`}>
      <span className="opacity-70">{label}:</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  )
}
