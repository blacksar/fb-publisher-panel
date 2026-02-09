/**
 * Verifica en la base de datos los posts programados y cuáles ya deberían haberse publicado.
 * Uso: node scripts/check-scheduled-posts.mjs
 */
import { PrismaClient } from "@prisma/client"
import { readFileSync } from "fs"
import { join } from "path"

function loadEnv() {
  if (process.env.DATABASE_URL) return
  try {
    const envPath = join(process.cwd(), ".env")
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

const prisma = new PrismaClient()

async function main() {
  const now = new Date()

  const scheduled = await prisma.post.findMany({
    where: { status: "scheduled" },
    orderBy: { scheduled_at: "asc" },
    select: {
      id: true,
      title: true,
      scheduled_at: true,
      page_name: true,
      page_id: true,
      session_id: true,
      created_at: true,
    },
  })

  const due = scheduled.filter((p) => p.scheduled_at && p.scheduled_at <= now)
  const future = scheduled.filter((p) => p.scheduled_at && p.scheduled_at > now)

  console.log("--- Posts programados en la base de datos ---\n")
  console.log("Fecha/hora actual (servidor):", now.toISOString())
  console.log("Total con status 'scheduled':", scheduled.length)
  console.log("Vencidos (scheduled_at <= ahora):", due.length)
  console.log("En el futuro:", future.length)
  console.log("")

  if (due.length > 0) {
    console.log("⚠️  VENCIDOS (deberían haberse publicado ya):")
    for (const p of due) {
      console.log(
        `  - id=${p.id} | "${(p.title || "").slice(0, 40)}..." | programado: ${p.scheduled_at?.toISOString()} | página: ${p.page_name || p.page_id}`
      )
    }
    console.log("")
    console.log("Para publicarlos ahora:")
    console.log("  1. Ejecuta: npm run cron   (o llama a GET /api/cron con CRON_SECRET)")
    console.log("  2. O en el panel: Publicaciones → publicar manualmente cada uno.")
    console.log("")
  }

  if (future.length > 0) {
    console.log("Pendientes (aún en el futuro):")
    for (const p of future) {
      console.log(
        `  - id=${p.id} | "${(p.title || "").slice(0, 40)}..." | programado: ${p.scheduled_at?.toISOString()} | página: ${p.page_name || p.page_id}`
      )
    }
  }

  if (scheduled.length === 0) {
    console.log("No hay posts con status 'scheduled' en la base.")
  }

  const pending = await prisma.post.count({ where: { status: "pending" } })
  if (pending > 0) {
    console.log("")
    console.log(`ℹ️  Posts con status 'pending' (reintento automático): ${pending}`)
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
