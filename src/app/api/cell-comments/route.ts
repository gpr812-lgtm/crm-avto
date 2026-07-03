import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/cell-comments
export async function GET() {
  try {
    const comments = await db.cellComment.findMany()
    const map: Record<string, string> = {}
    for (const c of comments) {
      map[`${c.table}_${c.day}_${c.model}`] = c.text
    }
    return NextResponse.json({ comments: map })
  } catch (e) {
    console.error('GET /api/cell-comments error:', e)
    return NextResponse.json({ error: 'Failed to load comments' }, { status: 500 })
  }
}

// POST /api/cell-comments — upsert comment
// Body: { table, day, model, text }
export async function POST(req: NextRequest) {
  try {
    const { table, day, model, text } = await req.json()
    if (!table || !day || !model) return NextResponse.json({ error: 'table, day, model required' }, { status: 400 })

    const comment = await db.cellComment.upsert({
      where: { table_day_model: { table, day: Number(day), model } },
      update: { text: String(text || '') },
      create: { table, day: Number(day), model, text: String(text || '') },
    })
    return NextResponse.json({ comment })
  } catch (e) {
    console.error('POST /api/cell-comments error:', e)
    return NextResponse.json({ error: 'Failed to save comment' }, { status: 500 })
  }
}

// DELETE /api/cell-comments?table=calls&day=1&model=Tenet%20T7
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const table = url.searchParams.get('table')
    const day = url.searchParams.get('day')
    const model = url.searchParams.get('model')
    if (!table || !day || !model) return NextResponse.json({ error: 'table, day, model required' }, { status: 400 })

    await db.cellComment.deleteMany({
      where: { table, day: Number(day), model },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/cell-comments error:', e)
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 })
  }
}
