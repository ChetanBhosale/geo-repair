import { proxyBackendJson } from "../../../backend"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const body = await request.text()

  return proxyBackendJson(request, "/api/dev/billing/fixture-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body || "{}",
  })
}
