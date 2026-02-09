import { readFileSync } from "fs"
import { promises as fs } from "fs"
import path from "path"

function loadEnv() {
  if (process.env.DATABASE_URL && process.env.CRON_SECRET) return
  try {
    const envPath = path.join(process.cwd(), ".env")
    const content = readFileSync(envPath, "utf8")
    for (const line of content.split("\n")) {
      const m = line.match(/^\s*([^#=]+)=(.*)$/)
      if (m) {
        const key = m[1].trim()
        const val = m[2].replace(/^["']|["']$/g, "").trim()
        if (!process.env[key]) process.env[key] = val
      }
    }
  } catch (_) {}
}
loadEnv()

import { prisma } from "../src/lib/prisma.ts"

// Node 18+ tiene fetch nativo; evitar node-fetch en ESM para que no falle en Coolify
if (typeof globalThis.fetch !== "function") {
  console.error("Cron requiere Node 18+ (fetch nativo). Actual:", process.version)
  process.exit(1)
}
const fetchFn = globalThis.fetch

async function previewToBase64(urlPath: string): Promise<string> {
  // urlPath is like "/uploads/filename.png"
  const relative = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath
  const filePath = path.join(process.cwd(), "public", relative)
  const buffer = await fs.readFile(filePath)
  const ext = path.extname(filePath).slice(1) || "png"
  const mime = `image/${ext}`
  return `data:${mime};base64,${buffer.toString("base64")}`
}

/** Descarga imagen desde URL remota (ej. Coolify) y devuelve data URL base64. */
async function fetchRemoteImageToBase64(imageUrl: string): Promise<string> {
  const res = await fetchFn(imageUrl, { cache: "no-store" })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  const contentType = res.headers.get("content-type") || "image/png"
  const mime = contentType.split(";")[0].trim()
  return `data:${mime};base64,${buffer.toString("base64")}`
}

async function getImageBase64(
  p: { id: number; image_url?: string | null },
  baseUrl: string
) {
  if (!p.image_url) return undefined
  if (p.image_url.startsWith("data:image/")) return p.image_url
  if (p.image_url.startsWith("http://") || p.image_url.startsWith("https://")) {
    try {
      return await fetchRemoteImageToBase64(p.image_url)
    } catch (err) {
      console.error("Error descargando imagen remota para post", p.id, err)
      return undefined
    }
  }
  if (p.image_url.startsWith("/uploads/")) {
    // Intentar por HTTP primero (cron en otro contenedor no tiene disco compartido)
    const fullUrl = `${baseUrl.replace(/\/+$/, "")}${p.image_url}`
    try {
      return await fetchRemoteImageToBase64(fullUrl)
    } catch (err) {
      try {
        return await previewToBase64(p.image_url)
      } catch (err2) {
        console.error("Error leyendo imagen para post", p.id, err2)
        return undefined
      }
    }
  }
  return undefined
}

async function run() {
  const baseUrl = process.env.CRON_BASE_URL || "http://localhost:3000"
  const cronSecret = process.env.CRON_SECRET
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (cronSecret) headers["X-Cron-Secret"] = cronSecret

  // 1. Programados vencidos (preferir image_base64 de la DB; fallback a disco/HTTP)
  const now = new Date()
  const due = await prisma.post.findMany({
    where: { status: "scheduled", scheduled_at: { lte: now }, deleted_at: null },
  })
  for (const p of due) {
    let imgBase64 =
      p.image_base64 && p.image_base64.startsWith("data:image/")
        ? p.image_base64
        : await getImageBase64(p, baseUrl)
    // Backfill: publicaciones programadas antiguas sin image_base64 — guardar ahora para próximas veces
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
    await fetchFn(`${baseUrl}/api/publish-post`, {
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

  // 2. Pendientes (preferir image_base64 de la DB)
  const pending = await prisma.post.findMany({
    where: { status: "pending", deleted_at: null },
  })
  for (const p of pending) {
    let imgBase64 =
      p.image_base64 && p.image_base64.startsWith("data:image/")
        ? p.image_base64
        : await getImageBase64(p, baseUrl)
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
    await fetchFn(`${baseUrl}/api/publish-post`, {
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

  await prisma.$disconnect()
}

run().catch((e) => {
  const err = e instanceof Error ? e : new Error(String(e))
  console.error("Cron error:", err.message)
  if (e instanceof Error && e.stack) console.error(e.stack)
  process.exit(1)
}) 