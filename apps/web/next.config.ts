import path from "node:path"
import { fileURLToPath } from "node:url"
import type { NextConfig } from "next"
import createMDX from "@next/mdx"

// Bun symlinks dependencies into a .bun store at the monorepo root, so the
// Turbopack root must be the repo root (two levels up), not this package,
// or Next can't resolve `next` through the symlink. This also silences the
// "inferred workspace root" warning from the stray lockfile in $HOME.
const monorepoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  turbopack: { root: monorepoRoot },
  // The Markdown-twin route (app/api/twin) reads blog MDX from content/ at
  // request time via fs; pin those files into its serverless bundle so the
  // read works in production (output file tracing won't follow dynamic paths).
  outputFileTracingIncludes: {
    "/api/twin/[[...slug]]": ["./content/**/*"],
  },
  // Reverse-proxy PostHog through our own domain (/ingest) so analytics loads
  // first-party: ad-blockers don't drop events and no third-party script sits
  // on the SEO-critical path. The client points api_host at /ingest; these
  // rewrites forward to PostHog US Cloud. Static assets have their own host.
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ]
  },
  // PostHog uses trailing-slash-sensitive routes (e.g. /decide); don't let
  // Next's trailing-slash redirect interfere with proxied requests.
  skipTrailingSlashRedirect: true,
}

// Plugins are passed as string names so they work with Turbopack (functions
// can't be serialized across the Rust boundary).
const withMDX = createMDX({
  options: {
    remarkPlugins: ["remark-gfm"],
    rehypePlugins: ["rehype-slug"],
  },
})

export default withMDX(nextConfig)
