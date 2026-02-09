import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { jwtVerify } from "jose"

const COOKIE_NAME = "panel_session"
const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || process.env.JWT_SECRET || "change-me-in-production-min-32-chars"
)

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isAuthRoute = pathname.startsWith("/api/auth/")
  const isLoginPage = pathname === "/login"
  const isDashboard = pathname.startsWith("/dashboard")
  const isAdmin = pathname.startsWith("/admin")
  const isRoot = pathname === "/"

  if (isAuthRoute) {
    return NextResponse.next()
  }

  const token = request.cookies.get(COOKIE_NAME)?.value

  // Raíz: sin sesión -> login; con sesión válida -> dashboard
  if (isRoot) {
    if (!token) return NextResponse.redirect(new URL("/login", request.url))
    try {
      await jwtVerify(token, SECRET)
      return NextResponse.redirect(new URL("/dashboard/posts", request.url))
    } catch {
      return NextResponse.redirect(new URL("/login", request.url))
    }
  }

  if (!token) {
    if (isLoginPage) return NextResponse.next()
    if (isDashboard || isAdmin) {
      const url = new URL("/login", request.url)
      url.searchParams.set("from", pathname)
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  try {
    const { payload } = await jwtVerify(token, SECRET)
    const role = payload.role as string
    if (isAdmin && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard/posts", request.url))
    }
    return NextResponse.next()
  } catch {
    if (isDashboard || isAdmin) {
      const url = new URL("/login", request.url)
      url.searchParams.set("from", pathname)
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/admin/:path*", "/login", "/api/auth/:path*"],
}
