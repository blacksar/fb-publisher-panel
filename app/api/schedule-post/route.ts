import { NextResponse } from "next/server"
export const runtime = "nodejs"
import { prisma } from "@/lib/prisma"
import { savePreview, verifySessionLive } from "@/lib/facebook"
import { requireAuth, getEffectiveUserId } from "@/lib/auth"

export async function POST(request: Request) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const effectiveUserId = getEffectiveUserId(authResult)

  try {
    const { sessionId, pageId, title, comment, imageBase64, scheduledAt, postId } = await request.json()
    if (!scheduledAt) return NextResponse.json({ status: "error", mensaje: "Fecha de programación requerida" }, { status: 400 })
    const scheduledDate = new Date(scheduledAt)
    if (Number.isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ status: "error", mensaje: "Fecha de programación inválida" }, { status: 400 })
    }

    const sessionWhere = authResult.user.role === "ADMIN" && !authResult.impersonationUserId
      ? {}
      : { userId: effectiveUserId }

    let session
    if (sessionId) {
      session = await prisma.fBSession.findFirst({
        where: { id: sessionId, ...sessionWhere },
      })
    } else {
      session = await prisma.fBSession.findFirst({
        where: { status: "verified", ...sessionWhere },
        orderBy: { verified_at: "desc" },
      })
    }
    if (!session) return NextResponse.json({ status: "error", mensaje: "Sesión no encontrada" }, { status: 404 })

    // 2. Verify Session Live (Security check)
    const isSessionActive = await verifySessionLive(session.cookie)
    if (!isSessionActive) {
      await prisma.fBSession.update({ where: { id: session.id }, data: { status: 'inactive' } })
      return NextResponse.json({
        status: "error",
        mensaje: "La sesión ha caducado. Por favor verifique su cuenta antes de programar.",
        code: "SESSION_EXPIRED"
      }, { status: 400 })
    }

    // 3. Get Page Info (Fix: Save page name correctly)
    const pageData = await prisma.fBPage.findUnique({ where: { id: pageId } })
    const pageName = pageData?.name || "Página desconocida"

    // 4. Imagen: guardar base64 en DB (cron no depende de disco/HTTP) y preview en image_url
    let previewUrl: string | undefined
    let storedBase64: string | undefined

    if (imageBase64 && typeof imageBase64 === 'string') {
      if (imageBase64.startsWith('data:image/')) {
        storedBase64 = imageBase64
        try {
          previewUrl = await savePreview(imageBase64)
        } catch (e: any) {
          console.error("Error guardando preview para schedule:", e)
          return NextResponse.json({
            status: "error",
            mensaje: `Error procesando imagen: ${e.message}`
          }, { status: 500 })
        }
      } else {
        previewUrl = imageBase64
      }
    }

    const postWhere =
      authResult.user.role === "ADMIN" && !authResult.impersonationUserId
        ? { id: postId }
        : { id: postId, userId: effectiveUserId }

    if (postId) {
      const existing = await prisma.post.findFirst({
        where: postWhere,
        select: { id: true, status: true },
      })
      if (existing && (existing.status === "scheduled" || existing.status === "draft")) {
        const post = await prisma.post.update({
          where: { id: postId },
          data: {
            title,
            content: comment,
            status: "scheduled",
            scheduled_at: scheduledDate,
            image_url: previewUrl ?? undefined,
            image_base64: storedBase64 ?? undefined,
            page_id: pageId,
            page_name: pageName,
            session_id: session.id,
            userId: effectiveUserId,
          },
        })
        return NextResponse.json({ status: "ok", post, mensaje: "Publicación programada actualizada" })
      }
    }

    const post = await prisma.post.create({
      data: {
        title,
        content: comment,
        status: "scheduled",
        scheduled_at: scheduledDate,
        image_url: previewUrl,
        image_base64: storedBase64,
        page_id: pageId,
        page_name: pageName,
        session_id: session.id,
        userId: effectiveUserId,
      },
    })

    return NextResponse.json({ status: "ok", post, mensaje: "Publicación programada exitosamente" })
  } catch (err: any) {
    console.error("Error in schedule-post:", err)
    return NextResponse.json({ status: "error", mensaje: err.message || "Error interno" }, { status: 500 })
  }
} 