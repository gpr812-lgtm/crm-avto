import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PATCH /api/dealerships/[id] — update dealership name/code
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const numId = Number(id)
    if (Number.isNaN(numId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name
    if (body.code !== undefined) data.code = body.code

    const dealership = await db.dealership.update({ where: { id: numId }, data })
    return NextResponse.json({ dealership })
  } catch (e) {
    console.error('PATCH /api/dealerships/[id] error:', e)
    return NextResponse.json({ error: 'Failed to update dealership' }, { status: 500 })
  }
}

// DELETE /api/dealerships/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const numId = Number(id)
    if (Number.isNaN(numId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    // Prevent deleting the last dealership
    const count = await db.dealership.count()
    if (count <= 1) {
      return NextResponse.json({ error: 'Нельзя удалить единственный автосалон' }, { status: 400 })
    }

    await db.dealership.delete({ where: { id: numId } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/dealerships/[id] error:', e)
    return NextResponse.json({ error: 'Failed to delete dealership' }, { status: 500 })
  }
}
