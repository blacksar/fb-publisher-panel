import { NextResponse } from "next/server"
export const runtime = "nodejs"
import { prisma } from "@/lib/prisma"
import { requireAuth, getEffectiveUserId } from "@/lib/auth"

export async function POST(request: Request) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const effectiveUserId = getEffectiveUserId(authResult)

  try {
    const body = await request.json()
    const postId = body?.postId != null ? Number(body.postId) : null
    const permanent = body?.permanent === true || body?.permanent === "true"

    if (postId == null || Number.isNaN(postId)) {
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

    if (permanent) {
      if (!post.deleted_at) {
        return NextResponse.json({ status: "error", mensaje: "Solo se puede borrar permanentemente desde la papelera" }, { status: 400 })
      }
      await prisma.post.delete({ where: { id: post.id } })
      return NextResponse.json({ status: "ok", mensaje: "Post eliminado permanentemente" })
    }

    await prisma.post.update({
      where: { id: post.id },
      data: { deleted_at: new Date() },
    })
    return NextResponse.json({ status: "ok", mensaje: "Movido a papelera" })
  } catch (err: any) {
    return NextResponse.json({ status: "error", mensaje: err.message || "Error al eliminar" }, { status: 500 })
  }
}
