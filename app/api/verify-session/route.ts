import { NextResponse } from "next/server"
export const runtime = "nodejs"
import { prisma } from "@/lib/prisma"
import { requireAuth, getEffectiveUserId } from "@/lib/auth"

export async function POST(request: Request) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const effectiveUserId = getEffectiveUserId(authResult)

  try {
    const { cookies } = await request.json()

    const apiSetting = await prisma.setting.findFirst({
      where: {
        key: "fb_api_url",
        OR: [{ userId: effectiveUserId }, { userId: null }],
      },
      orderBy: { userId: "desc" },
    })
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