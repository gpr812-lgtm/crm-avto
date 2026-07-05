import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/dealerships — list all dealerships
export async function GET() {
  try {
    const dealerships = await db.dealership.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json({ dealerships })
  } catch (e) {
    console.error('GET /api/dealerships error:', e)
    return NextResponse.json({ error: 'Failed to load dealerships' }, { status: 500 })
  }
}

// POST /api/dealerships — create new dealership
// Auto-copies: select options, columns, channels from the first existing dealership (TENET ВН)
export async function POST(req: NextRequest) {
  try {
    const { name, code } = await req.json()
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

    const dealership = await db.dealership.create({
      data: { name, code: code || null },
    })

    // Auto-grant access to all admin users
    const admins = await db.user.findMany({ where: { role: 'ADMIN' } })
    for (const admin of admins) {
      await db.userDealershipAccess.upsert({
        where: { userId_dealershipId: { userId: admin.id, dealershipId: dealership.id } },
        update: {},
        create: { userId: admin.id, dealershipId: dealership.id },
      })
    }

    // Auto-copy data from the first dealership (source)
    const sourceDealership = await db.dealership.findFirst({
      orderBy: { id: 'asc' },
      where: { id: { not: dealership.id } },
    })

    if (sourceDealership) {
      const sourceId = sourceDealership.id
      const newId = dealership.id

      // Copy select options
      const options = await db.selectOption.findMany({ where: { dealershipId: sourceId } })
      for (const opt of options) {
        await db.selectOption.create({
          data: {
            dealershipId: newId,
            dictName: opt.dictName,
            value: opt.value,
            order: opt.order,
          },
        }).catch(() => {}) // skip duplicates
      }

      // Copy columns
      const columns = await db.dealColumn.findMany({ where: { dealershipId: sourceId }, orderBy: { order: 'asc' } })
      for (const col of columns) {
        await db.dealColumn.create({
          data: {
            dealershipId: newId,
            key: col.key,
            label: col.label,
            type: col.type,
            options: col.options,
            default: col.default,
            width: col.width,
            order: col.order,
          },
        }).catch(() => {})
      }

      // Copy channels
      const channels = await db.channel.findMany({ where: { dealershipId: sourceId }, orderBy: { order: 'asc' } })
      for (const ch of channels) {
        await db.channel.create({
          data: {
            dealershipId: newId,
            name: ch.name,
            group: ch.group,
            budget: ch.budget,
            cpl: ch.cpl,
            rl: ch.rl,
            sr: ch.sr,
            order: ch.order,
          },
        }).catch(() => {})
      }
    }

    return NextResponse.json({ dealership }, { status: 201 })
  } catch (e) {
    console.error('POST /api/dealerships error:', e)
    return NextResponse.json({ error: 'Failed to create dealership' }, { status: 500 })
  }
}
