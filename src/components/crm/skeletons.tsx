/**
 * Skeleton loaders for CRM tabs
 */
import { Card } from '@/components/ui/card'

export function SkladSkeleton() {
  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b px-3 py-2 flex items-center gap-2 flex-shrink-0">
        <div className="crm-skeleton h-7 w-24" />
        <div className="crm-skeleton h-7 w-32" />
        <div className="crm-skeleton h-7 w-28" />
        <div className="crm-skeleton h-7 w-24" />
        <div className="flex-1" />
        <div className="crm-skeleton h-7 w-20" />
        <div className="crm-skeleton h-7 w-20" />
        <div className="crm-skeleton h-7 w-20" />
      </div>
      <div className="flex-1 overflow-auto p-3">
        <Card className="p-3">
          <div className="space-y-2">
            <div className="crm-skeleton h-8 w-full" />
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="crm-skeleton h-7 w-full" style={{ opacity: 1 - i * 0.05 }} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

export function TrafficSkeleton() {
  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b px-3 py-2 flex items-center gap-3 flex-shrink-0">
        <div className="crm-skeleton h-7 w-32" />
        <div className="flex-1" />
        <div className="crm-skeleton h-7 w-20" />
      </div>
      <div className="bg-gradient-to-br from-[hsl(233,80%,67%)] to-[hsl(252,56%,50%)] h-20 flex-shrink-0" />
      <div className="flex-1 overflow-auto p-2 space-y-3">
        <Card className="p-0 overflow-hidden">
          <div className="crm-skeleton h-8 w-full" />
          <div className="p-2 space-y-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="crm-skeleton h-6 w-full" />
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

export function PlanFactSkeleton() {
  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b px-3 py-2 flex items-center gap-3 flex-shrink-0">
        <div className="crm-skeleton h-7 w-32" />
        <div className="flex-1" />
        <div className="crm-skeleton h-7 w-24" />
        <div className="crm-skeleton h-7 w-24" />
      </div>
      <div className="flex-1 overflow-auto p-2">
        <Card className="p-0 overflow-hidden">
          <div className="crm-skeleton h-8 w-full" />
          <div className="p-2 space-y-1.5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="crm-skeleton h-6 w-full" />
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

export function AnalyticsSkeleton() {
  return (
    <div className="h-full overflow-auto p-3 space-y-3">
      <Card className="p-3">
        <div className="flex gap-3 flex-wrap">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="crm-skeleton h-7 w-28" />
          ))}
        </div>
      </Card>
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-3">
            <div className="crm-skeleton h-3 w-20 mb-2" />
            <div className="crm-skeleton h-6 w-24" />
          </Card>
        ))}
      </div>
      <Card className="overflow-hidden">
        <div className="p-2 space-y-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="crm-skeleton h-7 w-full" />
          ))}
        </div>
      </Card>
    </div>
  )
}

export function CalendarSkeleton() {
  return (
    <div className="h-full overflow-auto p-3 space-y-3">
      <Card className="p-3 flex items-center gap-3">
        <div className="crm-skeleton h-7 w-32" />
        <div className="flex-1" />
        <div className="crm-skeleton h-6 w-28" />
        <div className="crm-skeleton h-6 w-28" />
      </Card>
      <Card className="p-3">
        <div className="crm-calendar-grid">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="crm-skeleton h-20" />
          ))}
        </div>
      </Card>
    </div>
  )
}

export function HistorySkeleton() {
  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b px-3 py-2 flex items-center gap-2 flex-shrink-0">
        <div className="crm-skeleton h-7 w-48" />
        <div className="flex-1" />
        <div className="crm-skeleton h-7 w-20" />
        <div className="crm-skeleton h-7 w-24" />
      </div>
      <div className="flex-1 overflow-auto p-3">
        <Card className="divide-y">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="px-3 py-2 flex items-center gap-3">
              <div className="crm-skeleton h-5 w-20" />
              <div className="flex-1 space-y-1">
                <div className="crm-skeleton h-3 w-3/4" />
                <div className="crm-skeleton h-2 w-1/4" />
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
