import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { addHistory } from '@/lib/utils-crm'

// GET /api/backup — full export as JSON
export async function GET() {
  try {
    const [
      deals, columns, options, channels, planEntries, factEntries,
      trafficEntries, todayPlans, cellComments, evaluationLinks, linksArchive, history,
    ] = await Promise.all([
      db.deal.findMany(),
      db.dealColumn.findMany({ orderBy: { order: 'asc' } }),
      db.selectOption.findMany({ orderBy: [{ dictName: 'asc' }, { order: 'asc' }] }),
      db.channel.findMany({ orderBy: { order: 'asc' } }),
      db.planEntry.findMany(),
      db.factEntry.findMany(),
      db.trafficEntry.findMany(),
      db.todayPlan.findMany(),
      db.cellComment.findMany(),
      db.evaluationLink.findMany(),
      db.linksArchive.findMany(),
      db.changeHistory.findMany({ orderBy: { createdAt: 'desc' }, take: 500 }),
    ])

    const backup = {
      version: 33,
      exportedAt: new Date().toISOString(),
      deals,
      columns,
      options: options.reduce<Record<string, string[]>>((acc, o) => {
        if (!acc[o.dictName]) acc[o.dictName] = []
        acc[o.dictName].push(o.value)
        return acc
      }, {}),
      channels,
      planEntries,
      factEntries,
      trafficEntries,
      todayPlans,
      cellComments,
      evaluationLinks,
      linksArchive,
      history,
    }

    await db.backupTime.upsert({
      where: { id: 1 },
      update: { time: new Date() },
      create: { id: 1, time: new Date() },
    })
    await addHistory('add', `Создан полный бэкап`)

    return NextResponse.json(backup, {
      headers: {
        'Content-Disposition': `attachment; filename="crm-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    })
  } catch (e) {
    console.error('GET /api/backup error:', e)
    return NextResponse.json({ error: 'Failed to create backup' }, { status: 500 })
  }
}

// POST /api/backup — restore from JSON
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body || !body.version) return NextResponse.json({ error: 'Invalid backup format' }, { status: 400 })

    // Replace all data (transactional)
    await db.$transaction(async (tx) => {
      await tx.changeHistory.deleteMany({})
      await tx.linksArchive.deleteMany({})
      await tx.evaluationLink.deleteMany({})
      await tx.cellComment.deleteMany({})
      await tx.todayPlan.deleteMany({})
      await tx.trafficEntry.deleteMany({})
      await tx.factEntry.deleteMany({})
      await tx.planEntry.deleteMany({})
      await tx.channel.deleteMany({})
      await tx.selectOption.deleteMany({})
      await tx.dealColumn.deleteMany({})
      await tx.deal.deleteMany({})

      if (body.deals?.length) {
        await tx.deal.createMany({
          data: body.deals.map((d: Record<string, unknown>) => {
            const j = Number(d.j) || 0
            const o = Number(d.o) || 0
            const k = Number(d.k) || 0
            // Recompute jok from j+o+k (don't trust stored value)
            const { jok: _ignored, ...rest } = d
            return { ...rest, jok: j + o + k }
          }),
        })
      }
      if (body.columns?.length) await tx.dealColumn.createMany({ data: body.columns })
      if (body.options) {
        const opts: { dictName: string; value: string; order: number }[] = []
        for (const [dictName, values] of Object.entries(body.options as Record<string, string[]>)) {
          values.forEach((value, i) => opts.push({ dictName, value, order: i }))
        }
        if (opts.length) await tx.selectOption.createMany({ data: opts })
      }
      if (body.channels?.length) await tx.channel.createMany({ data: body.channels })
      if (body.planEntries?.length) await tx.planEntry.createMany({ data: body.planEntries })
      if (body.factEntries?.length) await tx.factEntry.createMany({ data: body.factEntries })
      if (body.trafficEntries?.length) await tx.trafficEntry.createMany({ data: body.trafficEntries })
      if (body.todayPlans?.length) await tx.todayPlan.createMany({ data: body.todayPlans })
      if (body.cellComments?.length) await tx.cellComment.createMany({ data: body.cellComments })
      if (body.evaluationLinks?.length) await tx.evaluationLink.createMany({ data: body.evaluationLinks })
      if (body.linksArchive?.length) await tx.linksArchive.createMany({ data: body.linksArchive })
      if (body.history?.length) await tx.changeHistory.createMany({ data: body.history })

      await tx.backupTime.upsert({
        where: { id: 1 },
        update: { time: new Date() },
        create: { id: 1, time: new Date() },
      })
    })

    await addHistory('bulk', `Восстановлен бэкап от ${body.exportedAt ?? 'неизвестной даты'}`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('POST /api/backup error:', e)
    return NextResponse.json({ error: 'Failed to restore backup' }, { status: 500 })
  }
}
