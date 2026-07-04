import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

// PATCH /api/users/[id] — update user (name, role, active, password)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const numId = Number(id)
    if (Number.isNaN(numId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name
    if (body.role !== undefined) data.role = body.role
    if (body.active !== undefined) data.active = body.active
    if (body.password) data.passwordHash = hashPassword(body.password)

    const user = await db.user.update({ where: { id: numId }, data })
    return NextResponse.json({ user })
  } catch (e) {
    console.error('PATCH /api/users/[id] error:', e)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

// DELETE /api/users/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const numId = Number(id)
    if (Number.isNaN(numId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    await db.user.delete({ where: { id: numId } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/users/[id] error:', e)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
