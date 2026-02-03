import { NextResponse } from "next/server"
export const runtime = "nodejs"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const cleanHeaders = new Headers(request.headers)
    cleanHeaders.delete("cookie")
    const { cookies } = await request.json()

    // Obtener URL de API desde configuración
    const apiSetting = await prisma.setting.findUnique({ where: { key: "fb_api_url" } })
    const base = apiSetting?.value?.trim().replace(/\/+$/, "")
    if (!base) {
      return NextResponse.json({ status_code: 400, mensaje: "Configura la URL de la API en Ajustes primero" }, { status: 400 })
    }
    const url = `${base}/get_session/`

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cookies }),
      cache: "no-store",
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ status_code: 500, mensaje: err.message || "Error" }, { status: 500 })
  }
} 