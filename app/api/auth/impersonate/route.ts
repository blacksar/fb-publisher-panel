import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin, setAuthCookie, getSessionFromRequest } from "@/lib/auth"

/** POST body: { userId: string } — activar impersonación. Sin body o userId null — salir. */
export async function POST(request: Request) {
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await request.json().catch(() => ({}))
    const targetUserId = body.userId ?? null

    if (!targetUserId) {
      const payload = await getSessionFromRequest(request)
      if (!payload) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
      await setAuthCookie({
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        impersonationUserId: null,
      })
      return NextResponse.json({ status: "ok", impersonationUserId: null })
    }

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, role: true, active: true },
    })
    if (!target || !target.active) {
      return NextResponse.json(
        { error: "Usuario no encontrado o inactivo" },
        { status: 404 }
      )
    }

    await setAuthCookie({
      userId: authResult.user.id,
      email: authResult.user.email,
      role: authResult.user.role,
      impersonationUserId: target.id,
    })
    return NextResponse.json({ status: "ok", impersonationUserId: target.id })
  } catch (err) {
    console.error("[auth/impersonate]", err)
    return NextResponse.json(
      { error: "Error al cambiar de usuario" },
      { status: 500 }
    )
  }
}
