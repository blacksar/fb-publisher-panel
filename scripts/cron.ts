import { prisma } from "../src/lib/prisma.ts"
// @ts-ignore
const { default: fetch } = await import("node-fetch")
import { promises as fs } from "fs"
import path from "path"

async function previewToBase64(urlPath: string): Promise<string> {
  // urlPath is like "/uploads/filename.png"
  const relative = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath
  const filePath = path.join(process.cwd(), "public", relative)
  const buffer = await fs.readFile(filePath)
  const ext = path.extname(filePath).slice(1) || "png"
  const mime = `image/${ext}`
  return `data:${mime};base64,${buffer.toString("base64")}`
}

async function run() {
  const now = new Date()
  const due = await prisma.post.findMany({
    where: { status: "scheduled", scheduled_at: { lte: now } },
  })
  for (const p of due) {
    let imgBase64: string | undefined = undefined
    if (p.image_url) {
      if (p.image_url.startsWith("/uploads/")) {
        try {
          imgBase64 = await previewToBase64(p.image_url)
        } catch (err) {
          console.error("Error leyendo imagen para post", p.id, err)
        }
      } else if (p.image_url.startsWith("data:image/")) {
        imgBase64 = p.image_url
      }
    }
    await fetch("http://localhost:3000/api/publish-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postId: p.id,
        sessionId: p.session_id,
        pageId: p.page_id,
        title: p.title,
        comment: p.content,
        imageBase64: imgBase64,
      }),
    })
  }
  await prisma.$disconnect()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
}) 