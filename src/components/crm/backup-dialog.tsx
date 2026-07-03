'use client'

import { useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Download, Upload, AlertTriangle } from 'lucide-react'

interface BackupDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function BackupDialog({ open, onOpenChange }: BackupDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [restoring, setRestoring] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res = await api.downloadBackup()
      if (!res.ok) throw new Error('Backup failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `crm-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success('Бэкап создан')
      onOpenChange(false)
    } catch (e) {
      toast.error('Не удалось создать бэкап')
    } finally {
      setDownloading(false)
    }
  }

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!confirm('Внимание: восстановление заменит ВСЕ текущие данные. Продолжить?')) {
      e.target.value = ''
      return
    }

    setRestoring(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      await api.restoreBackup(data)
      toast.success('Бэкап восстановлен. Перезагрузите страницу для обновления.')
      setTimeout(() => window.location.reload(), 1500)
    } catch (e) {
      console.error(e)
      toast.error('Не удалось восстановить бэкап (неверный формат?)')
    } finally {
      setRestoring(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>💾 Резервное копирование</DialogTitle>
          <DialogDescription>
            Создайте полный бэкап всех данных CRM (сделки, трафик, план-факт, история) в один JSON-файл,
            либо восстановите данные из ранее сохранённого бэкапа.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Button onClick={handleDownload} disabled={downloading} className="w-full">
            <Download className="w-4 h-4 mr-2" />
            {downloading ? 'Создание...' : 'Скачать бэкап (JSON)'}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">или</span>
            </div>
          </div>

          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={restoring} className="w-full">
            <Upload className="w-4 h-4 mr-2" />
            {restoring ? 'Восстановление...' : 'Восстановить из файла'}
          </Button>
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleRestore} className="hidden" />

          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 flex gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Восстановление заменит ВСЕ текущие данные. Рекомендуется сначала создать свежий бэкап.</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Закрыть</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
