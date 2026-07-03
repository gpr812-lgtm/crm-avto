import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { addHistory } from '@/lib/utils-crm'

// GET /api/history — list with optional limit (default 500, LIFO)
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const limit = Number(url.searchParams.get('limit') ?? 500)

    const history = await db.changeHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(1, limit), 1000),
    })
    return NextResponse.json({ history })
  } catch (e) {
    console.error('GET /api/history error:', e)
    return NextResponse.json({ error: 'Failed to load history' }, { status: 500 })
  }
}

// DELETE /api/history — clear all
export async function DELETE() {
  try {
    await db.changeHistory.deleteMany({})
    await addHistory('bulk', 'История очищена пользователем')
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/history error:', e)
    return NextResponse.json({ error: 'Failed to clear history' }, { status: 500 })
  }
}
