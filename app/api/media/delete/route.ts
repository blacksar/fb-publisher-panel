import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

export const runtime = "nodejs"

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get("path")

    if (!filePath || !filePath.startsWith("/uploads/")) {
      return NextResponse.json(
        { status: "error", mensaje: "Ruta inválida" },
        { status: 400 }
      )
    }

    const filename = path.basename(filePath)
    if (!/^[a-f0-9]{32}\.(jpg|jpeg|png|gif|webp)$/i.test(filename)) {
      return NextResponse.json(
        { status: "error", mensaje: "Nombre de archivo no permitido" },
        { status: 400 }
      )
    }

    const fullPath = path.join(process.cwd(), "public", "uploads", filename)

    await fs.unlink(fullPath)
    return NextResponse.json({ status: "ok", mensaje: "Archivo eliminado" })
  } catch (err: any) {
    if (err.code === "ENOENT") {
      return NextResponse.json(
        { status: "error", mensaje: "Archivo no encontrado" },
        { status: 404 }
      )
    }
    console.error("Error eliminando medio:", err)
    return NextResponse.json(
      { status: "error", mensaje: err.message || "Error al eliminar" },
      { status: 500 }
    )
  }
}
