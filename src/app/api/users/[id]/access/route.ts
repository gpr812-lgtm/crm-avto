import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PUT /api/users/[id]/access — update dealership + tab access
// Body: { dealershipIds: number[], tabAccess: Record<string, boolean> }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const numId = Number(id)
    if (Number.isNaN(numId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const { dealershipIds, tabAccess } = await req.json()

    // Replace dealership access
    await db.userDealershipAccess.deleteMany({ where: { userId: numId } })
    if (dealershipIds && dealershipIds.length > 0) {
      await db.userDealershipAccess.createMany({
        data: dealershipIds.map((did: number) => ({ userId: numId, dealershipId: did })),
      })
    }

    // Replace tab access
    await db.userTabAccess.deleteMany({ where: { userId: numId } })
    if (tabAccess) {
      const entries = Object.entries(tabAccess)
      if (entries.length > 0) {
        await db.userTabAccess.createMany({
          data: entries.map(([tabKey, allowed]) => ({
            userId: numId,
            tabKey,
            allowed: allowed as boolean,
          })),
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('PUT /api/users/[id]/access error:', e)
    return NextResponse.json({ error: 'Failed to update access' }, { status: 500 })
  }
}
