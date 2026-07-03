import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { addHistory } from '@/lib/utils-crm'

// POST /api/deals/bulk — bulk operations
// Body: { action: 'delete', ids: string[] } | { action: 'duplicate', ids: string[] }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, ids } = body as { action: string; ids: string[] }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids required' }, { status: 400 })
    }

    if (action === 'delete') {
      // Archive links
      const deals = await db.deal.findMany({
        where: { id: { in: ids } },
        include: { evaluationLink: true },
      })
      for (const d of deals) {
        if (d.evaluationLink) {
          await db.linksArchive.create({
            data: { dealId: d.id, url: d.evaluationLink.url, model: d.model, client: d.client },
          })
        }
      }
      await db.deal.deleteMany({ where: { id: { in: ids } } })
      await addHistory('bulk', `Массовое удаление: ${ids.length} сделок`)
      return NextResponse.json({ ok: true, deleted: ids.length })
    }

    if (action === 'duplicate') {
      const deals = await db.deal.findMany({ where: { id: { in: ids } }, include: { evaluationLink: true } })
      const maxOrder = await db.deal.aggregate({ _max: { order: true } })
      let nextOrder = (maxOrder._max.order ?? 0) + 1
      const created: string[] = []
      for (const d of deals) {
        const { id, evaluationLink, createdAt, updatedAt, ...data } = d
        const newDeal = await db.deal.create({ data: { ...data, order: nextOrder++ } })
        if (evaluationLink) {
          await db.evaluationLink.create({ data: { dealId: newDeal.id, url: evaluationLink.url } })
        }
        created.push(newDeal.id)
      }
      await addHistory('bulk', `Дублировано ${created.length} сделок`)
      return NextResponse.json({ ok: true, created })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    console.error('POST /api/deals/bulk error:', e)
    return NextResponse.json({ error: 'Failed bulk operation' }, { status: 500 })
  }
}
