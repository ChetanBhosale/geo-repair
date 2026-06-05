import { promises as fs } from "node:fs"
import path from "node:path"
import { getTwin } from "../lib/markdown-twin"
import { MARKDOWN_TWIN_PATHS } from "../lib/twin-paths"

async function main() {
  console.log("Generating static markdown twins in public/...")
  const publicDir = path.join(process.cwd(), "public")

  for (const rawPath of MARKDOWN_TWIN_PATHS) {
    const mdContent = await getTwin(rawPath)
    if (!mdContent) {
      console.warn(`WARNING: Failed to generate twin for path: ${rawPath}`)
      continue
    }

    // Determine target file name in public/
    // e.g. "/" -> "index.md"
    // e.g. "/pricing" -> "pricing.md"
    // e.g. "/blog/free-geo-tools-2026" -> "blog/free-geo-tools-2026.md"
    const targetSubPath = rawPath === "/" ? "index.md" : `${rawPath.replace(/^\//, "")}.md`
    const targetFilePath = path.join(publicDir, targetSubPath)

    // Ensure parent directories exist
    await fs.mkdir(path.dirname(targetFilePath), { recursive: true })
    await fs.writeFile(targetFilePath, mdContent, "utf8")
    console.log(`Generated: ${targetSubPath}`)
  }
  console.log("Done generating all static markdown twins!")
}

main().catch((err) => {
  console.error("Error generating static markdown twins:", err)
  process.exit(1)
})
