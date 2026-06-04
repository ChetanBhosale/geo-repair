import { NextResponse } from "next/server"

import { proxyBackendJson } from "../../backend"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  let body: { orderId?: unknown }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  if (typeof body.orderId !== "string" || !body.orderId.trim()) {
    return NextResponse.json({ error: "orderId is required." }, { status: 400 })
  }

  return proxyBackendJson(request, "/api/billing/fix-checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: body.orderId.trim() }),
  })
}
