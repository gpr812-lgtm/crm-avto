import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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
