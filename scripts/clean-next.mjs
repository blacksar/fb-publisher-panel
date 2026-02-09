import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const nextDir = path.join(__dirname, "..", ".next")

if (fs.existsSync(nextDir)) {
  fs.rmSync(nextDir, { recursive: true })
  console.log(".next removed")
} else {
  console.log(".next not found (already clean)")
}
