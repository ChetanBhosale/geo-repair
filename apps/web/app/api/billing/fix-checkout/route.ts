import { NextResponse } from "next/server"
import { CreateFixCheckoutRequestSchema } from "@repo/types/billing"

import { proxyBackendJson } from "../../backend"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    )
  }

  const parsed = CreateFixCheckoutRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid checkout request." },
      { status: 400 }
    )
  }

  const orderId = parsed.data.orderId?.trim()
  const projectId = parsed.data.projectId?.trim()
  const repositoryId = parsed.data.repositoryId?.trim()
  const checkupReportKey = parsed.data.checkupReportKey?.trim()
  const selectedTier = parsed.data.selectedTier

  if (!orderId && !projectId && (!repositoryId || !checkupReportKey)) {
    return NextResponse.json(
      {
        error:
          "orderId, projectId, or repositoryId and checkupReportKey are required.",
      },
      { status: 400 }
    )
  }

  return proxyBackendJson(request, "/api/billing/fix-checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId,
      projectId,
      repositoryId,
      checkupReportKey,
      selectedTier,
    }),
  })
}
