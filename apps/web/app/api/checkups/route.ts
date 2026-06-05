import { NextResponse } from "next/server"

import { proxyBackendJson } from "../backend"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  let body: { url?: unknown; singlePage?: unknown }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  if (typeof body.url !== "string" || body.url.trim().length === 0) {
    return NextResponse.json(
      { error: "A valid website URL is required." },
      { status: 400 }
    )
  }

  return proxyBackendJson(request, "/api/checkups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: body.url.trim(),
      singlePage: Boolean(body.singlePage),
    }),
  })
}
