'use client'

import { useEffect, useMemo, useState } from 'react'
import { useCrmStore } from '@/lib/store'
import { useDebouncedCallback } from '@/hooks/use-debounce'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Plus, Download, Upload, Printer, Calendar } from 'lucide-react'
import { SkladTab } from '@/components/crm/sklad-tab'
import { TrafficTab } from '@/components/crm/traffic-tab'
import { PlanFactTab } from '@/components/crm/planfact-tab'
import { AnalyticsTab } from '@/components/crm/analytics-tab'
import { CalendarTab } from '@/components/crm/calendar-tab'
import { HistoryTab } from '@/components/crm/history-tab'
import { DealFormDialog } from '@/components/crm/deal-form-dialog'
import { BackupDialog } from '@/components/crm/backup-dialog'
import { toast } from 'sonner'
import type { TabKey } from '@/lib/types'

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'sklad', label: 'Склад', icon: '📦' },
  { key: 'traffic', label: 'Трафик', icon: '📊' },
  { key: 'planfact', label: 'План/Факт', icon: '📋' },
  { key: 'analytics', label: 'Аналитика', icon: '📈' },
  { key: 'calendar', label: 'Календарь', icon: '📅' },
  { key: 'history', label: 'История', icon: '📜' },
]

export default function HomePage() {
  const {
    activeTab,
    setActiveTab,
    deals,
    columns,
    options,
    channels,
    loadDeals,
    loadColumns,
    loadOptions,
    loadChannels,
    loadStats,
    loadComments,
    loadEvalLinks,
    loadHistory,
    stats,
  } = useCrmStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [dealFormOpen, setDealFormOpen] = useState(false)
  const [backupOpen, setBackupOpen] = useState(false)

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

  // Debounced search (FIX: original had no debounce)
  const debouncedSearch = useDebouncedCallback((q: string) => {
    loadDeals(q ? { search: q } : undefined)
  }, 300)

  const todayStr = useMemo(() => {
    const d = new Date()
    return d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }, [])

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
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeTab])

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
          {/* Global search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/70" />
            <Input
              id="global-search"
              type="text"
              placeholder="Поиск по сделкам..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                debouncedSearch(e.target.value)
              }}
              className="pl-7 h-8 w-56 bg-white/15 border-white/20 text-white placeholder:text-white/70 focus:bg-white/25"
            />
          </div>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => setDealFormOpen(true)}
            className="bg-white text-[#2a5298] hover:bg-white/90 h-8"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Сделка
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={handleBackup}
            className="bg-white/15 text-white border-white/20 hover:bg-white/25 h-8"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            Бэкап
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
    </div>
  )
}
