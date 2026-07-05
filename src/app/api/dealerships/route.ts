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
    return NextResponse.json({ dealership }, { status: 201 })
  } catch (e) {
    console.error('POST /api/dealerships error:', e)
    return NextResponse.json({ error: 'Failed to create dealership' }, { status: 500 })
  }
}
