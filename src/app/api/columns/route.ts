import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { addHistory } from '@/lib/utils-crm'

// GET /api/columns — list all deal columns
export async function GET() {
  try {
    const cols = await db.dealColumn.findMany({ orderBy: { order: 'asc' } })
    return NextResponse.json({ columns: cols })
  } catch (e) {
    console.error('GET /api/columns error:', e)
    return NextResponse.json({ error: 'Failed to load columns' }, { status: 500 })
  }
}

// POST /api/columns — create new column
// Body: { key, label, type, options?, default?, width?, insertAfter?: string (key of existing column) }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { key, label, type = 'text', options = null, default: defaultValue = '', width = 100, insertAfter } = body

    if (!key || !label) return NextResponse.json({ error: 'key and label required' }, { status: 400 })

    // Check key uniqueness
    const existing = await db.dealColumn.findFirst({ where: { dealershipId_key: { dealershipId: 1, key } } })
    if (existing) return NextResponse.json({ error: 'key already exists' }, { status: 400 })

    // Compute order: if insertAfter given, insert after that column; else append
    let order = 0
    if (insertAfter) {
      const after = await db.dealColumn.findFirst({ where: { key: insertAfter } })
      if (after) {
        order = after.order + 1
        // Shift all columns after this one
        await db.dealColumn.updateMany({
          where: { order: { gt: after.order } },
          data: { order: { increment: 1 } },
        })
      }
    } else {
      const maxOrder = await db.dealColumn.aggregate({ _max: { order: true } })
      order = (maxOrder._max.order ?? 0) + 1
    }

    const col = await db.dealColumn.create({
      data: {
        key,
        label,
        type,
        options: options || null,
        default: defaultValue,
        width,
        order,
      },
    })
    await addHistory('add', `Добавлена колонка: ${label}`)
    return NextResponse.json({ column: col }, { status: 201 })
  } catch (e) {
    console.error('POST /api/columns error:', e)
    return NextResponse.json({ error: 'Failed to create column' }, { status: 500 })
  }
}

// PATCH /api/columns — update column properties (label, type, width, options)
export async function PATCH(req: NextRequest) {
  try {
    const { id, ...updates } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const col = await db.dealColumn.update({ where: { id }, data: updates })
    return NextResponse.json({ column: col })
  } catch (e) {
    console.error('PATCH /api/columns error:', e)
    return NextResponse.json({ error: 'Failed to update column' }, { status: 500 })
  }
}
