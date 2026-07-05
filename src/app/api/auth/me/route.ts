import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseSessionToken, SESSION_COOKIE } from '@/lib/auth'

// GET /api/auth/me — get current user from session cookie
export async function GET(req: Request) {
  try {
    const cookieHeader = req.headers.get('cookie') || ''
    const cookies = Object.fromEntries(
      cookieHeader.split('; ').map((c) => {
        const [k, ...v] = c.split('=')
        return [k, v.join('=')]
      }),
    )
    const token = cookies[SESSION_COOKIE]
    if (!token) return NextResponse.json({ user: null }, { status: 200 })

    const session = parseSessionToken(token)
    if (!session) return NextResponse.json({ user: null }, { status: 200 })

    const user = await db.user.findUnique({
      where: { id: session.userId },
      include: {
        dealershipAccess: { include: { dealership: true } },
        tabAccess: true,
      },
    })
    if (!user || !user.active) return NextResponse.json({ user: null }, { status: 200 })

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        dealerships: user.role === 'ADMIN' ? (await db.dealership.findMany({ orderBy: { name: 'asc' } })).map((d) => ({ id: d.id, name: d.name, code: d.code })) : user.dealershipAccess.map((a) => ({
          id: a.dealership.id,
          name: a.dealership.name,
          code: a.dealership.code,
        })),
        tabAccess: user.tabAccess.reduce<Record<string, boolean>>((acc, t) => {
          acc[t.tabKey] = t.allowed
          return acc
        }, {}),
      },
    })
  } catch (e) {
    console.error('GET /api/auth/me error:', e)
    return NextResponse.json({ user: null }, { status: 200 })
  }
}
