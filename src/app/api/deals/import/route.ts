import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { addHistory } from '@/lib/utils-crm'

// POST /api/deals/import — bulk import deals from CSV/JSON
// Body: { deals: Partial<Deal>[], mode?: 'append' | 'replace' }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { deals: rows, mode = 'append' } = body as { deals: Record<string, unknown>[]; mode?: 'append' | 'replace' }

    if (!Array.isArray(rows)) return NextResponse.json({ error: 'deals array required' }, { status: 400 })

    // Get all columns to validate keys
    const columns = await db.dealColumn.findMany({ orderBy: { order: 'asc' } })
    const columnKeys = new Set(columns.map((c) => c.key))

    const maxOrder = await db.deal.aggregate({ _max: { order: true } })
    let nextOrder = (maxOrder._max.order ?? 0) + 1

    const created: string[] = []

    await db.$transaction(async (tx) => {
      if (mode === 'replace') {
        await tx.evaluationLink.deleteMany({})
        await tx.deal.deleteMany({})
        nextOrder = 1
      }

      for (const row of rows) {
        // Pick only known column keys
        const data: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(row)) {
          if (columnKeys.has(k) && k !== 'id') {
            data[k] = v
          }
        }
        // Skip empty rows (no model + no client)
        if (!data.model && !data.client) continue

        const j = Number(data.j) || 0
        const o = Number(data.o) || 0
        const k = Number(data.k) || 0
        const deal = await tx.deal.create({
          data: {
            model: String(data.model ?? 'Tenet T7'),
            status: String(data.status ?? 'Продан'),
            dateDkp: data.dateDkp ? String(data.dateDkp) : null,
            dateIssued: data.dateIssued ? String(data.dateIssued) : null,
            seller: data.seller ? String(data.seller) : null,
            client: data.client ? String(data.client) : null,
            // jok = j + o + k (always auto-calculated, ignore any provided jok)
            jok: j + o + k,
            j,
            o,
            k,
            risk: String(data.risk ?? '1'),
            kr: String(data.kr ?? '0'),
            ti: String(data.ti ?? '0'),
            review: String(data.review ?? 'Нет отзыва'),
            traffic: String(data.traffic ?? '🚶 Визит'),
            comment: data.comment ? String(data.comment) : null,
            order: nextOrder++,
          },
        })
        created.push(deal.id)
      }
    })

    await addHistory('bulk', `Импортировано ${created.length} сделок (режим: ${mode})`)

    return NextResponse.json({ ok: true, imported: created.length })
  } catch (e) {
    console.error('POST /api/deals/import error:', e)
    return NextResponse.json({ error: 'Failed to import deals' }, { status: 500 })
  }
}
