import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

// GET /api/users — list all users
export async function GET() {
  try {
    const users = await db.user.findMany({
      include: {
        dealershipAccess: { include: { dealership: true } },
        tabAccess: true,
      },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json({ users })
  } catch (e) {
    console.error('GET /api/users error:', e)
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 })
  }
}

// POST /api/users — create new user
export async function POST(req: NextRequest) {
  try {
    const { email, name, password, role, dealershipIds, tabAccess } = await req.json()
    if (!email || !name || !password) {
      return NextResponse.json({ error: 'email, name, password required' }, { status: 400 })
    }

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) return NextResponse.json({ error: 'Email уже существует' }, { status: 400 })

    const user = await db.user.create({
      data: {
        email,
        name,
        passwordHash: hashPassword(password),
        role: role || 'MANAGER',
        active: true,
        dealershipAccess: {
          create: (dealershipIds || []).map((id: number) => ({ dealershipId: id })),
        },
        tabAccess: {
          create: Object.entries(tabAccess || {}).map(([tabKey, allowed]) => ({
            tabKey,
            allowed: allowed as boolean,
          })),
        },
      },
      include: { dealershipAccess: true, tabAccess: true },
    })
    return NextResponse.json({ user }, { status: 201 })
  } catch (e) {
    console.error('POST /api/users error:', e)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
