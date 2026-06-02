import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"

import { SITE } from "@/lib/seo"

export const alt = `${SITE.name} · ${SITE.tagline}`
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

async function bgDataUri() {
  const data = await readFile(
    join(process.cwd(), "public/images/features/abstract.jpg")
  )
  return `data:image/jpeg;base64,${data.toString("base64")}`
}

export default async function Image() {
  const bg = await bgDataUri()

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
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background:
              "linear-gradient(135deg, rgba(10,12,20,0.82), rgba(10,12,20,0.62))",
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
            {SITE.tagline}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div
              style={{
                display: "flex",
                fontSize: 78,
                fontWeight: 600,
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                maxWidth: "900px",
              }}
            >
              See your site the way AI search engines do.
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 30,
                color: "rgba(255,255,255,0.8)",
                maxWidth: "860px",
              }}
            >
              A free readiness checkup for ChatGPT, Perplexity, and Google AI
              Overviews, then a pull request that fixes it.
            </div>
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
            <div style={{ display: "flex", fontWeight: 600 }}>{SITE.name}</div>
            <div style={{ display: "flex", color: "rgba(255,255,255,0.75)" }}>
              23 checks · 7 categories · zero retention
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
