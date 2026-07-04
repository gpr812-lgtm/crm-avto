'use client'

import { useState } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Building2, Check, ChevronDown } from 'lucide-react'

export function DealershipDropdown() {
  const { user, selectedDealershipIds, toggleDealership, selectAllDealerships, selectSingleDealership } = useAuthStore()
  const [open, setOpen] = useState(false)

  if (!user || user.dealerships.length === 0) return null

  const selectedCount = selectedDealershipIds.size
  const totalCount = user.dealerships.length
  const allSelected = selectedCount === totalCount
  const label = allSelected
    ? 'Все автосалоны'
    : selectedCount === 1
      ? user.dealerships.find((d) => selectedDealershipIds.has(d.id))?.name || 'Автосалон'
      : `${selectedCount} автосалона`

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 bg-white/10 border border-white/15 rounded-md px-2.5 py-1.5 text-xs text-white hover:bg-white/20 transition-colors"
      >
        <Building2 className="w-3.5 h-3.5" />
        <span className="font-medium whitespace-nowrap">{label}</span>
        <ChevronDown className="w-3 h-3 opacity-70" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-1 bg-white text-[hsl(215,28%,22%)] rounded-lg shadow-xl border border-[hsl(220,16%,90%)] z-50 min-w-56 crm-scroll">
            <div className="px-3 py-2 border-b bg-[hsl(220,20%,98%)] flex items-center justify-between">
              <span className="text-[10px] uppercase font-semibold text-[hsl(215,16%,47%)]">Автосалоны</span>
              <button
                onClick={() => selectAllDealerships()}
                className="text-[10px] text-[hsl(221,60%,38%)] hover:underline font-medium"
              >
                Выбрать все
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto crm-scroll">
              {user.dealerships.map((d) => {
                const selected = selectedDealershipIds.has(d.id)
                return (
                  <button
                    key={d.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleDealership(d.id)
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-[hsl(220,23%,97%)] flex items-center justify-between gap-2 border-b last:border-b-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{d.name}</div>
                      {d.code && <div className="text-[10px] text-[hsl(215,16%,60%)]">{d.code}</div>}
                    </div>
                    {selected && <Check className="w-3.5 h-3.5 text-[hsl(142,60%,35%)] flex-shrink-0" />}
                  </button>
                )
              })}
            </div>
            <div className="px-3 py-2 border-t bg-[hsl(220,20%,98%)] text-[10px] text-[hsl(215,16%,47%)] text-center">
              Выбрано: {selectedCount} из {totalCount}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
