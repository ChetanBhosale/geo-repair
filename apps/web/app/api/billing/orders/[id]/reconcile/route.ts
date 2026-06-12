import { NextResponse } from "next/server"
import { ReconcileFixCheckoutRequestSchema } from "@repo/types/billing"

import { proxyBackendJson } from "../../../../backend"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ id: string }> | { id: string }
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    )
  }

  const parsed = ReconcileFixCheckoutRequestSchema.safeParse({
    ...(body && typeof body === "object" ? body : {}),
    orderId: id,
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid reconcile request." },
      { status: 400 }
    )
  }

  return proxyBackendJson(
    request,
    `/api/billing/public/orders/${encodeURIComponent(id)}/reconcile`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    }
  )
}
