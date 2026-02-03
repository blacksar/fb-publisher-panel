import { NextResponse } from "next/server"
export const runtime = "nodejs"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json()
    let where = {}
    if (sessionId) where = { session_id: sessionId }
    const posts = await prisma.post.findMany({ where, orderBy: { created_at: "desc" } })

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