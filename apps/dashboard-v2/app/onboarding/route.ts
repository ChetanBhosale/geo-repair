import { NextResponse } from "next/server"

export function GET(request: Request) {
  const current = new URL(request.url)
  const target = new URL("/dashboard/projects", current.origin)
  const website = current.searchParams.get("website")

  if (website) {
    target.searchParams.set("website", website)
  }

  return NextResponse.redirect(target)
}
