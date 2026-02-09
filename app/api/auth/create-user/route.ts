import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/auth"
import { createUserSchema } from "@/lib/validations/auth"
import bcrypt from "bcryptjs"

export async function POST(request: Request) {
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await request.json()
    const parsed = createUserSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const { email, password, name, role } = parsed.data
    const emailNorm = email.toLowerCase().trim()

    const existing = await prisma.user.findUnique({ where: { email: emailNorm } })
    if (existing) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese email" },
        { status: 409 }
      )
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: {
        email: emailNorm,
        passwordHash,
        name: name || null,
        role,
        createdById: authResult.user.id,
      },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    })

    return NextResponse.json({ status: "ok", user })
  } catch (err) {
    console.error("[auth/create-user]", err)
    return NextResponse.json(
      { error: "Error al crear usuario" },
      { status: 500 }
    )
  }
}
