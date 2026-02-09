import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { setAuthCookieOnResponse } from "@/lib/auth"
import { loginSchema } from "@/lib/validations/auth"
import bcrypt from "bcryptjs"

const LOGIN_RATE_LIMIT = 5
const LOGIN_RATE_WINDOW_MS = 60 * 1000
const loginAttempts = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(email: string): boolean {
  const key = email.toLowerCase()
  const now = Date.now()
  const entry = loginAttempts.get(key)
  if (!entry) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_RATE_WINDOW_MS })
    return true
  }
  if (now > entry.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_RATE_WINDOW_MS })
    return true
  }
  entry.count++
  if (entry.count > LOGIN_RATE_LIMIT) return false
  return true
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const { email, password } = parsed.data

    if (!checkRateLimit(email)) {
      return NextResponse.json(
        { error: "Demasiados intentos. Espera un minuto." },
        { status: 429 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    })
    if (!user || !user.active) {
      return NextResponse.json(
        { error: "Credenciales incorrectas" },
        { status: 401 }
      )
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return NextResponse.json(
        { error: "Credenciales incorrectas" },
        { status: 401 }
      )
    }

    const response = NextResponse.json({
      status: "ok",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    })
    return setAuthCookieOnResponse(response, {
      userId: user.id,
      email: user.email,
      role: user.role,
      impersonationUserId: null,
    })
  } catch (err) {
    console.error("[auth/login]", err)
    return NextResponse.json(
      { error: "Error al iniciar sesión" },
      { status: 500 }
    )
  }
}
