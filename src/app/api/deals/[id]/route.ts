import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { addHistory } from '@/lib/utils-crm'

// PATCH /api/deals/[id] — update one or more fields of a deal
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    const existing = await db.deal.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    // Detect changes for history
    const changes: string[] = []
    for (const [k, v] of Object.entries(body)) {
      const oldV = (existing as Record<string, unknown>)[k]
      if (String(oldV ?? '') !== String(v ?? '')) {
        changes.push(`${k}: "${String(oldV ?? '')}" → "${String(v ?? '')}"`)
      }
    }

    const deal = await db.deal.update({ where: { id }, data: body })
    if (changes.length > 0) {
      await addHistory('edit', `Изменена сделка ${deal.model} — ${deal.client || 'без клиента'}: ${changes.join(', ')}`)
    }
    return NextResponse.json({ deal })
  } catch (e) {
    console.error('PATCH /api/deals/[id] error:', e)
    return NextResponse.json({ error: 'Failed to update deal' }, { status: 500 })
  }
}

// DELETE /api/deals/[id] — delete a deal and archive its evaluation link
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.deal.findUnique({
      where: { id },
      include: { evaluationLink: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    // Archive the link if it exists
    if (existing.evaluationLink) {
      await db.linksArchive.create({
        data: {
          dealId: id,
          url: existing.evaluationLink.url,
          model: existing.model,
          client: existing.client,
        },
      })
    }

    await db.deal.delete({ where: { id } })
    await addHistory('delete', `Удалена сделка: ${existing.model} — ${existing.client || 'без клиента'}`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/deals/[id] error:', e)
    return NextResponse.json({ error: 'Failed to delete deal' }, { status: 500 })
  }
}
