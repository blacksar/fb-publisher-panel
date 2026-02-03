import { NextResponse } from "next/server"
export const runtime = "nodejs"
import { prisma } from "@/lib/prisma"

export async function GET() {
    try {
        const apiSetting = await prisma.setting.findUnique({ where: { key: "fb_api_url" } })
        return NextResponse.json({
            fb_api_url: apiSetting?.value || ""
        })
    } catch (error) {
        return NextResponse.json({ error: "Error fetching settings" }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const { fb_api_url } = await request.json()

        if (fb_api_url) {
            await prisma.setting.upsert({
                where: { key: "fb_api_url" },
                update: { value: fb_api_url },
                create: { key: "fb_api_url", value: fb_api_url }
            })
        }

        return NextResponse.json({ status: "ok" })
    } catch (error) {
        return NextResponse.json({ error: "Error saving settings" }, { status: 500 })
    }
}
