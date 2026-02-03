import { NextResponse } from "next/server"
export const runtime = "nodejs"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
    try {
        const { postId } = await request.json()

        if (!postId) {
            return NextResponse.json({ status: "error", mensaje: "ID de post requerido" }, { status: 400 })
        }

        await prisma.post.delete({
            where: { id: postId }
        })

        return NextResponse.json({ status: "ok", mensaje: "Post eliminado" })
    } catch (err: any) {
        return NextResponse.json({ status: "error", mensaje: err.message || "Error al eliminar" }, { status: 500 })
    }
}
