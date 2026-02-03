import { NextResponse } from "next/server"
export const runtime = "nodejs"
import { prisma } from "@/lib/prisma"
import { savePreview, verifySessionLive } from "@/lib/facebook"

export async function POST(request: Request) {
  try {
    const { sessionId, pageId, title, comment, imageBase64, scheduledAt } = await request.json()
    if (!scheduledAt) return NextResponse.json({ status: "error", mensaje: "Fecha de programación requerida" }, { status: 400 })

    // 1. Resolve Session
    let session
    if (sessionId) {
      session = await prisma.fBSession.findUnique({ where: { id: sessionId } })
    } else {
      session = await prisma.fBSession.findFirst({ where: { status: "verified" }, orderBy: { verified_at: "desc" } })
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

    // 4. Save Image (Fix: Use robust logic from lib)
    let previewUrl: string | undefined

    // DEBUG LOG
    console.log(`[Schedule Debug] sessionId: ${sessionId}, imageBase64 type: ${typeof imageBase64}, length: ${imageBase64?.length}, startsWithData: ${imageBase64?.startsWith?.('data:')}`)

    if (imageBase64 && typeof imageBase64 === 'string') {
      if (imageBase64.startsWith('data:image/')) {
        try {
          previewUrl = await savePreview(imageBase64)
          console.log("[Schedule Debug] Image saved at:", previewUrl)
        } catch (e: any) {
          console.error("Error guardando preview para schedule:", e)
          return NextResponse.json({
            status: "error",
            mensaje: `Error procesando imagen: ${e.message}`
          }, { status: 500 })
        }
      } else {
        previewUrl = imageBase64
        console.log("[Schedule Debug] Using existing URL:", previewUrl)
      }
    } else {
      console.log("[Schedule Debug] No image in payload")
    }

    // 5. Create Scheduled Post
    const post = await prisma.post.create({
      // @ts-ignore
      data: {
        title,
        content: comment,
        status: "scheduled",
        scheduled_at: new Date(scheduledAt),
        image_url: previewUrl,
        page_id: pageId,
        page_name: pageName,
        session_id: session.id,
        created_at: new Date(),
      },
    })

    return NextResponse.json({ status: "ok", post, mensaje: "Publicación programada exitosamente" })
  } catch (err: any) {
    console.error("Error in schedule-post:", err)
    return NextResponse.json({ status: "error", mensaje: err.message || "Error interno" }, { status: 500 })
  }
} 