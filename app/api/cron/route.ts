import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { promises as fs } from "fs"
import path from "path"

const CRON_SECRET = process.env.CRON_SECRET

async function previewToBase64(urlPath: string): Promise<string> {
  const relative = urlPath.startsWith("/") ? urlPath.slice(1) : urlPath
  const filePath = path.join(process.cwd(), "public", relative)
  const buffer = await fs.readFile(filePath)
  const ext = path.extname(filePath).slice(1) || "png"
  const mime = `image/${ext}`
  return `data:${mime};base64,${buffer.toString("base64")}`
}

/** Descarga imagen desde URL remota (ej. Coolify) y devuelve data URL base64. */
async function fetchRemoteImageToBase64(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl, { cache: "no-store" })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  const contentType = res.headers.get("content-type") || "image/png"
  const mime = contentType.split(";")[0].trim()
  return `data:${mime};base64,${buffer.toString("base64")}`
}

async function getImageBase64(p: { id: number; image_url?: string | null }) {
  if (!p.image_url) return undefined
  if (p.image_url.startsWith("/uploads/")) {
    try {
      return await previewToBase64(p.image_url)
    } catch (err) {
      console.error("Error leyendo imagen para post", p.id, err)
      return undefined
    }
  }
  if (p.image_url.startsWith("data:image/")) return p.image_url
  if (p.image_url.startsWith("http://") || p.image_url.startsWith("https://")) {
    try {
      return await fetchRemoteImageToBase64(p.image_url)
    } catch (err) {
      console.error("Error descargando imagen remota para post", p.id, err)
      return undefined
    }
  }
  return undefined
}

function getBaseUrl(request: Request): string {
  const envBase = process.env.CRON_BASE_URL?.trim()
  if (envBase) return envBase.replace(/\/+$/, "")
  try {
    const url = new URL(request.url)
    if (url.origin && url.origin !== "null") return url.origin
  } catch (_) {}
  const proto = request.headers.get("x-forwarded-proto") || request.headers.get("x-forwarded-protocol") || "https"
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3000"
  return `${proto}://${host}`
}

/** GET /api/cron?secret=xxx — Ejecuta la cola de publicaciones (programados vencidos + pendientes). */
export async function GET(request: Request) {
  let secret: string | null = request.headers.get("X-Cron-Secret")
  if (!secret) {
    try {
      const url = new URL(request.url)
      secret = url.searchParams.get("secret")
    } catch {
      const base = process.env.CRON_BASE_URL || "http://localhost:3000"
      const url = new URL(request.url, base + "/")
      secret = url.searchParams.get("secret")
    }
  }
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const baseUrl = getBaseUrl(request)
  const now = new Date()

  const [due, pending, scheduledTotal] = await Promise.all([
    prisma.post.findMany({
      where: { status: "scheduled", scheduled_at: { lte: now }, deleted_at: null },
    }),
    prisma.post.findMany({
      where: { status: "pending", deleted_at: null },
    }),
    prisma.post.count({
      where: { status: "scheduled", deleted_at: null },
    }),
  ])
  const scheduledFuture = scheduledTotal - due.length

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(CRON_SECRET ? { "X-Cron-Secret": CRON_SECRET } : {}),
  }

  for (const p of due) {
    let imgBase64 =
      p.image_base64 && p.image_base64.startsWith("data:image/")
        ? p.image_base64
        : await getImageBase64(p)
    if (imgBase64 && imgBase64.startsWith("data:image/") && !(p.image_base64 && p.image_base64.startsWith("data:image/"))) {
      try {
        await prisma.post.update({
          where: { id: p.id },
          data: { image_base64: imgBase64 },
        })
      } catch (e) {
        console.error("Error guardando image_base64 para post", p.id, e)
      }
    }
    await fetch(`${baseUrl}/api/publish-post`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        postId: p.id,
        sessionId: p.session_id,
        pageId: p.page_id,
        title: p.title,
        comment: p.content,
        imageBase64: imgBase64,
      }),
    })
  }

  for (const p of pending) {
    let imgBase64 =
      p.image_base64 && p.image_base64.startsWith("data:image/")
        ? p.image_base64
        : await getImageBase64(p)
    if (imgBase64 && imgBase64.startsWith("data:image/") && !(p.image_base64 && p.image_base64.startsWith("data:image/"))) {
      try {
        await prisma.post.update({
          where: { id: p.id },
          data: { image_base64: imgBase64 },
        })
      } catch (e) {
        console.error("Error guardando image_base64 para post", p.id, e)
      }
    }
    await fetch(`${baseUrl}/api/publish-post`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        postId: p.id,
        sessionId: p.session_id,
        pageId: p.page_id,
        title: p.title,
        comment: p.content,
        imageBase64: imgBase64,
      }),
    })
  }

  return NextResponse.json({
    ok: true,
    due: due.length,
    pending: pending.length,
    scheduled_total: scheduledTotal,
    scheduled_due: due.length,
    scheduled_future: scheduledFuture,
    mensaje: `Procesados ${due.length} programados vencidos y ${pending.length} pendientes. Total programadas: ${scheduledTotal} (${scheduledFuture} futuras, ${due.length} vencidas).`,
  })
}
