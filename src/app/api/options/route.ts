import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/options?dict=model — get one dict, or all if no dict param
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const dict = url.searchParams.get('dict')

    if (dict) {
      const opts = await db.selectOption.findMany({
        where: { dictName: dict },
        orderBy: { order: 'asc' },
      })
      return NextResponse.json({ values: opts.map((o) => o.value) })
    }

    // Return all dicts
    const all = await db.selectOption.findMany({ orderBy: [{ dictName: 'asc' }, { order: 'asc' }] })
    const grouped: Record<string, string[]> = {}
    for (const o of all) {
      if (!grouped[o.dictName]) grouped[o.dictName] = []
      grouped[o.dictName].push(o.value)
    }
    return NextResponse.json(grouped)
  } catch (e) {
    console.error('GET /api/options error:', e)
    return NextResponse.json({ error: 'Failed to load options' }, { status: 500 })
  }
}

// POST /api/options — add a new value to a dict
// Body: { dict: string, value: string }
export async function POST(req: NextRequest) {
  try {
    const { dict, value } = await req.json()
    if (!dict || !value) {
      return NextResponse.json({ error: 'dict and value required' }, { status: 400 })
    }
    const maxOrder = await db.selectOption.aggregate({ where: { dictName: dict }, _max: { order: true } })
    const opt = await db.selectOption.upsert({
      where: { dictName_value: { dictName: dict, value } },
      update: {},
      create: { dictName: dict, value, order: (maxOrder._max.order ?? -1) + 1 },
    })
    return NextResponse.json({ option: opt }, { status: 201 })
  } catch (e) {
    console.error('POST /api/options error:', e)
    return NextResponse.json({ error: 'Failed to create option' }, { status: 500 })
  }
}

// DELETE /api/options?dict=X&value=Y
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const dict = url.searchParams.get('dict')
    const value = url.searchParams.get('value')
    if (!dict || !value) {
      return NextResponse.json({ error: 'dict and value required' }, { status: 400 })
    }
    await db.selectOption.deleteMany({ where: { dictName: dict, value } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/options error:', e)
    return NextResponse.json({ error: 'Failed to delete option' }, { status: 500 })
  }
}
