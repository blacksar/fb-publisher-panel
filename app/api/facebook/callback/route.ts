import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { requireAuth, getEffectiveUserId } from "@/lib/auth"

export const runtime = "nodejs"

function getRedirectUri(request: Request, fromSettings: string | null): string {
  if (fromSettings?.trim()) return fromSettings.trim()
  try {
    const u = new URL(request.url)
    return `${u.origin}/api/facebook/callback`
  } catch {
    const base = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || ""
    return `${base.replace(/\/+$/, "")}/api/facebook/callback`
  }
}

export async function GET(request: Request) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const effectiveUserId = getEffectiveUserId(authResult)

  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  const cookieStore = await cookies()
  const savedState = cookieStore.get("fb_oauth_state")?.value
  cookieStore.delete("fb_oauth_state")

  if (!savedState || state !== savedState) {
    return NextResponse.redirect(new URL("/dashboard/pages?error=invalid_state", request.url))
  }

  if (error || !code) {
    const msg = error === "access_denied" ? "access_denied" : error || "no_code"
    return NextResponse.redirect(new URL(`/dashboard/pages?error=${encodeURIComponent(msg)}`, request.url))
  }

  const keys = ["fb_api_url", "fb_app_id", "fb_app_secret", "fb_redirect_uri"] as const
  const settings = await prisma.setting.findMany({
    where: {
      key: { in: [...keys] },
      OR: [{ userId: effectiveUserId }, { userId: null }],
    },
  })
  const getSetting = (k: (typeof keys)[number]) =>
    settings.find((s) => s.key === k && s.userId === effectiveUserId)?.value ??
    settings.find((s) => s.key === k && s.userId === null)?.value ??
    ""

  const base = getSetting("fb_api_url")?.trim().replace(/\/+$/, "")
  if (!base) {
    return NextResponse.redirect(new URL("/dashboard/pages?error=no_api_url", request.url))
  }

  const redirectUri = getRedirectUri(request, getSetting("fb_redirect_uri"))
  const appId = getSetting("fb_app_id") || process.env.FB_APP_ID
  const appSecret = getSetting("fb_app_secret") || process.env.FB_APP_SECRET

  const body: Record<string, string> = { code, redirect_uri: redirectUri }
  if (appId) body.app_id = appId
  if (appSecret) body.app_secret = appSecret

  let data: {
    user_token?: string
    fb_user_id?: string
    fb_user_name?: string
    pages?: Array<{ id: string; name: string; access_token: string }>
  }

  try {
    const res = await fetch(`${base}/facebook/oauth/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    })
    if (!res.ok) {
      const text = await res.text()
      console.error("[facebook/callback] API externa error:", res.status, text)
      return NextResponse.redirect(
        new URL("/dashboard/pages?error=api_error", request.url)
      )
    }
    data = await res.json()
  } catch (e) {
    console.error("[facebook/callback] fetch error:", e)
    return NextResponse.redirect(
      new URL("/dashboard/pages?error=network", request.url)
    )
  }

  const userToken = data?.user_token
  const fbUserId = data?.fb_user_id ?? ""
  const fbUserName = data?.fb_user_name ?? "Facebook (API)"
  const pages = Array.isArray(data?.pages) ? data.pages : []

  const sessionName = fbUserName ? `Facebook (API) - ${fbUserName}` : "Facebook (API)"

  const session = await prisma.fBSession.create({
    data: {
      name: sessionName,
      cookie: "",
      status: "verified",
      verified_at: new Date(),
      userId: effectiveUserId,
      source: "oauth",
      oauth_access_token: userToken ?? null,
      oauth_fb_user_id: fbUserId || null,
    },
  })

  for (const p of pages) {
    const pageId = String(p?.id ?? "").trim()
    const name = String(p?.name ?? "Sin nombre").trim()
    const accessToken = typeof p?.access_token === "string" ? p.access_token : ""
    if (!pageId) continue
    await prisma.fBPage.upsert({
      where: { id: pageId },
      create: {
        id: pageId,
        name,
        session_id: session.id,
        page_access_token: accessToken || null,
      },
      update: {
        name,
        session_id: session.id,
        page_access_token: accessToken || null,
      },
    })
  }

  return NextResponse.redirect(new URL("/dashboard/pages?connected=1", request.url))
}
