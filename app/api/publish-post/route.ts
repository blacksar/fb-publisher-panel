import { NextResponse } from "next/server"
export const runtime = "nodejs"
import { prisma } from "@/lib/prisma"
import { savePreview, verifySessionLive, publishToFacebook } from "@/lib/facebook"

export async function POST(request: Request) {
  let postId, sessionId, pageId, title, comment, imageBase64, save_draft, scheduled_at

  try {
    const body = await request.json()
    postId = body.postId
    sessionId = body.sessionId
    pageId = body.pageId
    title = body.title
    comment = body.comment
    imageBase64 = body.imageBase64
    save_draft = body.save_draft
    scheduled_at = body.scheduled_at

    // Resolve session (necesaria para linkear el post, aunque sea draft)
    let session
    if (sessionId) {
      session = await prisma.fBSession.findUnique({ where: { id: sessionId } })
    } else {
      session = await prisma.fBSession.findFirst({ where: { status: "verified" }, orderBy: { verified_at: "desc" } })
    }

    if (!session) return NextResponse.json({ status: "error", mensaje: "Sesión no encontrada" }, { status: 404 })

    const pageData = await prisma.fBPage.findUnique({ where: { id: pageId } })
    const pageName = pageData?.name || ""

    let previewUrl: string | undefined

    if (imageBase64 && typeof imageBase64 === 'string') {
      if (imageBase64.startsWith('data:image/')) {
        try {
          previewUrl = await savePreview(imageBase64)
        } catch (e) {
          console.error("Error guardando preview:", e)
        }
      } else {
        previewUrl = imageBase64
      }
    }

    // IF DRAFT REQ -> Skip FB Logic
    if (save_draft) {
      let status = "draft"
      // Si es draft pero tiene fecha, podria considerarse scheduled internamente en nuestro sistema 
      // aunque no se mande a FB aun? 
      // Normalmente scheduled se manda a API de FB schedule. 
      // Si es "Guardar Borrador" explícito, es draft.

      let post
      if (postId) {
        post = await prisma.post.update({
          where: { id: postId },
          data: {
            title, content: comment, status, image_url: previewUrl, page_id: pageId,
            page_name: pageName,
            session_id: session.id,
            // Si es draft, limpiamos published_at
            published_at: null
          }
        })
      } else {
        post = await prisma.post.create({
          // @ts-ignore
          data: {
            title, content: comment, status, image_url: previewUrl, page_id: pageId,
            page_name: pageName,
            session_id: session.id, created_at: new Date()
          }
        })
      }
      return NextResponse.json({ status: "ok", post, mensaje: "Guardado en borrador" })
    }

    // --- LOGICA DE PUBLICACION CON VERIFICACION LIVE ---

    // 1. Verificar Sesión en Vivo
    const isSessionActive = await verifySessionLive(session.cookie)

    if (!isSessionActive) {
      // Sesion Caducada -> Marcar Inactiva y Guardar como Pending
      await prisma.fBSession.update({ where: { id: session.id }, data: { status: 'inactive' } })

      const status = "pending"
      let post
      if (postId) {
        post = await prisma.post.update({
          where: { id: postId },
          data: { title, content: comment, status, image_url: previewUrl, page_id: pageId, page_name: pageName, session_id: session.id, published_at: null }
        })
      } else {
        post = await prisma.post.create({
          // @ts-ignore
          data: { title, content: comment, status, image_url: previewUrl, page_id: pageId, page_name: pageName, session_id: session.id, created_at: new Date() }
        })
      }

      return NextResponse.json({ status: "ok", post, mensaje: "Sesión caducada. Post guardado como pendiente." })
    }

    // 2. Intentar Publicar (Sesión es válida)
    const result = await publishToFacebook(
      { title, content: comment, imageBase64: previewUrl, pageId },
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
        let post
        if (postId) {
          post = await prisma.post.update({ where: { id: postId }, data: { status, error_log: errorLog } })
        } else {
          post = await prisma.post.create({
            // @ts-ignore
            data: { title, content: comment, status, image_url: previewUrl, page_id: pageId, page_name: pageName, session_id: session.id, created_at: new Date(), error_log: errorLog }
          })
        }
        return NextResponse.json({ status: "ok", post, mensaje: "Sesión expiró durante publicación. Guardado como pendiente." })
      }

      // Error General (no auth) -> Marcar como FAILED y guardar LOG
      const status = "failed"
      let post
      if (postId) {
        post = await prisma.post.update({ where: { id: postId }, data: { status, error_log: errorLog } })
      } else {
        post = await prisma.post.create({
          // @ts-ignore
          data: { title, content: comment, status, image_url: previewUrl, page_id: pageId, page_name: pageName, session_id: session.id, created_at: new Date(), error_log: errorLog }
        })
      }

      return NextResponse.json({ status: "error", mensaje: result.error || "Error al publicar" }, { status: 500 })
    }

    // 3. Éxito
    const status = "published"
    const fbPostId = result.fb_post_id

    let post
    if (postId) {
      post = await prisma.post.update({
        where: { id: postId },
        data: {
          title, content: comment, status, published_at: new Date(),
          image_url: previewUrl, page_id: pageId, page_name: pageName, session_id: session.id, fb_post_id: fbPostId
        }
      })
    } else {
      post = await prisma.post.create({
        // @ts-ignore
        data: {
          title, content: comment, status, published_at: new Date(),
          image_url: previewUrl, page_id: pageId, page_name: pageName, session_id: session.id, fb_post_id: fbPostId
        }
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
          ? await prisma.fBSession.findUnique({ where: { id: sessionId } })
          : await prisma.fBSession.findFirst({ where: { status: "verified" } })

        if (sessionForError && (title || comment)) {
          await prisma.post.create({
            // @ts-ignore
            data: {
              title: title || "Sin título (Error)",
              content: comment || "",
              status: "failed",
              // Si tenemos imageBase64 tratamos de previsualizar, pero si falló eso, guardamos null
              image_url: null,
              page_id: pageId || "",
              page_name: "", // No lo tenemos seguro
              session_id: sessionForError.id,
              created_at: new Date(),
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