import { NextResponse } from "next/server"
export const runtime = "nodejs"
import { prisma } from "@/lib/prisma"
import { requireAuth, getEffectiveUserId } from "@/lib/auth"

export async function POST(request: Request) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const effectiveUserId = getEffectiveUserId(authResult)

  try {
    const body = await request.json()
    const { cookies, sessionId } = body || {}

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

    const sessionWhere = { userId: effectiveUserId }
    const oauthSession = sessionId
      ? await prisma.fBSession.findFirst({
          where: { id: sessionId, ...sessionWhere },
          select: { source: true, oauth_access_token: true },
        })
      : null

    if (oauthSession?.source === "oauth" && oauthSession?.oauth_access_token) {
      const res = await fetch(`${base}/facebook/verify_token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_access_token: oauthSession.oauth_access_token }),
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))
      const valid = data?.valid === true || res.ok
      return NextResponse.json({ status_code: valid ? 200 : 401, mensaje: valid ? "Token válido" : "Token inválido o expirado" })
    }

    const url = `${base}/get_session/`
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cookies: cookies ?? [] }),
      cache: "no-store",
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ status_code: 500, mensaje: err.message || "Error" }, { status: 500 })
  }
} 