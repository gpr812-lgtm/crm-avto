import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/stats — dashboard stats
export async function GET() {
  try {
    const total = await db.deal.count()
    const sold = await db.deal.count({ where: { status: 'Продан' } })
    const inStock = await db.deal.count({ where: { status: 'Склад' } })
    const refused = await db.deal.count({ where: { status: 'Отказ' } })

    const sumJok = await db.deal.aggregate({ where: { status: 'Продан' }, _sum: { jok: true } })
    const sumK = await db.deal.aggregate({ where: { status: 'Продан' }, _sum: { k: true } })
    const tiCount = await db.deal.count({ where: { ti: { in: ['1', '2'] } } })
    const krCount = await db.deal.count({ where: { kr: '1' } })

    return NextResponse.json({
      total,
      sold,
      inStock,
      refused,
      sumJok: sumJok._sum.jok ?? 0,
      sumK: sumK._sum.k ?? 0,
      tiCount,
      krCount,
    })
  } catch (e) {
    console.error('GET /api/stats error:', e)
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 })
  }
}
