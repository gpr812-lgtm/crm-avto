import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PATCH /api/columns/[id] — update existing column
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const numId = Number(id)
    if (Number.isNaN(numId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const body = await req.json()
    const data: Record<string, unknown> = {}
    for (const k of ['label', 'type', 'options', 'default', 'width', 'order', 'key']) {
      if (body[k] !== undefined) data[k] = body[k]
    }
    const col = await db.dealColumn.update({ where: { id: numId }, data })
    return NextResponse.json({ column: col })
  } catch (e) {
    console.error('PATCH /api/columns/[id] error:', e)
    return NextResponse.json({ error: 'Failed to update column' }, { status: 500 })
  }
}

// DELETE /api/columns/[id] — delete a column
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const numId = Number(id)
    if (Number.isNaN(numId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    await db.dealColumn.delete({ where: { id: numId } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/columns/[id] error:', e)
    return NextResponse.json({ error: 'Failed to delete column' }, { status: 500 })
  }
}
