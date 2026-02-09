import { promises as fs } from "fs"
import path from "path"
// We intentionally avoid NextResponse to bypass Buffer typing issues

// Ensure this route runs on the Node.js runtime so we can access the filesystem
export const runtime = "nodejs"

// Map common image extensions to MIME types
const mimeTypes: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
}

export async function GET(
  _req: Request,
  { params }: { params: { slug: string[] } }
) {
  // Build absolute path to the requested file inside /public/uploads
  const filePath = path.join(process.cwd(), "public", "uploads", ...params.slug)

  try {
    const data = await fs.readFile(filePath)
    const uint8 = new Uint8Array(data)
    const ext = path.extname(filePath).replace(".", "").toLowerCase()
    const contentType = mimeTypes[ext] || "application/octet-stream"
    return new Response(uint8, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch {
    return new Response("File not found", { status: 404 })
  }
} 