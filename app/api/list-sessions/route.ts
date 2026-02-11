import { NextResponse } from "next/server"
export const runtime = "nodejs"
import { prisma } from "@/lib/prisma"
import { requireAuth, getEffectiveUserId } from "@/lib/auth"

export async function GET(request: Request) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const effectiveUserId = getEffectiveUserId(authResult)

  try {
    const where = authResult.user.role === "ADMIN" && !authResult.impersonationUserId
      ? {}
      : { userId: effectiveUserId }
    const sessions = await prisma.fBSession.findMany({
      where,
      orderBy: { id: "desc" },
      select: {
        id: true,
        name: true,
        user_name: true,
        status: true,
        source: true,
        verified_at: true,
      },
    })
    return NextResponse.json({ status: "ok", sessions }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
      },
    })
  } catch (err: any) {
    return NextResponse.json({ status: "error", mensaje: err.message || "Error" }, { status: 500 })
  }
} 