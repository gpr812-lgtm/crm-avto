import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { addHistory } from '@/lib/utils-crm'

// PATCH /api/channels/[id] — update channel params (budget/cpl/rl/sr/group/name)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const numId = Number(id)
    if (Number.isNaN(numId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const data: Record<string, unknown> = {}
    for (const k of ['name', 'group']) {
      if (typeof body[k] === 'string') data[k] = body[k]
    }
    for (const k of ['budget', 'cpl', 'rl', 'sr']) {
      if (body[k] !== undefined) data[k] = Number(body[k]) || 0
    }

    const channel = await db.channel.update({ where: { id: numId }, data })
    return NextResponse.json({ channel })
  } catch (e) {
    console.error('PATCH /api/channels/[id] error:', e)
    return NextResponse.json({ error: 'Failed to update channel' }, { status: 500 })
  }
}

// DELETE /api/channels/[id] — delete a channel AND clean up related plan entries
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const numId = Number(id)
    if (Number.isNaN(numId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const channel = await db.channel.findUnique({ where: { id: numId } })
    if (!channel) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Clean up plan entries for this channel name across all months (BUGFIX: original code didn't do this)
    await db.planEntry.deleteMany({ where: { channel: channel.name } })

    await db.channel.delete({ where: { id: numId } })
    await addHistory('delete', `Удалён канал: ${channel.name}`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/channels/[id] error:', e)
    return NextResponse.json({ error: 'Failed to delete channel' }, { status: 500 })
  }
}
