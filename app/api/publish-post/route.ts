import { NextResponse } from "next/server"
export const runtime = "nodejs"
import { prisma } from "@/lib/prisma"
import { savePreview, publishToFacebook } from "@/lib/facebook"
import { requireAuth, getEffectiveUserId } from "@/lib/auth"

const CRON_SECRET = process.env.CRON_SECRET

export async function POST(request: Request) {
  let authResult: { user: { id: string; role: string }; impersonationUserId: string | null } | NextResponse
  let sessionWhere: Record<string, unknown> = {}

  const body = await request.json().catch(() => ({}))
  const postId = body.postId
  const sessionId = body.sessionId

  if (CRON_SECRET && request.headers.get("X-Cron-Secret") === CRON_SECRET) {
    let effectiveUserId: string | null = null
    if (postId) {
      const post = await prisma.post.findUnique({ where: { id: postId }, select: { userId: true } })
      effectiveUserId = post?.userId ?? null
    }
    if (effectiveUserId == null && sessionId) {
      const session = await prisma.fBSession.findUnique({ where: { id: sessionId }, select: { userId: true } })
      effectiveUserId = session?.userId ?? null
    }
    if (effectiveUserId == null) {
      return NextResponse.json({ status: "error", mensaje: "Cron: post o sesión sin userId" }, { status: 400 })
    }
    authResult = {
      user: { id: effectiveUserId, email: "", name: null, role: "ADMIN" as const, active: true },
      impersonationUserId: null,
    }
    sessionWhere = {}
  } else {
    authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    sessionWhere = authResult.user.role === "ADMIN" && !authResult.impersonationUserId
      ? {}
      : { userId: getEffectiveUserId(authResult) }
  }

  const effectiveUserId = getEffectiveUserId(authResult as { user: { id: string }; impersonationUserId: string | null })

  let pageId, title, comment, imageBase64, save_draft, scheduled_at

  try {
    pageId = body.pageId
    title = body.title
    comment = body.comment
    imageBase64 = body.imageBase64
    save_draft = body.save_draft
    scheduled_at = body.scheduled_at

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

    const pageData = await prisma.fBPage.findUnique({ where: { id: pageId } })
    const pageName = pageData?.name || ""

    const isCron = !!(CRON_SECRET && request.headers.get("X-Cron-Secret") === CRON_SECRET)

    // Si no vino imagen en el body pero tenemos postId, usar image_base64 guardada en DB
    if (postId && (!imageBase64 || typeof imageBase64 !== "string")) {
      const existing = await prisma.post.findUnique({
        where: { id: postId },
        select: { image_base64: true },
      })
      if (existing?.image_base64 && existing.image_base64.startsWith("data:image/")) {
        imageBase64 = existing.image_base64
      }
    }
    if (isCron && (!imageBase64 || typeof imageBase64 !== "string")) {
      console.warn("[publish-post] Cron: sin imagen en payload ni en DB (postId=%s)", postId)
    }

    let previewUrl: string | undefined
    let storedBase64: string | undefined

    if (imageBase64 && typeof imageBase64 === 'string') {
      if (imageBase64.startsWith('data:image/')) {
        storedBase64 = imageBase64
        try {
          previewUrl = await savePreview(imageBase64)
        } catch (e) {
          console.error("Error guardando preview:", e)
        }
      } else {
        previewUrl = imageBase64
      }
    }

    const imageForPublish = storedBase64 ?? previewUrl

    // IF DRAFT REQ -> Skip FB Logic
    if (save_draft) {
      let status = "draft"
      const draftData: Record<string, unknown> = {
        title, content: comment, status, image_url: previewUrl, page_id: pageId,
        page_name: pageName,
        session_id: session.id,
        published_at: null
      }
      if (storedBase64) (draftData as any).image_base64 = storedBase64

      let post
      if (postId) {
        post = await prisma.post.update({
          where: { id: postId },
          data: draftData as any,
        })
      } else {
        post = await prisma.post.create({
          data: { ...draftData, userId: effectiveUserId } as any,
        })
      }
      return NextResponse.json({ status: "ok", post, mensaje: "Guardado en borrador" })
    }

    // --- PUBLICAR EN FACEBOOK ---
    const result = await publishToFacebook(
      { title, content: comment, imageBase64: imageForPublish, pageId },
      session
    )

    if (!result.success) {
      // Definir error log estructurado: Primero mensaje, luego raw data
      const errorLog = result.errorLog
        ? JSON.stringify({ mensaje: result.error, respuesta_completa: result.errorLog })
        : JSON.stringify({ mensaje: result.error || "Unknown error" })

      // Falló publicación
      // Si fue por error de sesión (auth), marcamos pending de todas formas
      if (result.errorCode === "SESSION_EXPIRED") {
        const { invalidateSession } = await import("@/lib/session-utils")
        await invalidateSession(session.id)

        // Guardar como pendiente CON log de error (para saber por qué expiró o qué dijo FB)
        const status = "pending"
        const pendingData: Record<string, unknown> = { status, error_log: errorLog, image_url: previewUrl }
        if (storedBase64) (pendingData as any).image_base64 = storedBase64
        let post
        if (postId) {
          post = await prisma.post.update({ where: { id: postId }, data: pendingData as any })
        } else {
          post = await prisma.post.create({
            data: { title, content: comment, ...pendingData, page_id: pageId, page_name: pageName, session_id: session.id, userId: effectiveUserId } as any,
          })
        }
        return NextResponse.json({ status: "ok", post, mensaje: "Sesión expiró durante publicación. Guardado como pendiente." })
      }

      // Error General (no auth) -> Marcar como FAILED y guardar LOG
      const status = "failed"
      const failedData: Record<string, unknown> = { status, error_log: errorLog, image_url: previewUrl }
      if (storedBase64) (failedData as any).image_base64 = storedBase64
      let post
      if (postId) {
        post = await prisma.post.update({ where: { id: postId }, data: failedData as any })
      } else {
        post = await prisma.post.create({
          data: { title, content: comment, ...failedData, page_id: pageId, page_name: pageName, session_id: session.id, userId: effectiveUserId } as any,
        })
      }

      return NextResponse.json({ status: "error", mensaje: result.error || "Error al publicar" }, { status: 500 })
    }

    // 3. Éxito
    const status = "published"
    const fbPostId = result.fb_post_id

    const publishedData: Record<string, unknown> = {
      title, content: comment, status: "published", published_at: new Date(),
      image_url: previewUrl, page_id: pageId, page_name: pageName, session_id: session.id, fb_post_id: fbPostId
    }
    if (storedBase64) (publishedData as any).image_base64 = storedBase64

    let post
    if (postId) {
      post = await prisma.post.update({
        where: { id: postId },
        data: publishedData as any,
      })
    } else {
      post = await prisma.post.create({
        data: { ...publishedData, userId: effectiveUserId } as any,
      })
    }

    return NextResponse.json({ status: "ok", post, mensaje: "Publicación exitosa" })
  } catch (err: any) {
    console.error("Critical error in publish-post:", err)

    // INTENTO DE RECUPERACIÓN: Si falla algo inesperado (ej. prisma, network),
    // intentamos marcar el post como FAILED en la BD para que el usuario lo vea.
    try {
      const errorDetail = {
        message: err.message || "Unknown error",
        stack: err.stack,
        source: "Critical Exception in API Route"
      }
      const errorLog = JSON.stringify(errorDetail)

      if (postId) {
        // Si ya existía el draft/post, lo actualizamos
        await prisma.post.update({
          where: { id: postId },
          data: { status: "failed", error_log: errorLog }
        })
      } else {
        // Si era nuevo y falló antes de crearse (o durante), intentamos crearlo como fallido
        // para que no se pierda la intención y el usuario vea el log.
        // Necesitamos session para crear.
        const sessionForError = sessionId
          ? await prisma.fBSession.findFirst({ where: { id: sessionId, ...sessionWhere } })
          : await prisma.fBSession.findFirst({ where: { status: "verified", ...sessionWhere } })

        if (sessionForError && (title || comment)) {
          await prisma.post.create({
            data: {
              title: title || "Sin título (Error)",
              content: comment || "",
              status: "failed",
              image_url: null,
              page_id: pageId || "",
              page_name: "",
              session_id: sessionForError.id,
              userId: effectiveUserId,
              error_log: errorLog
            }
          })
        }
      }
    } catch (dbErr) {
      console.error("Error writing failure log to DB:", dbErr)
    }

    return NextResponse.json({ status: "error", mensaje: err.message || "Error Crítico" }, { status: 500 })
  }
} 