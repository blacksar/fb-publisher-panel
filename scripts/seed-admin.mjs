/**
 * Crea el primer usuario ADMIN.
 * Uso: npm run seed-admin
 *      o ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/seed-admin.mjs
 * Requiere: migración add_user_auth aplicada y DATABASE_URL (en .env o entorno).
 */
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
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
  const email = process.env.ADMIN_EMAIL || "admin@example.com"
  const password = process.env.ADMIN_PASSWORD || "admin123"
  const forceUpdate = process.env.ADMIN_FORCE_UPDATE === "1" || process.env.ADMIN_FORCE_UPDATE === "true"
  const existing = await prisma.user.findUnique({ where: { email } })

  if (existing) {
    if (forceUpdate) {
      const passwordHash = await bcrypt.hash(password, 12)
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, name: "Administrador", role: "ADMIN" },
      })
      console.log("Usuario ADMIN actualizado:", email)
    } else {
      console.log("Usuario ya existe:", email)
    }
    process.exit(0)
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.user.create({
    data: {
      email,
      name: "Administrador",
      passwordHash,
      role: "ADMIN",
    },
  })
  console.log("Usuario ADMIN creado:", email)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
