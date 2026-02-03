import { prisma } from "@/lib/prisma"
import { promises as fs } from "fs"
import path from "path"
import crypto from "crypto"

// Helper: Guardar preview localmente (para cuando se recibe base64 desde frontend)
async function savePreview(base64Data: string): Promise<string> {
    // Parsing manual para evitar Stack Overflow con regex
    const commaIndex = base64Data.indexOf(',')
    if (commaIndex === -1) throw new Error("Formato de imagen inválido (sin coma)")

    const header = base64Data.substring(0, commaIndex)
    const base64Content = base64Data.substring(commaIndex + 1)

    // Detectar extensión
    const mimeMatch = header.match(/data:(.+);/)
    const mime = mimeMatch ? mimeMatch[1] : 'image/png'
    const ext = mime.split("/")[1] || "png"

    const buffer = Buffer.from(base64Content, "base64")
    const uploadsDir = path.join(process.cwd(), "public", "uploads")
    await fs.mkdir(uploadsDir, { recursive: true })

    const filename = `${crypto.randomBytes(16).toString("hex")}.${ext}`
    await fs.writeFile(path.join(uploadsDir, filename), buffer)

    return `/uploads/${filename}`
}

// Helper: Convertir ruta local (/uploads/...) a Base64 real para enviar a FB
async function getRealBase64(imagePathOrBase64: string): Promise<string> {
    if (imagePathOrBase64.startsWith('/uploads/')) {
        try {
            const relativePath = imagePathOrBase64.startsWith('/') ? imagePathOrBase64.slice(1) : imagePathOrBase64
            const fullPath = path.join(process.cwd(), "public", relativePath)
            const fileBuffer = await fs.readFile(fullPath)
            const ext = path.extname(fullPath).slice(1) || 'png'
            return `data:image/${ext};base64,${fileBuffer.toString('base64')}`
        } catch (e) {
            console.error("Error leyendo imagen local:", e)
            return imagePathOrBase64 // Fallback
        }
    }
    return imagePathOrBase64
}

// 1. Verificar Sesión en Vivo
export async function verifySessionLive(cookies: string): Promise<boolean> {
    try {
        const apiSetting = await prisma.setting.findUnique({ where: { key: "fb_api_url" } })
        const base = apiSetting?.value?.trim().replace(/\/+$/, "")
        if (!base) return false
        const url = `${base}/get_session/`

        let cookiesList
        try { cookiesList = JSON.parse(cookies) } catch { return false }

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cookies: cookiesList }),
            cache: "no-store"
        })
        const data = await res.json()
        return data.status_code === 200
    } catch (e) {
        console.error("Error verificando sesión live:", e)
        return false // Asumir invalida si falla conexión
    }
}

// 2. Publicar en Facebook (Lógica compartida)
export async function publishToFacebook(
    postData: { title: string, content: string, imageBase64?: string, pageId: string },
    session: { id: number, cookie: string }
): Promise<{ success: boolean, fb_post_id?: string, error?: string, errorCode?: string, errorLog?: any }> {

    // Preparar imagen
    let realBase64 = postData.imageBase64
    if (realBase64) {
        realBase64 = await getRealBase64(realBase64)
    }

    try {
        let cookies
        try { cookies = JSON.parse(session.cookie) } catch { return { success: false, error: "Cookie corrupta" } }

        const apiSetting = await prisma.setting.findUnique({ where: { key: "fb_api_url" } })
        const base = apiSetting?.value?.trim().replace(/\/+$/, "")
        if (!base) return { success: false, error: "Configura la URL de la API en Ajustes primero" }
        const url = `${base}/publish/`

        const fbRes = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id: postData.pageId,
                cookies,
                title: postData.title,
                comment: postData.content,
                image_base64: realBase64
            }),
        })

        const contentType = fbRes.headers.get("content-type") || ""
        let fbData: any = contentType.includes("application/json") ? await fbRes.json() : { status: "error", resultado: { status_code: 500, mensaje: await fbRes.text() } }

        const success = (fbData.status === "ok" && fbData.resultado?.status_code === 200) || (fbData.status_code === 200 && !fbData.error)

        if (!success) {
            const statusCode = fbData.resultado?.status_code || fbData.status_code
            let errorMsg = fbData.resultado?.mensaje || fbData.mensaje || fbData.message || fbData.error || "Error desconocido"

            // Soporte para errores de validación (FastAPI/Pydantic)
            if (Array.isArray(fbData.detail)) {
                errorMsg = fbData.detail.map((d: any) => `${d.msg} (${d.loc?.join('.')})`).join(', ')
            } else if (typeof fbData.detail === 'string') {
                errorMsg = fbData.detail
            }

            // Check auth error
            if (statusCode === 400 || statusCode === 401) {
                return {
                    success: false,
                    error: errorMsg,
                    errorCode: "SESSION_EXPIRED",
                    errorLog: fbData // Capture full log
                }
            }
            return {
                success: false,
                error: errorMsg,
                errorLog: fbData // Capture full log
            }
        }

        const fbPostId = fbData.resultado?.data?.post_id || fbData.resultado?.post_id || null
        return { success: true, fb_post_id: fbPostId }

    } catch (e: any) {
        return { success: false, error: e.message || "Error de conexión" }
    }
}

export { savePreview } // Exportar también savePreview si se necesita en endpoint
