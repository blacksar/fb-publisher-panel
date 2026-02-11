import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import crypto from "crypto"
import { requireAuth, getEffectiveUserId } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

const FB_OAUTH_SCOPE =
  "pages_show_list,pages_manage_metadata,pages_manage_posts,pages_read_engagement,public_profile"

export async function GET(request: Request) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const effectiveUserId = getEffectiveUserId(authResult)

  const keys = ["fb_app_id", "fb_redirect_uri"] as const
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

  const appId = getSetting("fb_app_id") || process.env.FB_APP_ID
  let redirectUri = getSetting("fb_redirect_uri")
  if (!redirectUri) {
    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || ""
    redirectUri = `${appUrl.replace(/\/+$/, "")}/api/facebook/callback`
  }
  redirectUri = redirectUri.trim()

  if (!appId) {
    return NextResponse.json(
      { error: "Configura App ID de Facebook en Ajustes" },
      { status: 400 }
    )
  }

  const state = crypto.randomBytes(32).toString("hex")
  const cookieStore = await cookies()
  cookieStore.set("fb_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10, // 10 min
  })

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    scope: FB_OAUTH_SCOPE,
  })
  const fbUrl = `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`
  return NextResponse.redirect(fbUrl)
}
