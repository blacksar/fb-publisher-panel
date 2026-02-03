// @ts-nocheck
import { NextResponse } from "next/server"
export const runtime = "nodejs"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const { sessionId, refresh } = await request.json()

    let session
    if (sessionId) {
      session = await prisma.fBSession.findUnique({ where: { id: sessionId } })
      if (!session) {
        return NextResponse.json({ status: "error", mensaje: "La sesión seleccionada ya no existe" }, { status: 404 })
      }
    } else {
      session = await prisma.fBSession.findFirst({ where: { status: "verified" }, orderBy: { verified_at: "desc" } })
      if (!session) {
        return NextResponse.json({ status: "error", mensaje: "No hay sesiones verificadas" }, { status: 404 })
      }
    }

    // Check cached pages
    // @ts-ignore generado pendiente
    const cachedPages = await prisma.fBPage.findMany({ where: { session_id: session.id } })

    if (!refresh) {
      return NextResponse.json({ status: "cached", pages: cachedPages })
    }

    let cookiesList
    try {
      cookiesList = JSON.parse(session.cookie)
      // Enviar solo cookies esenciales para evitar payload enorme
      if (Array.isArray(cookiesList)) {
        cookiesList = cookiesList.filter((c: any) => ['c_user', 'xs', 'fr', 'datr', 'sb'].includes(c.name))
      }
    } catch {
      return NextResponse.json({ status: "error", mensaje: "Cookie corrupta" }, { status: 500 })
    }
    // Obtener URL de API desde configuración
    const apiSetting = await prisma.setting.findUnique({ where: { key: "fb_api_url" } })
    const base = apiSetting?.value?.trim().replace(/\/+$/, "")
    if (!base) {
      return NextResponse.json({ status: "error", mensaje: "Configura la URL de la API en Ajustes primero" }, { status: 400 })
    }
    const url = `${base}/get_pages/`
    const fbRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cookies: cookiesList }),
      cache: "no-store",
    })
    const contentType = fbRes.headers.get("content-type") || ""
    if (!contentType.includes("application/json")) {
      const text = await fbRes.text()
      return NextResponse.json({ status: "error", mensaje: text.slice(0, 200) || 'Respuesta no JSON del servicio externo' }, { status: 500 })
    }
    const data = await fbRes.json()

    // Check for explicit error from FB (auth or params)
    if (data.status === "error" || (data.resultado && data.resultado.status_code !== 200)) {
      const statusCode = data.resultado?.status_code
      if (statusCode === 400 || statusCode === 401) {
        const { invalidateSession } = await import("@/lib/session-utils")
        await invalidateSession(session.id)
        return NextResponse.json({
          status: "error",
          mensaje: "La sesión ha expirado (Cookie inválida). Cuenta marcada como inactiva.",
          code: "SESSION_EXPIRED"
        }, { status: 400 })
      }
    }

    if (data.status === "ok" && data.resultado?.status_code === 200) {
      // @ts-ignore
      const dbPages = await prisma.fBPage.findMany({ where: { session_id: session.id } })
      const dbMap = new Map(dbPages.map((p: any) => [p.id, p]))

      const raw = data.resultado?.resultado
      if (!raw) {
        console.error("Respuesta de API FB sin resultado raw:", JSON.stringify(data))
        return NextResponse.json({ status: "error", mensaje: "Facebook no devolvió lista de páginas" }, { status: 500 })
      }

      let rawPages: any[] = []
      try {
        rawPages = JSON.parse(raw)
      } catch (e) {
        console.error("Error parseando resultado de FB:", e)
        return NextResponse.json({ status: "error", mensaje: "Error al leer datos de Facebook" }, { status: 500 })
      }

      const mergedPages = rawPages.map((fbPage: any) => {
        const local = dbMap.get(fbPage.id)
        return {
          ...fbPage,
          // Persistir is_selected si existe localmente, si no default false
          is_selected: local ? (local as any).is_selected : false
        }
      })

      // Actualizar la respuesta para el frontend
      data.resultado.resultado = JSON.stringify(mergedPages)

      // Guardar/Actualizar en BD (evitar upsert en bucle por MySQL 1020 "Record has changed")
      const existingIds = new Set(dbPages.map((p: any) => p.id))
      const toCreate = mergedPages.filter((p: any) => !existingIds.has(p.id))
      const toUpdate = mergedPages.filter((p: any) => existingIds.has(p.id))

      if (toCreate.length > 0) {
        await prisma.fBPage.createMany({
          data: toCreate.map((p: any) => ({
            id: String(p.id),
            name: String(p.name),
            session_id: session.id,
            is_selected: Boolean(p.is_selected ?? false),
          })),
          skipDuplicates: true,
        })
      }

      for (const page of toUpdate) {
        await prisma.fBPage.updateMany({
          where: { id: String(page.id), session_id: session.id },
          data: { name: String(page.name) },
        })
      }

      return NextResponse.json(data)
    }

    // Si status no es ok o no hay resultado
    return NextResponse.json(data)

  } catch (err: any) {
    return NextResponse.json({ status: "error", mensaje: err.message || "Error al obtener páginas" }, { status: 500 })
  }
} 