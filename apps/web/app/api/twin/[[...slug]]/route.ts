import { getTwin } from "@/lib/markdown-twin"

// Serves the Markdown "twin" of a page. Reached via the `.md` rewrite in
// middleware.ts, which encodes the page path in the slug (e.g. /pricing.md ->
// /api/twin/pricing). Runs on Node so it can read the blog MDX from disk; the
// content/ dir is pinned into this route's bundle via outputFileTracingIncludes
// in next.config.ts.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug?: string[] }> }
) {
  const { slug } = await params
  const pagePath = `/${(slug ?? []).join("/")}`
  const markdown = await getTwin(pagePath)

  if (markdown === null) {
    return new Response("Not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    })
  }

  return new Response(markdown, {
    status: 200,
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  })
}
