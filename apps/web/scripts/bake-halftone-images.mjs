import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import sharp from "sharp"

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicRoot = join(__dirname, "..", "public")

const IMAGES = [
  {
    input: "images/features/floral-silhouette.jpg",
    output: "images/features/floral-silhouette-halftone.jpg",
  },
  {
    input: "images/features/foggy-scene.jpg",
    output: "images/features/foggy-scene-halftone.jpg",
  },
]

const front = "#14463a"
const back = "#f2f1e8"
const size = 0.45
const contrast = 0.5
const maxEdge = 1200

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function sigmoid(value, k) {
  return 1 / (1 + Math.exp(-k * (value - 0.5)))
}

function lumAt(buffer, width, height, channels, x, y) {
  const px = clamp(Math.round(x), 0, width - 1)
  const py = clamp(Math.round(y), 0, height - 1)
  const index = (py * width + px) * channels
  const alpha = channels > 3 ? buffer[index + 3] / 255 : 1
  const k = 15 * Math.pow(contrast, 1.5)
  const r = sigmoid(buffer[index] / 255, k)
  const g = sigmoid(buffer[index + 1] / 255, k)
  const b = sigmoid(buffer[index + 2] / 255, k)
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b

  return 1 * (1 - alpha) + lum * alpha
}

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;")
}

async function bake({ input, output }) {
  const inputPath = join(publicRoot, input)
  const outputPath = join(publicRoot, output)
  const { data, info } = await sharp(inputPath)
    .resize({
      width: maxEdge,
      height: maxEdge,
      fit: "inside",
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  const cellsPerSide = 300 + (7 - 300) * Math.pow(size, 0.7)
  const pitch = height / cellsPerSide
  const rows = Math.ceil(height / pitch) + 2
  const cols = Math.ceil(width / pitch) + 2
  const circles = []

  for (let row = -1; row < rows; row += 1) {
    const y = (row + 0.5) * pitch
    const xOffset = row % 2 === 0 ? 0 : pitch * 0.5

    for (let col = -1; col < cols; col += 1) {
      const x = (col + 0.5) * pitch + xOffset
      const lum = lumAt(data, width, height, channels, x, y)
      const ink = Math.pow(clamp(1 - lum, 0, 1), 0.82)
      const radius = pitch * 0.58 * ink

      if (radius < 0.3) {
        continue
      }

      circles.push(
        `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(
          2
        )}" r="${radius.toFixed(2)}" />`
      )
    }
  }

  const blur = clamp(pitch * 0.06, 0.35, 0.9).toFixed(2)
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <filter id="goo" x="-5%" y="-5%" width="110%" height="110%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="${blur}" result="blur" />
      <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 16 -6" result="goo" />
      <feBlend in="SourceGraphic" in2="goo" />
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="${escapeXml(back)}" />
  <g fill="${escapeXml(front)}" filter="url(#goo)">
    ${circles.join("\n    ")}
  </g>
</svg>`

  await sharp(Buffer.from(svg))
    .jpeg({ quality: 72, mozjpeg: true })
    .toFile(outputPath)

  console.log(`Baked ${output}`)
}

for (const image of IMAGES) {
  await bake(image)
}
