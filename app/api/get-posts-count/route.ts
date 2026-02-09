import { NextResponse } from "next/server"
export const runtime = "nodejs"
import { prisma } from "@/lib/prisma"
import { requireAuth, getEffectiveUserId } from "@/lib/auth"

export async function POST(request: Request) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const effectiveUserId = getEffectiveUserId(authResult)

  try {
    const { sessionId } = await request.json().catch(() => ({}))
    const baseWhere = authResult.user.role === "ADMIN" && !authResult.impersonationUserId
      ? {}
      : { userId: effectiveUserId }
    const sessionFilter = sessionId ? { session_id: sessionId } : {}

    const [published, draft, scheduled, pending, failed, trash] = await Promise.all([
      prisma.post.count({ where: { ...baseWhere, ...sessionFilter, deleted_at: null, status: "published" } }),
      prisma.post.count({ where: { ...baseWhere, ...sessionFilter, deleted_at: null, status: "draft" } }),
      prisma.post.count({ where: { ...baseWhere, ...sessionFilter, deleted_at: null, status: "scheduled" } }),
      prisma.post.count({ where: { ...baseWhere, ...sessionFilter, deleted_at: null, status: "pending" } }),
      prisma.post.count({ where: { ...baseWhere, ...sessionFilter, deleted_at: null, status: "failed" } }),
      prisma.post.count({ where: { ...baseWhere, ...sessionFilter, deleted_at: { not: null } } }),
    ])

    return NextResponse.json({
      status: "ok",
      counts: { published, draft, scheduled, pending, failed, trash },
    })
  } catch (err: any) {
    return NextResponse.json({ status: "error", mensaje: err.message || "Error" }, { status: 500 })
  }
}
