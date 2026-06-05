import { NextResponse } from "next/server"

import { proxyBackendJson } from "../../../backend"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ workflowId: string }> | { workflowId: string }
}

export async function GET(request: Request, context: RouteContext) {
  const { workflowId } = await context.params

  if (!workflowId) {
    return NextResponse.json({ error: "workflowId is required." }, { status: 400 })
  }

  return proxyBackendJson(
    request,
    `/api/checkups/${encodeURIComponent(workflowId)}/status`
  )
}
