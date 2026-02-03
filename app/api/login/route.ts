import { NextResponse } from "next/server"
export const runtime = "nodejs"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, user, password, pass, timeout, tiempo_espera, wait_2fa_seconds } = body
    const userOrEmail = (email ?? user ?? "").toString().trim()
    const passwordVal = (password ?? pass ?? "").toString().trim()
    const waitTime = Number(wait_2fa_seconds ?? timeout ?? tiempo_espera ?? 120)

    if (!userOrEmail || !passwordVal) {
      return NextResponse.json(
        { status: "error", mensaje: "Usuario/email y contraseña son requeridos" },
        { status: 400 }
      )
    }

    const apiSetting = await prisma.setting.findUnique({ where: { key: "fb_api_url" } })
    const base = apiSetting?.value?.trim().replace(/\/+$/, "")
    if (!base) {
      return NextResponse.json(
        { status: "error", mensaje: "Configura la URL de la API en Ajustes primero" },
        { status: 400 }
      )
    }

    const url = `${base}/login/`

    processLoginInBackground(url, userOrEmail, passwordVal, waitTime).catch((err) =>
      console.error("[login] Error en background:", err)
    )

    return NextResponse.json(
      {
        status: "processing",
        mensaje: "Login en proceso. Completa la verificación 2FA en tu dispositivo. La lista se actualizará automáticamente.",
      },
      { status: 202 }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al iniciar sesión"
    return NextResponse.json({ status: "error", mensaje: message }, { status: 500 })
  }
}

async function processLoginInBackground(
  url: string,
  userOrEmail: string,
  passwordVal: string,
  waitTime: number
) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: userOrEmail,
      password: passwordVal,
      wait_2fa_seconds: waitTime,
    }),
    cache: "no-store",
  })

  const contentType = res.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) {
    console.error("[login] Respuesta no JSON del servicio externo")
    return
  }

  const data = await res.json()

  if (data.status === "error" || (data.status_code != null && data.status_code !== 200)) {
    console.error("[login] Error del servicio:", data.mensaje || data.message)
    return
  }

  const cookies = data.cookies ?? data.resultado?.cookies ?? data.resultado
  if (!cookies) {
    console.error("[login] El servicio no devolvió cookies")
    return
  }

  const cookieStr = typeof cookies === "string" ? cookies : JSON.stringify(cookies)
  const sessionData = data.session ?? {}
  const userName = sessionData.name ?? data.name ?? data.user_name ?? data.email ?? userOrEmail
  let cUser = sessionData.c_user ?? data.c_user
  if (!cUser && Array.isArray(cookies)) {
    const cUserCookie = cookies.find((c: { name?: string }) => c?.name === "c_user")
    cUser = cUserCookie?.value
  }

  await prisma.fBSession.create({
    data: {
      name: userName,
      cookie: cookieStr,
      status: "verified",
      verified_at: new Date(),
      c_user: cUser ?? null,
      user_name: userName,
    },
  })
}
