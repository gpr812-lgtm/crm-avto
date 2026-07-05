import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth'

// POST /api/auth/login — login with email + password
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email и пароль обязательны' }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { email },
      include: {
        dealershipAccess: { include: { dealership: true } },
        tabAccess: true,
      },
    })

    if (!user || !user.active) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 401 })
    }

    if (!verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Неверный пароль' }, { status: 401 })
    }

    const token = createSessionToken(user.id, user.email)
    const response = NextResponse.json({
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
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      maxAge: SESSION_MAX_AGE,
      path: '/',
      sameSite: 'lax',
    })
    return response
  } catch (e) {
    console.error('POST /api/auth/login error:', e)
    return NextResponse.json({ error: 'Ошибка входа' }, { status: 500 })
  }
}
