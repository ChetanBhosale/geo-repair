import { proxyBackendJson } from "../api/backend"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return proxyBackendJson(request, "/scan-website", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
  })
}
