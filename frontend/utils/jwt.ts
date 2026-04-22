import { UserRole } from '~/types'

export interface JwtPayload {
  sub?: string
  name?: string
  email?: string
  role?: UserRole
  exp?: number
  iat?: number
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split('.')
  if (parts.length !== 3) {
    return null
  }
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64)) as JwtPayload
  } catch {
    return null
  }
}

function isTokenExpired(payload: JwtPayload): boolean {
  return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()
}

export function isValidSession(payload: JwtPayload | null): boolean {
  if (!payload?.sub || !payload.email || !payload.role) {
    return false
  }
  return !isTokenExpired(payload)
}
