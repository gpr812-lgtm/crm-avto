import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE = 'crm_session'

// Роуты которые НЕ требуют авторизации
const PUBLIC_ROUTES = ['/login', '/api/auth/login', '/api/auth/logout', '/api/auth/me']

// Парсинг session token без Node.js модулей (для edge runtime)
function parseSession(token: string): { userId: number; email: string } | null {
  try {
    // base64 decode через atob (доступно в edge runtime)
    const decoded = atob(token)
    const parsed = JSON.parse(decoded)
    if (parsed && typeof parsed.userId === 'number' && typeof parsed.email === 'string') {
      return { userId: parsed.userId, email: parsed.email }
    }
    return null
  } catch {
    return null
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Пропускаем публичные роуты
  if (PUBLIC_ROUTES.some((r) => pathname === r)) {
    return NextResponse.next()
  }

  // Пропускаем статические файлы и Next.js внутренние роуты
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Получаем session cookie
  const token = req.cookies.get(SESSION_COOKIE)?.value

  // Для API — возвращаем 401 если нет сессии
  if (pathname.startsWith('/api/')) {
    if (!token) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }
    const session = parseSession(token)
    if (!session) {
      return NextResponse.json({ error: 'Сессия истекла' }, { status: 401 })
    }
    // Добавляем userId в заголовки
    const headers = new Headers(req.headers)
    headers.set('x-user-id', String(session.userId))
    return NextResponse.next({ request: { headers } })
  }

  // Для страниц — редирект на /login
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  const session = parseSession(token)
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
