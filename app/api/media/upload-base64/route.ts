import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import crypto from "crypto"
import { requireAuth } from "@/lib/auth"

export const runtime = "nodejs"

const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(request: Request) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await request.json()
    let imageBase64 = body?.imageBase64 ?? body?.image ?? body?.base64

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json(
        { status: "error", mensaje: "Falta el campo imageBase64 (imagen en base64)" },
        { status: 400 }
      )
    }

    imageBase64 = imageBase64.trim()

    let base64Content: string
    let mime = "image/png"

    if (imageBase64.startsWith("data:image/")) {
      const commaIndex = imageBase64.indexOf(",")
      if (commaIndex === -1) {
        return NextResponse.json(
          { status: "error", mensaje: "Formato de imagen inválido (data URL sin datos)" },
          { status: 400 }
        )
      }
      const header = imageBase64.substring(0, commaIndex)
      base64Content = imageBase64.substring(commaIndex + 1)
      const mimeMatch = header.match(/data:(.+);/)
      if (mimeMatch) mime = mimeMatch[1].trim().toLowerCase()
    } else {
      base64Content = imageBase64
    }

    if (!ALLOWED_MIMES.includes(mime)) {
      return NextResponse.json(
        { status: "error", mensaje: `Tipo de imagen no permitido. Permitidos: ${ALLOWED_MIMES.join(", ")}` },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(base64Content, "base64")
    if (buffer.length > MAX_SIZE) {
      return NextResponse.json(
        { status: "error", mensaje: "La imagen excede el tamaño máximo (10 MB)" },
        { status: 400 }
      )
    }

    const ext = mime.split("/")[1] || "png"
    const safeExt = ["jpeg", "jpg", "png", "gif", "webp"].includes(ext) ? (ext === "jpg" ? "jpeg" : ext) : "png"
    const filename = `${crypto.randomBytes(16).toString("hex")}.${safeExt === "jpeg" ? "jpg" : safeExt}`

    const uploadsDir = path.join(process.cwd(), "public", "uploads")
    await fs.mkdir(uploadsDir, { recursive: true })
    const filePath = path.join(uploadsDir, filename)
    await fs.writeFile(filePath, buffer)

    const pathUrl = `/uploads/${filename}`

    return NextResponse.json({
      status: "ok",
      path: pathUrl,
      name: filename,
    })
  } catch (err: unknown) {
    console.error("Error guardando imagen base64:", err)
    return NextResponse.json(
      { status: "error", mensaje: err instanceof Error ? err.message : "Error al guardar la imagen" },
      { status: 500 }
    )
  }
}
