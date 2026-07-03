import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { addHistory } from '@/lib/utils-crm'

// GET /api/channels — list all channels
export async function GET() {
  try {
    const channels = await db.channel.findMany({ orderBy: { order: 'asc' } })
    return NextResponse.json({ channels })
  } catch (e) {
    console.error('GET /api/channels error:', e)
    return NextResponse.json({ error: 'Failed to load channels' }, { status: 500 })
  }
}

// POST /api/channels — create new channel
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.name) return NextResponse.json({ error: 'name required' }, { status: 400 })

    const maxOrder = await db.channel.aggregate({ _max: { order: true } })
    const channel = await db.channel.create({
      data: {
        name: body.name,
        group: body.group || 'Прочее',
        budget: Number(body.budget) || 0,
        cpl: Number(body.cpl) || 0,
        rl: Number(body.rl) || 0,
        sr: Number(body.sr) || 0,
        order: (maxOrder._max.order ?? 0) + 1,
      },
    })
    await addHistory('add', `Добавлен канал: ${channel.name}`)
    return NextResponse.json({ channel }, { status: 201 })
  } catch (e) {
    console.error('POST /api/channels error:', e)
    return NextResponse.json({ error: 'Failed to create channel' }, { status: 500 })
  }
}
