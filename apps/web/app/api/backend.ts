import { NextResponse } from "next/server"

const DEFAULT_BACKEND_URL = "http://localhost:4000"

function backendBaseUrl(): string {
  return (
    process.env.BACKEND_URL ??
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    DEFAULT_BACKEND_URL
  ).replace(/\/+$/, "")
}

function forwardedHeaders(request: Request, initHeaders?: HeadersInit): Headers {
  const headers = new Headers(initHeaders)

  for (const name of [
    "x-forwarded-for",
    "user-agent",
    "referer",
    "origin",
    "cookie",
  ]) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }

  return headers
}

export async function proxyBackendJson(
  request: Request,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const url = `${backendBaseUrl()}${path}`

  try {
    const response = await fetch(url, {
      ...init,
      headers: forwardedHeaders(request, init.headers),
      cache: "no-store",
    })
    const contentType = response.headers.get("content-type") ?? "application/json"
    const body = await response.text()

    return new Response(body || "{}", {
      status: response.status,
      headers: { "Content-Type": contentType },
    })
  } catch {
    return NextResponse.json(
      { error: "The checkup backend is unavailable. Please try again shortly." },
      { status: 502 }
    )
  }
}
