import { NextResponse } from "next/server"
export const runtime = "nodejs"
import { prisma } from "@/lib/prisma"
import { requireAuth, getEffectiveUserId } from "@/lib/auth"

export async function POST(request: Request) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const effectiveUserId = getEffectiveUserId(authResult)

  try {
    const { postId } = await request.json()
    if (!postId) {
      return NextResponse.json({ status: "error", mensaje: "ID de post requerido" }, { status: 400 })
    }

    const postWhere =
      authResult.user.role === "ADMIN" && !authResult.impersonationUserId
        ? { id: postId }
        : { id: postId, userId: effectiveUserId }
    const post = await prisma.post.findFirst({ where: postWhere })
    if (!post) {
      return NextResponse.json({ status: "error", mensaje: "Post no encontrado" }, { status: 404 })
    }
    if (!post.deleted_at) {
      return NextResponse.json({ status: "error", mensaje: "El post no está en la papelera" }, { status: 400 })
    }

    await prisma.post.update({
      where: { id: postId },
      data: { deleted_at: null },
    })
    return NextResponse.json({ status: "ok", mensaje: "Post restaurado" })
  } catch (err: any) {
    return NextResponse.json({ status: "error", mensaje: err.message || "Error al restaurar" }, { status: 500 })
  }
}
