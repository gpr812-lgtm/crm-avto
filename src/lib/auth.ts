/**
 * Auth utilities — password hashing, JWT-like token, session
 */
import { createHash, randomBytes } from 'crypto'

// Simple SHA-256 password hashing (use bcrypt in production)
export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash
}

// Simple session token (not real JWT, but works for demo)
export function createSessionToken(userId: number, email: string): string {
  const payload = { userId, email, ts: Date.now() }
  return Buffer.from(JSON.stringify(payload)).toString('base64')
}

export function parseSessionToken(token: string): { userId: number; email: string; ts: number } | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8')
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

export const SESSION_COOKIE = 'crm_session'
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60 // 7 days in seconds
