import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/plan-fact?month=YYYY-MM
// Returns: {
//   channels: Channel[],
//   plan: { "<channelName>": { days: {1: n,...}, budget, cpl, rl, sr } },
//   fact: { contracts, issued }
// }
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const month = url.searchParams.get('month')
    if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })

    const channels = await db.channel.findMany({ orderBy: { order: 'asc' } })
    const planEntries = await db.planEntry.findMany({ where: { monthKey: month } })
    const factEntry = await db.factEntry.findUnique({ where: { monthKey: month } })

    // Group plan entries by channel
    const plan: Record<
      string,
      { days: Record<number, number>; budget: number; cpl: number; rl: number; sr: number }
    > = {}

    for (const ch of channels) {
      // Initialise from channel defaults (FIX: original bug — channels added later didn't appear in planData)
      plan[ch.name] = {
        days: {},
        budget: ch.budget,
        cpl: ch.cpl,
        rl: ch.rl,
        sr: ch.sr,
      }
    }

    for (const p of planEntries) {
      if (!plan[p.channel]) {
        // Channel was deleted but plan entries remain — recreate placeholder
        plan[p.channel] = { days: {}, budget: p.budget, cpl: p.cpl, rl: p.rl, sr: p.sr }
      }
      // Day-level plan
      if (p.day > 0) {
        plan[p.channel].days[p.day] = p.leads
      }
      // Channel-level params (last write wins — should be same for all days of same channel)
      plan[p.channel].budget = p.budget
      plan[p.channel].cpl = p.cpl
      plan[p.channel].rl = p.rl
      plan[p.channel].sr = p.sr
    }

    return NextResponse.json({
      channels,
      plan,
      fact: factEntry ? { contracts: factEntry.contracts, issued: factEntry.issued } : { contracts: 0, issued: 0 },
    })
  } catch (e) {
    console.error('GET /api/plan-fact error:', e)
    return NextResponse.json({ error: 'Failed to load plan/fact' }, { status: 500 })
  }
}

// PATCH /api/plan-fact — upsert a single plan entry (day leads) or update channel params
// Body: { monthKey, channel, day?, leads?, budget?, cpl?, rl?, sr? }
export async function PATCH(req: NextRequest) {
  try {
    const { monthKey, channel, day, leads, budget, cpl, rl, sr } = await req.json()
    if (!monthKey || !channel) return NextResponse.json({ error: 'monthKey, channel required' }, { status: 400 })

    // Update day-level plan
    if (day !== undefined) {
      const ch = await db.channel.findUnique({ where: { name: channel } })
      const chBudget = budget ?? ch?.budget ?? 0
      const chCpl = cpl ?? ch?.cpl ?? 0
      const chRl = rl ?? ch?.rl ?? 0
      const chSr = sr ?? ch?.sr ?? 0

      const entry = await db.planEntry.upsert({
        where: { monthKey_channel_day: { monthKey, channel, day: Number(day) } },
        update: {
          leads: Number(leads) || 0,
          // Also persist channel params so they're saved per-month
          ...(budget !== undefined ? { budget: Number(budget) } : {}),
          ...(cpl !== undefined ? { cpl: Number(cpl) } : {}),
          ...(rl !== undefined ? { rl: Number(rl) } : {}),
          ...(sr !== undefined ? { sr: Number(sr) } : {}),
        },
        create: {
          monthKey,
          channel,
          day: Number(day),
          leads: Number(leads) || 0,
          budget: chBudget,
          cpl: chCpl,
          rl: chRl,
          sr: chSr,
        },
      })
      return NextResponse.json({ entry })
    }

    // Update channel-level params — update all entries for this channel+month, plus the Channel itself
    if (budget !== undefined || cpl !== undefined || rl !== undefined || sr !== undefined) {
      // Persist to Channel master record
      const ch = await db.channel.findUnique({ where: { name: channel } })
      if (ch) {
        await db.channel.update({
          where: { name: channel },
          data: {
            ...(budget !== undefined ? { budget: Number(budget) } : {}),
            ...(cpl !== undefined ? { cpl: Number(cpl) } : {}),
            ...(rl !== undefined ? { rl: Number(rl) } : {}),
            ...(sr !== undefined ? { sr: Number(sr) } : {}),
          },
        })
      }

      // Update all existing plan entries for this channel+month
      await db.planEntry.updateMany({
        where: { monthKey, channel },
        data: {
          ...(budget !== undefined ? { budget: Number(budget) } : {}),
          ...(cpl !== undefined ? { cpl: Number(cpl) } : {}),
          ...(rl !== undefined ? { rl: Number(rl) } : {}),
          ...(sr !== undefined ? { sr: Number(sr) } : {}),
        },
      })

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  } catch (e) {
    console.error('PATCH /api/plan-fact error:', e)
    return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 })
  }
}

// PUT /api/plan-fact — update fact for a month
// Body: { monthKey, contracts?, issued? }
export async function PUT(req: NextRequest) {
  try {
    const { monthKey, contracts, issued } = await req.json()
    if (!monthKey) return NextResponse.json({ error: 'monthKey required' }, { status: 400 })

    const fact = await db.factEntry.upsert({
      where: { monthKey },
      update: {
        ...(contracts !== undefined ? { contracts: Number(contracts) || 0 } : {}),
        ...(issued !== undefined ? { issued: Number(issued) || 0 } : {}),
      },
      create: {
        monthKey,
        contracts: Number(contracts) || 0,
        issued: Number(issued) || 0,
      },
    })
    return NextResponse.json({ fact })
  } catch (e) {
    console.error('PUT /api/plan-fact error:', e)
    return NextResponse.json({ error: 'Failed to update fact' }, { status: 500 })
  }
}
