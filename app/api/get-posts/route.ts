import { NextResponse } from "next/server"
export const runtime = "nodejs"
import { prisma } from "@/lib/prisma"
import { requireAuth, getEffectiveUserId } from "@/lib/auth"

export async function POST(request: Request) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const effectiveUserId = getEffectiveUserId(authResult)

  try {
    const { sessionId, trash } = await request.json().catch(() => ({}))
    const baseWhere = authResult.user.role === "ADMIN" && !authResult.impersonationUserId
      ? {}
      : { userId: effectiveUserId }
    let where = baseWhere as { session_id?: number; userId?: string; deleted_at?: null | { not: null } }
    if (sessionId) where = { ...where, session_id: sessionId }
    if (trash === true) {
      where.deleted_at = { not: null }
    } else {
      where.deleted_at = null
    }
    const posts = await prisma.post.findMany({
      where,
      orderBy: trash === true ? { deleted_at: "desc" } : { created_at: "desc" },
      select: {
        id: true,
        title: true,
        content: true,
        status: true,
        scheduled_at: true,
        published_at: true,
        image_url: true,
        page_name: true,
        page_id: true,
        fb_post_id: true,
        created_at: true,
        session_id: true,
        userId: true,
        error_log: true,
        deleted_at: true,
      },
    })

    // Enriquecer posts con nombres de página si faltan
    const postsWithNames = await Promise.all(posts.map(async (p: any) => {
      if (!p.page_name || p.page_name === "") {
        const page = await prisma.fBPage.findUnique({ where: { id: p.page_id } })
        if (page) {
          p.page_name = page.name
        }
      }
      return p
    }))

    return NextResponse.json({ status: "ok", posts: postsWithNames })
  } catch (err: any) {
    return NextResponse.json({ status: "error", mensaje: err.message || "Error" }, { status: 500 })
  }
} 