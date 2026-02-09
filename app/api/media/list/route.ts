import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { requireAuth } from "@/lib/auth"

export const runtime = "nodejs"

const DEFAULT_LIMIT = 24
const MAX_LIMIT = 100

export async function GET(request: Request) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT))
    const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0)
    const q = (searchParams.get("q") ?? "").trim().toLowerCase()

    const uploadsDir = path.join(process.cwd(), "public", "uploads")
    await fs.mkdir(uploadsDir, { recursive: true })

    const files = await fs.readdir(uploadsDir)
    const allItems: { name: string; path: string; size: number; mtime: string }[] = []

    for (const file of files) {
      const filePath = path.join(uploadsDir, file)
      const stat = await fs.stat(filePath)
      if (stat.isFile()) {
        allItems.push({
          name: file,
          path: `/uploads/${file}`,
          size: stat.size,
          mtime: stat.mtime.toISOString(),
        })
      }
    }

    allItems.sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime())

    const filtered = q
      ? allItems.filter((item) => item.name.toLowerCase().includes(q))
      : allItems
    const total = filtered.length
    const items = filtered.slice(offset, offset + limit)

    return NextResponse.json({ status: "ok", items, total })
  } catch (err: any) {
    console.error("Error listando medios:", err)
    return NextResponse.json(
      { status: "error", mensaje: err.message || "Error al listar medios" },
      { status: 500 }
    )
  }
}
