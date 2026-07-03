import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { addHistory } from '@/lib/utils-crm'

/**
 * Compute jok = j + o + k (ЖОК is always auto-calculated, never user-set)
 */
function computeJok(data: Record<string, unknown>): number {
  const j = Number(data.j) || 0
  const o = Number(data.o) || 0
  const k = Number(data.k) || 0
  return j + o + k
}

// GET /api/deals — list deals with optional filters
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const status = url.searchParams.get('status') || undefined
    const model = url.searchParams.get('model') || undefined
    const seller = url.searchParams.get('seller') || undefined
    const search = url.searchParams.get('search') || undefined

    const deals = await db.deal.findMany({
      where: {
        AND: [
          status ? { status } : {},
          model ? { model } : {},
          seller ? { seller } : {},
          search
            ? {
                OR: [
                  { client: { contains: search } },
                  { comment: { contains: search } },
                  { seller: { contains: search } },
                  { model: { contains: search } },
                ],
              }
            : {},
        ],
      },
      orderBy: { order: 'asc' },
      include: { evaluationLink: true },
    })
    return NextResponse.json({ deals })
  } catch (e) {
    console.error('GET /api/deals error:', e)
    return NextResponse.json({ error: 'Failed to load deals' }, { status: 500 })
  }
}

// POST /api/deals — create a new deal
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // Always compute jok from j + o + k (never trust client-provided jok)
    const jok = computeJok(body)
    const maxOrder = await db.deal.aggregate({ _max: { order: true } })

    // Strip jok from body to prevent override
    const { jok: _ignoredJok, ...rest } = body
    const deal = await db.deal.create({
      data: {
        ...rest,
        jok,
        order: (maxOrder._max.order ?? 0) + 1,
      },
    })
    await addHistory('add', `Добавлена сделка: ${deal.model} — ${deal.client || 'без клиента'}`)
    return NextResponse.json({ deal }, { status: 201 })
  } catch (e) {
    console.error('POST /api/deals error:', e)
    return NextResponse.json({ error: 'Failed to create deal' }, { status: 500 })
  }
}
