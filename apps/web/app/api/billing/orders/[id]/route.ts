import { NextResponse } from "next/server"

import { proxyBackendJson } from "../../../backend"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params

  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 })
  }

  return proxyBackendJson(
    request,
    `/api/billing/public/orders/${encodeURIComponent(id)}`
  )
}
