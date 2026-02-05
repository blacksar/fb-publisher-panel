import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

export const runtime = "nodejs"

export async function GET() {
  try {
    const uploadsDir = path.join(process.cwd(), "public", "uploads")
    await fs.mkdir(uploadsDir, { recursive: true })

    const files = await fs.readdir(uploadsDir)
    const items: { name: string; path: string; size: number; mtime: string }[] = []

    for (const file of files) {
      const filePath = path.join(uploadsDir, file)
      const stat = await fs.stat(filePath)
      if (stat.isFile()) {
        items.push({
          name: file,
          path: `/uploads/${file}`,
          size: stat.size,
          mtime: stat.mtime.toISOString(),
        })
      }
    }

    items.sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime())
    return NextResponse.json({ status: "ok", items })
  } catch (err: any) {
    console.error("Error listando medios:", err)
    return NextResponse.json(
      { status: "error", mensaje: err.message || "Error al listar medios" },
      { status: 500 }
    )
  }
}
