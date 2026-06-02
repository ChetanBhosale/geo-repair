import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"

import { SITE } from "@/lib/seo"
import { getAllSlugs, getPostBySlug } from "@/lib/blog"

export const alt = `${SITE.name} Blog`
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }))
}

async function bgDataUri(thumbnail?: string) {
  if (!thumbnail) return null
  try {
    const data = await readFile(join(process.cwd(), "public", thumbnail))
    return `data:image/jpeg;base64,${data.toString("base64")}`
  } catch {
    return null
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  const title = post?.title ?? `${SITE.name} Blog`
  const tag = post?.tags[0] ?? "AI Search Optimization"
  const bg = await bgDataUri(post?.thumbnail)

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          height: "100%",
          width: "100%",
          display: "flex",
          fontFamily: "monospace",
        }}
      >
        {bg && (
          <img
            src={bg}
            alt=""
            width={1200}
            height={630}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background:
              "linear-gradient(180deg, rgba(10,12,20,0.78), rgba(10,12,20,0.66))",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: "72px",
            color: "#ffffff",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 26,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.75)",
            }}
          >
            {SITE.name} · Blog
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 70,
              fontWeight: 600,
              lineHeight: 1.08,
              letterSpacing: "-0.02em",
              maxWidth: "960px",
            }}
          >
            {title}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: "2px solid rgba(255,255,255,0.25)",
              paddingTop: "28px",
              fontSize: 26,
            }}
          >
            <div style={{ display: "flex", color: "rgba(255,255,255,0.75)" }}>
              {tag}
            </div>
            <div style={{ display: "flex", fontWeight: 600 }}>geo.repair</div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
