import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/auth"

export async function GET(request: Request) {
  const authResult = await requireAdmin(request)
  if (authResult instanceof NextResponse) return authResult

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        createdAt: true,
        createdById: true,
      },
    })
    return NextResponse.json({ status: "ok", users })
  } catch (err) {
    console.error("[auth/list-users]", err)
    return NextResponse.json(
      { error: "Error al listar usuarios" },
      { status: 500 }
    )
  }
}
