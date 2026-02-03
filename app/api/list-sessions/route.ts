import { NextResponse } from "next/server"
export const runtime = "nodejs"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const sessions = await prisma.fBSession.findMany({ orderBy: { id: "desc" } })
    return NextResponse.json({ status: "ok", sessions })
  } catch (err: any) {
    return NextResponse.json({ status: "error", mensaje: err.message || "Error" }, { status: 500 })
  }
} 