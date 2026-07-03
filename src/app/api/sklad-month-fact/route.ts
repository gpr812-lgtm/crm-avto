import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/sklad-month-fact?month=YYYY-MM
// Returns aggregated fact values from Sklad deals for the given month.
// Excludes deals with status='Отказ' or 'Призрак' or risk='4' from financial totals.
//
// Returns: {
//   contracts: number,        // count of deals with status='Продан' and dateDkp in month
//   issued: number,           // count of deals with status='Продан' and dateIssued in month
//   j: number, o: number, k: number, jok: number,  // sums (excluded Отказ/Призрак/РИСК4)
//   kr: number,               // count of kr='1' (excluded)
//   ti: number,               // count of ti in ['1','2'] (excluded)
// }
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const month = url.searchParams.get('month')
    if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })

    // All deals with dateDkp in this month (for contracts count)
    const contractDeals = await db.deal.findMany({
      where: {
        dateDkp: { startsWith: month },
        status: 'Продан',
      },
    })

    // All deals with dateIssued in this month (for issued count)
    const issuedDeals = await db.deal.findMany({
      where: {
        dateIssued: { startsWith: month },
        status: 'Продан',
      },
    })

    // Financial sums — exclude Отказ/Призрак/РИСК4
    const financialDeals = contractDeals.filter(
      (d) => d.status !== 'Отказ' && d.status !== 'Призрак' && d.risk !== '4',
    )

    const sum = (arr: typeof financialDeals, key: 'j' | 'o' | 'k' | 'jok') =>
      arr.reduce((s, d) => s + (d[key] || 0), 0)

    const j = sum(financialDeals, 'j')
    const o = sum(financialDeals, 'o')
    const k = sum(financialDeals, 'k')
    const jok = sum(financialDeals, 'jok') // already auto-computed as j+o+k in API

    const krCount = financialDeals.filter((d) => d.kr === '1').length
    const tiCount = financialDeals.filter((d) => d.ti === '1' || d.ti === '2').length

    return NextResponse.json({
      contracts: contractDeals.length,
      issued: issuedDeals.length,
      j,
      o,
      k,
      jok,
      kr: krCount,
      ti: tiCount,
    })
  } catch (e) {
    console.error('GET /api/sklad-month-fact error:', e)
    return NextResponse.json({ error: 'Failed to load sklad month fact' }, { status: 500 })
  }
}
