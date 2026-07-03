import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/today-plans?month=YYYY-MM — list day plans for a month
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const month = url.searchParams.get('month')
    if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })

    const plans = await db.todayPlan.findMany({ where: { monthKey: month } })
    const map: Record<number, { meetings: number; contracts: number }> = {}
    for (const p of plans) map[p.day] = { meetings: p.meetings, contracts: p.contracts }
    return NextResponse.json({ plans: map })
  } catch (e) {
    console.error('GET /api/today-plans error:', e)
    return NextResponse.json({ error: 'Failed to load plans' }, { status: 500 })
  }
}

// PATCH /api/today-plans — upsert day plan
// Body: { monthKey, day, meetings?, contracts? }
export async function PATCH(req: NextRequest) {
  try {
    const { monthKey, day, meetings, contracts } = await req.json()
    if (!monthKey || !day) return NextResponse.json({ error: 'monthKey, day required' }, { status: 400 })

    const plan = await db.todayPlan.upsert({
      where: { monthKey_day: { monthKey, day: Number(day) } },
      update: {
        ...(meetings !== undefined ? { meetings: Number(meetings) || 0 } : {}),
        ...(contracts !== undefined ? { contracts: Number(contracts) || 0 } : {}),
      },
      create: {
        monthKey,
        day: Number(day),
        meetings: Number(meetings) || 0,
        contracts: Number(contracts) || 0,
      },
    })
    return NextResponse.json({ plan })
  } catch (e) {
    console.error('PATCH /api/today-plans error:', e)
    return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 })
  }
}
