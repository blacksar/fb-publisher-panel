/**
 * Autenticación del panel: JWT en cookie httpOnly, helpers requireAuth/requireAdmin.
 * No exponer passwordHash ni roles sin verificar en backend.
 */
import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import type { Request } from "next/server"

const COOKIE_NAME = "panel_session"
const MAX_AGE = 60 * 60 * 24 * 7 // 7 días
const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || process.env.JWT_SECRET || "change-me-in-production-min-32-chars"
)

export type Role = "ADMIN" | "USER"

export interface AuthPayload {
  userId: string
  email: string
  role: Role
  impersonationUserId?: string | null
}

export interface AuthUser {
  id: string
  email: string
  name: string | null
  role: Role
  active: boolean
}

/** Obtiene el userId efectivo: si hay impersonación devuelve ese, si no el del usuario logueado */
export function getEffectiveUserId(auth: { user: AuthUser; impersonationUserId?: string | null }): string {
  if (auth.impersonationUserId) return auth.impersonationUserId
  return auth.user.id
}

/** Crea el JWT para la sesión */
async function signToken(payload: AuthPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(SECRET)
}

/** Verifica el JWT y devuelve el payload o null */
async function verifyToken(token: string): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    if (!payload.userId || !payload.email || !payload.role) return null
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as Role,
      impersonationUserId: (payload.impersonationUserId as string) ?? null,
    }
  } catch {
    return null
  }
}

/** Lee la cookie de sesión de la request (API Route) */
function getTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie")
  if (!cookieHeader) return null
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : null
}

/** Obtiene la sesión desde la request. Usar en API Routes. */
export async function getSessionFromRequest(request: Request): Promise<AuthPayload | null> {
  const token = getTokenFromRequest(request)
  if (!token) return null
  return verifyToken(token)
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: MAX_AGE,
  path: "/",
}

/** Establece la cookie de sesión en la respuesta (para login). Preferir usar en la respuesta que devuelves. */
export async function setAuthCookie(payload: AuthPayload): Promise<void> {
  const token = await signToken(payload)
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, COOKIE_OPTIONS)
}

/** Añade la cookie de sesión a una respuesta y la devuelve (para login en Route Handlers). */
export async function setAuthCookieOnResponse<T>(
  response: NextResponse<T>,
  payload: AuthPayload
): Promise<NextResponse<T>> {
  const token = await signToken(payload)
  response.cookies.set(COOKIE_NAME, token, COOKIE_OPTIONS)
  return response
}

/** Limpia la cookie de sesión (para logout) */
export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

/** Requiere autenticación. Devuelve 401 si no hay sesión. */
export async function requireAuth(
  request: Request
): Promise<NextResponse | { user: AuthUser; impersonationUserId: string | null }> {
  const payload = await getSessionFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: "No autorizado", mensaje: "Sesión inválida o expirada" }, { status: 401 })
  }
  const { prisma } = await import("@/lib/prisma")
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, name: true, role: true, active: true },
  })
  if (!user || !user.active) {
    return NextResponse.json({ error: "No autorizado", mensaje: "Usuario inactivo o no encontrado" }, { status: 401 })
  }
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      active: user.active,
    },
    impersonationUserId: payload.impersonationUserId ?? null,
  }
}

/** Requiere rol ADMIN. Devuelve 403 si no es ADMIN. */
export async function requireAdmin(
  request: Request
): Promise<NextResponse | { user: AuthUser; impersonationUserId: string | null }> {
  const result = await requireAuth(request)
  if (result instanceof NextResponse) return result
  if (result.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden", mensaje: "Se requiere rol ADMIN" }, { status: 403 })
  }
  return result
}

/** Lee el token desde las cookies de Next (server component / server action) */
export async function getSessionFromCookies(): Promise<AuthPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

/** Para server actions: devuelve el usuario actual desde la cookie o null */
export async function getCurrentUser(): Promise<{ user: AuthUser; impersonationUserId: string | null } | null> {
  const payload = await getSessionFromCookies()
  if (!payload) return null
  const { prisma } = await import("@/lib/prisma")
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, name: true, role: true, active: true },
  })
  if (!user || !user.active) return null
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      active: user.active,
    },
    impersonationUserId: payload.impersonationUserId ?? null,
  }
}
