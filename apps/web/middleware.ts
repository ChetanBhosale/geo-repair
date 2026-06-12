import { NextResponse, type NextRequest } from "next/server"
import { hasMarkdownTwin, markdownTwinPath } from "./lib/twin-paths"

const AI_BOTS = [
  "gptbot",
  "chatgpt-user",
  "claudebot",
  "anthropic-ai",
  "cohere-ai",
  "google-extended",
  "perplexitybot",
  "youbot",
  "applebot-extended",
  "facebookbot",
  "omgilibot",
  "diffbot",
  "bytespider",
  "imagesiftbot",
  "webz.io",
]

// Markdown "twins": a request for `<path>.md` is rewritten to the twin route
// handler, which serves a faithful Markdown copy of the page (see RUBRIC.md →
// `markdown-twins` and lib/markdown-twin.ts). The HTML page stays at `<path>`;
// only the `.md` suffix is intercepted. Home's twin lives at `/index.md`.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 1. Handle explicit `.md` requests
  if (pathname.endsWith(".md")) {
    const page = pathname.slice(0, -".md".length)
    const url = req.nextUrl.clone()
    url.pathname = `/api/twin${page}`
    return NextResponse.rewrite(url)
  }

  // 2. Check if the page has a markdown twin
  if (hasMarkdownTwin(pathname)) {
    const accept = req.headers.get("accept") || ""
    const ua = req.headers.get("user-agent")?.toLowerCase() || ""
    const prefersMarkdown = accept.includes("text/markdown") || accept.includes("text/x-markdown")
    const isAiBot = AI_BOTS.some((bot) => ua.includes(bot))

    if (prefersMarkdown || isAiBot) {
      // Rewrite to the markdown twin API route
      const url = req.nextUrl.clone()
      const page = pathname === "/" ? "/index" : pathname
      url.pathname = `/api/twin${page}`
      
      const response = NextResponse.rewrite(url)
      response.headers.set("Content-Type", "text/markdown; charset=utf-8")
      response.headers.set("X-Robots-Tag", "noindex")
      response.headers.set("Vary", "Accept")
      response.headers.set("X-Content-Type-Options", "nosniff")
      response.headers.set("X-AEO-Version", "1.0")
      return response
    }

    // 3. For normal HTML requests to pages with twins, inject Vary and Link headers
    const response = NextResponse.next()
    const twinPath = markdownTwinPath(pathname)
    response.headers.set("Vary", "Accept")
    response.headers.set("Link", `<${twinPath}>; rel="alternate"; type="text/markdown"`)
    return response
  }

  return NextResponse.next()
}

export const config = {
  // Run on pages and `.md` requests, but never on framework/proxy internals or static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|ingest|.*\\.(?:png|jpg|jpeg|gif|svg|ico|css|js|woff|woff2|json)).*)"],
}
