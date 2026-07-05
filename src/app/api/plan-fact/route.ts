import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/plan-fact?month=YYYY-MM
// Returns: {
//   channels: Channel[],
//   plan: { "<channelName>": { days, budget, cpl, rl, sr } },
//   channelFacts: { "<channelName>": { contracts, issued } },
//   fact: { contracts, issued, planContracts, planIssued, planJ, planO, planK, planKr, planTi }
// }
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const month = url.searchParams.get('month')
    if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })

    const [channels, planEntries, factEntry, channelFacts] = await Promise.all([
      db.channel.findMany({ orderBy: { order: 'asc' } }),
      db.planEntry.findMany({ where: { monthKey: month } }),
      db.factEntry.findFirst({ where: { monthKey: month } }),
      db.channelFact.findMany({ where: { monthKey: month } }),
    ])

    // Group plan entries by channel
    const plan: Record<
      string,
      { days: Record<number, number>; budget: number; cpl: number; rl: number; sr: number }
    > = {}

    for (const ch of channels) {
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
        plan[p.channel] = { days: {}, budget: p.budget, cpl: p.cpl, rl: p.rl, sr: p.sr }
      }
      if (p.day > 0) {
        plan[p.channel].days[p.day] = p.leads
      }
      plan[p.channel].budget = p.budget
      plan[p.channel].cpl = p.cpl
      plan[p.channel].rl = p.rl
      plan[p.channel].sr = p.sr
    }

    // Group channel facts
    const channelFactsMap: Record<string, { contracts: number; issued: number }> = {}
    for (const cf of channelFacts) {
      channelFactsMap[cf.channel] = { contracts: cf.contracts, issued: cf.issued }
    }

    return NextResponse.json({
      channels,
      plan,
      channelFacts: channelFactsMap,
      fact: factEntry
        ? {
            contracts: factEntry.contracts,
            issued: factEntry.issued,
            planContracts: factEntry.planContracts,
            planIssued: factEntry.planIssued,
            planJ: factEntry.planJ,
            planO: factEntry.planO,
            planK: factEntry.planK,
            planKr: factEntry.planKr,
            planTi: factEntry.planTi,
          }
        : {
            contracts: 0, issued: 0,
            planContracts: 0, planIssued: 0,
            planJ: 0, planO: 0, planK: 0,
            planKr: 0, planTi: 0,
          },
    })
  } catch (e) {
    console.error('GET /api/plan-fact error:', e)
    return NextResponse.json({ error: 'Failed to load plan/fact' }, { status: 500 })
  }
}

// PATCH /api/plan-fact — upsert a single plan entry (day leads) or update channel params
// Body: { monthKey, channel, day?, leads?, budget?, cpl?, rl?, sr? }
//       OR { monthKey, channel, channelFactContracts?, channelFactIssued? } — per-channel К./В.
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { monthKey, channel, day, leads, budget, cpl, rl, sr, channelFactContracts, channelFactIssued } = body
    if (!monthKey || !channel) return NextResponse.json({ error: 'monthKey, channel required' }, { status: 400 })

    // Per-channel fact (К., В.) — entered manually per channel
    if (channelFactContracts !== undefined || channelFactIssued !== undefined) {
      const cf = await db.channelFact.upsert({
        where: { dealershipId_monthKey_channel: { dealershipId: 1, monthKey, channel } },
        update: {
          ...(channelFactContracts !== undefined ? { contracts: Number(channelFactContracts) || 0 } : {}),
          ...(channelFactIssued !== undefined ? { issued: Number(channelFactIssued) || 0 } : {}),
        },
        create: {
          monthKey,
          channel,
          contracts: Number(channelFactContracts) || 0,
          issued: Number(channelFactIssued) || 0,
        },
      })
      return NextResponse.json({ channelFact: cf })
    }

    // Update day-level plan
    if (day !== undefined) {
      const ch = await db.channel.findFirst({ where: { name: channel } })
      const chBudget = budget ?? ch?.budget ?? 0
      const chCpl = cpl ?? ch?.cpl ?? 0
      const chRl = rl ?? ch?.rl ?? 0
      const chSr = sr ?? ch?.sr ?? 0

      const entry = await db.planEntry.upsert({
        where: { dealershipId_monthKey_channel_day: { dealershipId: 1, monthKey, channel, day: Number(day) } },
        update: {
          leads: Number(leads) || 0,
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

    // Update channel-level params
    if (budget !== undefined || cpl !== undefined || rl !== undefined || sr !== undefined) {
      const ch = await db.channel.findFirst({ where: { name: channel } })
      if (ch) {
        await db.channel.update({
          where: { id: ch.id },
          data: {
            ...(budget !== undefined ? { budget: Number(budget) } : {}),
            ...(cpl !== undefined ? { cpl: Number(cpl) } : {}),
            ...(rl !== undefined ? { rl: Number(rl) } : {}),
            ...(sr !== undefined ? { sr: Number(sr) } : {}),
          },
        })
      }

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

// PUT /api/plan-fact — update fact and/or plan values for a month
// Body: { monthKey, contracts?, issued?, planContracts?, planIssued?, planJ?, planO?, planK?, planKr?, planTi? }
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { monthKey, contracts, issued, planContracts, planIssued, planJ, planO, planK, planKr, planTi } = body
    if (!monthKey) return NextResponse.json({ error: 'monthKey required' }, { status: 400 })

    const data: Record<string, unknown> = {}
    if (contracts !== undefined) data.contracts = Number(contracts) || 0
    if (issued !== undefined) data.issued = Number(issued) || 0
    if (planContracts !== undefined) data.planContracts = Number(planContracts) || 0
    if (planIssued !== undefined) data.planIssued = Number(planIssued) || 0
    if (planJ !== undefined) data.planJ = Number(planJ) || 0
    if (planO !== undefined) data.planO = Number(planO) || 0
    if (planK !== undefined) data.planK = Number(planK) || 0
    if (planKr !== undefined) data.planKr = Number(planKr) || 0
    if (planTi !== undefined) data.planTi = Number(planTi) || 0

    const fact = await db.factEntry.upsert({
      where: { dealershipId_monthKey: { dealershipId: 1, monthKey } },
      update: data,
      create: { monthKey, ...data },
    })
    return NextResponse.json({ fact })
  } catch (e) {
    console.error('PUT /api/plan-fact error:', e)
    return NextResponse.json({ error: 'Failed to update fact' }, { status: 500 })
  }
}
