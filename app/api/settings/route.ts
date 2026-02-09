import { NextResponse } from "next/server"
export const runtime = "nodejs"
import { prisma } from "@/lib/prisma"
import { requireAuth, getEffectiveUserId } from "@/lib/auth"

export async function GET(request: Request) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const effectiveUserId = getEffectiveUserId(authResult)

  try {
    const apiSetting = await prisma.setting.findFirst({
      where: {
        key: "fb_api_url",
        OR: [{ userId: effectiveUserId }, { userId: null }],
      },
      orderBy: { userId: "desc" },
    })
    return NextResponse.json({
      fb_api_url: apiSetting?.value || "",
    })
  } catch (error) {
    return NextResponse.json({ error: "Error fetching settings" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const effectiveUserId = getEffectiveUserId(authResult)

  try {
    const { fb_api_url } = await request.json()
    if (fb_api_url) {
      await prisma.setting.upsert({
        where: {
          userId_key: { userId: effectiveUserId, key: "fb_api_url" },
        },
        update: { value: fb_api_url },
        create: { userId: effectiveUserId, key: "fb_api_url", value: fb_api_url },
      })
    }
    return NextResponse.json({ status: "ok" })
  } catch (error) {
    return NextResponse.json({ error: "Error saving settings" }, { status: 500 })
  }
}
