'use client'

import { useEffect, useState } from 'react'
import { useCrmStore } from '@/lib/store'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import type { Deal } from '@/lib/types'

interface DealFormDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  initialDeal?: Deal | null
}

const EMPTY_FORM = {
  model: 'Tenet T7',
  status: 'Продан',
  dateDkp: '',
  dateIssued: '',
  seller: '',
  client: '',
  jok: 0,
  j: 0,
  o: 0,
  k: 0,
  risk: '1',
  kr: '0',
  ti: '0',
  review: 'Нет отзыва',
  traffic: '🚶 Визит',
  comment: '',
}

export function DealFormDialog({ open, onOpenChange, initialDeal }: DealFormDialogProps) {
  const { options, addDeal, editDeal } = useCrmStore()
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      if (initialDeal) {
        setForm({
          model: initialDeal.model ?? 'Tenet T7',
          status: initialDeal.status ?? 'Продан',
          dateDkp: initialDeal.dateDkp ?? '',
          dateIssued: initialDeal.dateIssued ?? '',
          seller: initialDeal.seller ?? '',
          client: initialDeal.client ?? '',
          jok: initialDeal.jok ?? 0,
          j: initialDeal.j ?? 0,
          o: initialDeal.o ?? 0,
          k: initialDeal.k ?? 0,
          risk: initialDeal.risk ?? '1',
          kr: initialDeal.kr ?? '0',
          ti: initialDeal.ti ?? '0',
          review: initialDeal.review ?? 'Нет отзыва',
          traffic: initialDeal.traffic ?? '🚶 Визит',
          comment: initialDeal.comment ?? '',
        })
      } else {
        setForm({ ...EMPTY_FORM })
      }
    }
  }, [open, initialDeal])

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const handleSubmit = async () => {
    if (!form.client.trim()) {
      toast.warning('Укажите ФИО клиента')
      return
    }
    setSaving(true)
    try {
      if (initialDeal) {
        await editDeal(initialDeal.id, form)
        toast.success('Сделка обновлена')
      } else {
        await addDeal(form)
        toast.success('Сделка добавлена')
      }
      onOpenChange(false)
    } catch (e) {
      toast.error('Не удалось сохранить сделку')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialDeal ? '✏️ Редактирование сделки' : '➕ Новая сделка'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2">
          {/* Left column */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="model">Модель</Label>
              <Select value={form.model} onValueChange={(v) => set('model', v)}>
                <SelectTrigger id="model"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(options.model ?? []).map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status">Статус</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v)}>
                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(options.status ?? []).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="seller">Продавец</Label>
              <Select value={form.seller || '_none'} onValueChange={(v) => set('seller', v === '_none' ? '' : v)}>
                <SelectTrigger id="seller"><SelectValue placeholder="(не выбран)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">(не выбран)</SelectItem>
                  {(options.seller ?? []).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="client">Клиент (ФИО)</Label>
              <Input id="client" value={form.client} onChange={(e) => set('client', e.target.value)} placeholder="Иванов Иван Иванович" />
            </div>

            <div>
              <Label htmlFor="dateDkp">Дата ДКП</Label>
              <Input id="dateDkp" type="date" value={form.dateDkp} onChange={(e) => set('dateDkp', e.target.value)} />
            </div>

            <div>
              <Label htmlFor="dateIssued">Дата выдачи</Label>
              <Input id="dateIssued" type="date" value={form.dateIssued} onChange={(e) => set('dateIssued', e.target.value)} />
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="jok">ЖОК (₽)</Label>
                <Input id="jok" type="number" value={form.jok} onChange={(e) => set('jok', Number(e.target.value) || 0)} />
              </div>
              <div>
                <Label htmlFor="j">Ж (₽)</Label>
                <Input id="j" type="number" value={form.j} onChange={(e) => set('j', Number(e.target.value) || 0)} />
              </div>
              <div>
                <Label htmlFor="o">О (₽)</Label>
                <Input id="o" type="number" value={form.o} onChange={(e) => set('o', Number(e.target.value) || 0)} />
              </div>
              <div>
                <Label htmlFor="k">К (₽)</Label>
                <Input id="k" type="number" value={form.k} onChange={(e) => set('k', Number(e.target.value) || 0)} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="risk">РИСК</Label>
                <Select value={form.risk} onValueChange={(v) => set('risk', v)}>
                  <SelectTrigger id="risk"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(options.risk ?? []).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="kr">КР</Label>
                <Select value={form.kr} onValueChange={(v) => set('kr', v)}>
                  <SelectTrigger id="kr"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(options.kr ?? []).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="ti">ТИ</Label>
                <Select value={form.ti} onValueChange={(v) => set('ti', v)}>
                  <SelectTrigger id="ti"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(options.ti ?? []).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="review">Отзыв</Label>
              <Select value={form.review} onValueChange={(v) => set('review', v)}>
                <SelectTrigger id="review"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(options.review ?? []).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="traffic">Трафик</Label>
              <Select value={form.traffic} onValueChange={(v) => set('traffic', v)}>
                <SelectTrigger id="traffic"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(options.traffic ?? []).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="col-span-2">
            <Label htmlFor="comment">Комментарий</Label>
            <Textarea id="comment" value={form.comment} onChange={(e) => set('comment', e.target.value)} rows={2} placeholder="Дополнительная информация..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Сохранение...' : initialDeal ? 'Сохранить' : 'Добавить сделку'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
