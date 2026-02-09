
import { prisma } from "@/lib/prisma"

export async function invalidateSession(sessionId: number) {
    try {
        console.log(`[SessionGuard] Invalidando sesión ${sessionId} por error de auth`)
        await prisma.fBSession.update({
            where: { id: sessionId },
            data: { status: "inactive" }
        })
        return true
    } catch (error) {
        console.error(`[SessionGuard] Error al invalidar sesión ${sessionId}:`, error)
        return false
    }
}
