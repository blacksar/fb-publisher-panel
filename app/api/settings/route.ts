import { NextResponse } from "next/server"
export const runtime = "nodejs"
import { prisma } from "@/lib/prisma"
import { requireAuth, getEffectiveUserId } from "@/lib/auth"

export async function GET(request: Request) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const effectiveUserId = getEffectiveUserId(authResult)

  try {
    const keys = ["fb_api_url", "fb_app_id", "fb_app_secret", "fb_redirect_uri"] as const
    const settings = await prisma.setting.findMany({
      where: {
        key: { in: [...keys] },
        OR: [{ userId: effectiveUserId }, { userId: null }],
      },
    })
    const byKey: Record<(typeof keys)[number], string> = {
      fb_api_url: "",
      fb_app_id: "",
      fb_app_secret: "",
      fb_redirect_uri: "",
    }
    for (const k of keys) {
      const userRow = settings.find((s) => s.key === k && s.userId === effectiveUserId)
      const globalRow = settings.find((s) => s.key === k && s.userId === null)
      byKey[k] = (userRow ?? globalRow)?.value ?? ""
    }
    return NextResponse.json(byKey)
  } catch (error) {
    return NextResponse.json({ error: "Error fetching settings" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const effectiveUserId = getEffectiveUserId(authResult)

  try {
    const body = await request.json()
    const keys = ["fb_api_url", "fb_app_id", "fb_app_secret", "fb_redirect_uri"] as const
    for (const key of keys) {
      const value = body[key]
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        await prisma.setting.upsert({
          where: { userId_key: { userId: effectiveUserId, key } },
          update: { value: String(value).trim() },
          create: { userId: effectiveUserId, key, value: String(value).trim() },
        })
      }
    }
    return NextResponse.json({ status: "ok" })
  } catch (error) {
    return NextResponse.json({ error: "Error saving settings" }, { status: 500 })
  }
}
