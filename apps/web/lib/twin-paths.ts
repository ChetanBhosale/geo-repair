import { getAllPosts } from "./blog"

// Pure (no fs / no server-only) helpers describing which pages expose a Markdown
// "twin" and where it lives. Kept separate from lib/markdown-twin.ts so the
// metadata layer (lib/seo.ts) and client-safe code can reference twin URLs
// without dragging the server-only generator (fs, blog MDX) into their bundle.

// Pages that expose a Markdown twin, served at <path>.md (home at /index.md).
// Drives the rel="alternate" link and the /llms.txt index so the advertised
// set never drifts from what the generator can serve.
export const MARKDOWN_TWIN_PATHS: readonly string[] = [
  "/",
  "/geo-aeo-checker",
  "/pricing",
  "/security",
  "/contact",
  "/blog",
  "/privacy",
  "/terms",
  ...getAllPosts().map((p) => `/blog/${p.slug}`),
]

// The URL of a page's Markdown twin (for rel="alternate" and llms.txt).
export function markdownTwinPath(pagePath: string): string {
  if (pagePath === "/") return "/index.md"
  return `${pagePath.replace(/\/$/, "")}.md`
}

export function hasMarkdownTwin(pagePath: string): boolean {
  return MARKDOWN_TWIN_PATHS.includes(pagePath)
}
