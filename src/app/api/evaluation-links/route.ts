import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { normalizeUrl, addHistory } from '@/lib/utils-crm'

// GET /api/evaluation-links
export async function GET() {
  try {
    const links = await db.evaluationLink.findMany()
    const map: Record<string, string> = {}
    for (const l of links) map[l.dealId] = l.url
    return NextResponse.json({ links: map })
  } catch (e) {
    console.error('GET /api/evaluation-links error:', e)
    return NextResponse.json({ error: 'Failed to load links' }, { status: 500 })
  }
}

// POST /api/evaluation-links — set/update link for a deal
// Body: { dealId, url }
export async function POST(req: NextRequest) {
  try {
    const { dealId, url } = await req.json()
    if (!dealId) return NextResponse.json({ error: 'dealId required' }, { status: 400 })

    const normalized = normalizeUrl(url)
    if (!normalized) return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })

    const link = await db.evaluationLink.upsert({
      where: { dealId },
      update: { url: normalized },
      create: { dealId, url: normalized },
    })

    const deal = await db.deal.findUnique({ where: { id: dealId } })
    await addHistory('edit', `Добавлена ссылка ТИ для сделки ${deal?.model ?? ''} — ${deal?.client ?? ''}`)

    return NextResponse.json({ link })
  } catch (e) {
    console.error('POST /api/evaluation-links error:', e)
    return NextResponse.json({ error: 'Failed to save link' }, { status: 500 })
  }
}

// DELETE /api/evaluation-links?dealId=...
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const dealId = url.searchParams.get('dealId')
    if (!dealId) return NextResponse.json({ error: 'dealId required' }, { status: 400 })

    await db.evaluationLink.deleteMany({ where: { dealId } })
    const deal = await db.deal.findUnique({ where: { id: dealId } })
    await addHistory('delete', `Удалена ссылка ТИ для сделки ${deal?.model ?? ''} — ${deal?.client ?? ''}`)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/evaluation-links error:', e)
    return NextResponse.json({ error: 'Failed to delete link' }, { status: 500 })
  }
}
