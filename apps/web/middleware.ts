import { NextResponse, type NextRequest } from "next/server"

// Markdown "twins": a request for `<path>.md` is rewritten to the twin route
// handler, which serves a faithful Markdown copy of the page (see RUBRIC.md →
// `markdown-twins` and lib/markdown-twin.ts). The HTML page stays at `<path>`;
// only the `.md` suffix is intercepted. Home's twin lives at `/index.md`.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (!pathname.endsWith(".md")) return NextResponse.next()

  // Encode the page path in the rewritten pathname (not a query param, which
  // isn't reliably forwarded through a rewrite) and let the catch-all twin
  // route read it from its slug. "/pricing.md" -> "/api/twin/pricing".
  const page = pathname.slice(0, -".md".length)
  const url = req.nextUrl.clone()
  url.pathname = `/api/twin${page}`
  return NextResponse.rewrite(url)
}

export const config = {
  // Only run on `.md` requests, and never on framework/proxy internals.
  matcher: ["/((?!_next|api|ingest).*\\.md)"],
}
