import { NextResponse } from "next/server"

import { proxyBackendJson } from "../../backend"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ key: string }> | { key: string }
}

export async function GET(request: Request, context: RouteContext) {
  const { key } = await context.params

  if (!key) {
    return NextResponse.json({ error: "key is required." }, { status: 400 })
  }

  return proxyBackendJson(
    request,
    `/api/checkup-reports/${encodeURIComponent(key)}`
  )
}
