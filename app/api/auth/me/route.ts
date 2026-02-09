import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"

export async function GET(request: Request) {
  const result = await requireAuth(request)
  if (result instanceof NextResponse) return result
  const { user, impersonationUserId } = result
  return NextResponse.json({
    status: "ok",
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    impersonationUserId: impersonationUserId ?? null,
  })
}
