import type { Metadata } from "next"

// The report is built from an ephemeral, browser-local scan result, so it must
// never be indexed or surfaced as a public URL.
export const metadata: Metadata = {
  title: "AI Search Readiness Report",
  robots: { index: false, follow: false },
}

export default function ReportLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
