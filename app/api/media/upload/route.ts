import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import crypto from "crypto"

export const runtime = "nodejs"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const files = formData.getAll("file") as File[]

    if (!files.length) {
      return NextResponse.json(
        { status: "error", mensaje: "No se recibieron archivos" },
        { status: 400 }
      )
    }

    const uploadsDir = path.join(process.cwd(), "public", "uploads")
    await fs.mkdir(uploadsDir, { recursive: true })

    const uploaded: { name: string; path: string; size: number }[] = []

    for (const file of files) {
      if (!file || typeof file === "string") continue
      if (file.size > MAX_SIZE) {
        return NextResponse.json(
          { status: "error", mensaje: `Archivo ${file.name} excede 10 MB` },
          { status: 400 }
        )
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { status: "error", mensaje: `Tipo no permitido: ${file.name}` },
          { status: 400 }
        )
      }

      const ext = file.name.split(".").pop()?.toLowerCase() || "png"
      const safeExt = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext) ? ext : "png"
      const filename = `${crypto.randomBytes(16).toString("hex")}.${safeExt}`
      const filePath = path.join(uploadsDir, filename)

      const buffer = Buffer.from(await file.arrayBuffer())
      await fs.writeFile(filePath, buffer)

      uploaded.push({
        name: filename,
        path: `/uploads/${filename}`,
        size: file.size,
      })
    }

    return NextResponse.json({ status: "ok", uploaded })
  } catch (err: any) {
    console.error("Error subiendo medios:", err)
    return NextResponse.json(
      { status: "error", mensaje: err.message || "Error al subir" },
      { status: 500 }
    )
  }
}
