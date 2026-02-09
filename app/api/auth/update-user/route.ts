import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/auth"

/** PATCH body: { userId: string, active?: boolean, name?: string } — solo ADMIN */
export async function PATCH(request: Request) {
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await request.json()
    const { userId, active, name } = body
    if (!userId) {
      return NextResponse.json({ error: "userId requerido" }, { status: 400 })
    }

    const target = await prisma.user.findUnique({ where: { id: userId } })
    if (!target) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
    }
    if (target.id === authResult.user.id && active === false) {
      return NextResponse.json(
        { error: "No puedes desactivar tu propio usuario" },
        { status: 400 }
      )
    }

    const data: { active?: boolean; name?: string } = {}
    if (typeof active === "boolean") data.active = active
    if (typeof name === "string") data.name = name.trim() || null

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, name: true, role: true, active: true },
    })
    return NextResponse.json({ status: "ok", user })
  } catch (err) {
    console.error("[auth/update-user]", err)
    return NextResponse.json(
      { error: "Error al actualizar usuario" },
      { status: 500 }
    )
  }
}
