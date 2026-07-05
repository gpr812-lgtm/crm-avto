import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/traffic?month=YYYY-MM — get all traffic data for a month
// Returns: { models: { "<Model>": { callsAndApps: {1: 5, ...}, visits: {1: 2, ...} } }, plans: {1: {meetings: 0, contracts: 0}}, comments: [...] }
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const month = url.searchParams.get('month')
    if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })

    const entries = await db.trafficEntry.findMany({ where: { monthKey: month } })
    const plans = await db.todayPlan.findMany({ where: { monthKey: month } })
    const comments = await db.cellComment.findMany()

    // Group traffic by model
    const models: Record<string, { callsAndApps: Record<number, number>; visits: Record<number, number> }> = {}
    for (const e of entries) {
      if (!models[e.model]) models[e.model] = { callsAndApps: {}, visits: {} }
      models[e.model][e.type as 'callsAndApps' | 'visits'][e.day] = e.value
    }

    // Group plans by day
    const plansMap: Record<number, { meetings: number; contracts: number }> = {}
    for (const p of plans) {
      plansMap[p.day] = { meetings: p.meetings, contracts: p.contracts }
    }

    return NextResponse.json({
      month,
      models,
      plans: plansMap,
      comments: comments.map((c) => ({ table: c.table, day: c.day, model: c.model, text: c.text })),
    })
  } catch (e) {
    console.error('GET /api/traffic error:', e)
    return NextResponse.json({ error: 'Failed to load traffic' }, { status: 500 })
  }
}

// PATCH /api/traffic — upsert a single cell
// Body: { monthKey, model, type, day, value }
export async function PATCH(req: NextRequest) {
  try {
    const { monthKey, model, type, day, value } = await req.json()
    if (!monthKey || !model || !type || !day) {
      return NextResponse.json({ error: 'monthKey, model, type, day required' }, { status: 400 })
    }

    const entry = await db.trafficEntry.upsert({
      where: { dealershipId_monthKey_model_type_day: { dealershipId: 1, monthKey, model, type, day: Number(day) } },
      update: { value: Number(value) || 0 },
      create: { monthKey, model, type, day: Number(day), value: Number(value) || 0 },
    })
    return NextResponse.json({ entry })
  } catch (e) {
    console.error('PATCH /api/traffic error:', e)
    return NextResponse.json({ error: 'Failed to update traffic' }, { status: 500 })
  }
}
