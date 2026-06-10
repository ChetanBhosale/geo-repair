// Brand palette mirrored from apps/web/app/globals.css (emerald primary, soft
// near-black). The package owns its own copy of these + the site metadata so it
// stays independent of any single app (apps/web/lib/seo.ts).

export const ACCENT = "#047857" // emerald primary
export const INK = "#262626" // soft near-black body text
export const MUTED = "#6b7280" // gray for secondary text
export const BG = "#f6f7f6" // page background
export const CARD = "#ffffff"
export const BORDER = "#ececec"

export const SITE = {
  name: "GEO Repair",
  tagline: "AI Search Optimization",
  url: "https://geo.repair",
} as const

// Absolute PNG of the GEO mark in the brand emerald, matching the wordmark color.
// Email clients (Gmail, Outlook) don't render SVG and a PNG must be reachable by
// absolute URL, so this points at the asset committed to apps/web/public. It only
// resolves once the marketing site is deployed; until then preview/test sends show
// a broken icon. Regenerate from apps/web/public/logo.svg recolored to ACCENT.
export const LOGO_URL = "https://geo.repair/email-logo.png"

export const FONT_FAMILY =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
