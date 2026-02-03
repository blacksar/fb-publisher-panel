import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const { sessionId, refresh } = await request.json()

    let session

    if (sessionId) {
      session = await prisma.fBSession.findUnique({ where: { id: sessionId } })
    } else {
      // Buscar la última sesión verificada
      session = await prisma.fBSession.findFirst({
        where: { status: "verified" },
        orderBy: { verified_at: "desc" },
      })
    }

    if (!session) {
      return NextResponse.json({ status: "error", mensaje: "No hay sesiones verificadas" }, { status: 404 })
    }


    // @ts-ignore
    const cachedPages = await prisma.fBPage.findMany({ where: { session_id: session.id } })
    if (!refresh) {
      return NextResponse.json({ status: "cached", pages: cachedPages })
    }

    let cookiesList: unknown
    try {
      cookiesList = JSON.parse(session.cookie)
    } catch {
      return NextResponse.json({ status: "error", mensaje: "Cookie corrupta" }, { status: 500 })
    }

    // Obtener URL de API desde configuración
    const apiSetting = await prisma.setting.findUnique({ where: { key: "fb_api_url" } })
    const base = (apiSetting?.value || "").trim().replace(/\/+$/, "")
    if (!base) {
      return NextResponse.json({ status: "error", mensaje: "Configura la URL de la API en Ajustes primero" }, { status: 400 })
    }
    const url = `${base}/get_pages/`

    const fbRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cookies: cookiesList }),
      cache: "no-store",
    })


    const data = await fbRes.json()

    if (data.status === "ok") {
      const dbPages = await prisma.fBPage.findMany({ where: { session_id: session.id } })
      const dbMap = new Map(dbPages.map((p: any) => [p.id, p]))

      let rawPages: any[] = []
      try {
        if (!data.resultado || !data.resultado.resultado) {
          console.error("Respuesta de API FB estructura inesperada:", JSON.stringify(data))
          throw new Error("Estructura de respuesta inválida desde Facebook")
        }
        rawPages = JSON.parse(data.resultado.resultado)
      } catch (e) {
        console.error("Error parseando resultado de FB:", e)
        return NextResponse.json({ status: "error", mensaje: "Error procesando datos de Facebook" }, { status: 500 })
      }

      const mergedPages = rawPages.map((fbPage: any) => {
        const local = dbMap.get(fbPage.id)
        // Persistir el estado is_selected si existe localmente
        return {
          ...fbPage,
          is_selected: local ? (local as any).is_selected : false
        }
      })

      // Actualizar la respuesta "raw" con la data fusionada si el frontend la usa, 
      // o mejor, devolver 'mergedPages' en una propiedad limpia para que el frontend no tenga que parsear de nuevo.
      // Sin embargo, para minimizar cambios en frontend, inyectaremos is_selected en el objeto parseado
      // y reconstruiremos el string JSON solo si fuera estrictamente necesario, pero el frontend hace JSON.parse(raw).
      // MODIFICACIÓN: Vamos a interceptar esto y enviar una respuesta estructurada que el frontend pueda usar mejor,
      // O ajustamos el frontend.
      // MEJOR: Reemplazar el string JSON en data.resultado.resultado con el string actualizado.

      data.resultado.resultado = JSON.stringify(mergedPages)

      // Actualizar/Crear en BD (evitar upsert en bucle por MySQL 1020 "Record has changed")
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
    }

    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "error",
        mensaje: err.message || "Error al obtener páginas",
      },
      { status: 500 },
    )
  }
} 