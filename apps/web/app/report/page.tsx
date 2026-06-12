"use client"

import { useEffect, useState } from "react"
import {
  ArrowLeftIcon,
  DownloadSimpleIcon,
} from "@phosphor-icons/react/ssr"

import { Button } from "@/components/ui/button"
import { Logo } from "@/components/layout/logo"
import { ScanReport } from "@/components/checkup/scan-report"
import { type ScanResult, loadStoredScan } from "@/lib/scan-result"

const PRINT_CSS = `@media print {
  @page { margin: 14mm; }
  html, body { background: #fff !important; }
}`

export default function ReportPage() {
  const [result, setResult] = useState<ScanResult | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setResult(loadStoredScan())
    setLoaded(true)
  }, [])

  // Avoid a flash of the empty state before localStorage is read.
  if (!loaded) {
    return <div className="min-h-svh bg-background" />
  }

  if (!result) {
    return (
      <main className="grid min-h-svh place-items-center bg-background px-4 text-center">
        <div className="flex max-w-sm flex-col items-center gap-4">
          <Logo />
          <p className="mt-2 font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
            No report found
          </p>
          <h1 className="font-heading text-xl font-medium tracking-tight text-balance">
            Run a scan to generate your report
          </h1>
          <p className="text-sm/relaxed text-muted-foreground text-pretty">
            Your report is built from your most recent scan in this browser. Run
            a free scan, then choose &ldquo;Download full report.&rdquo;
          </p>
          <Button asChild className="mt-1">
            <a href="/#checkup">Run a free scan</a>
          </Button>
        </div>
      </main>
    )
  }

  return (
    <div className="min-h-svh bg-muted/40 py-8 print:bg-white print:py-0">
      <style>{PRINT_CSS}</style>

      {/* Screen-only action bar */}
      <div className="mx-auto mb-4 flex w-full max-w-3xl items-center justify-between gap-3 px-4 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <a href="/#checkup">
            <ArrowLeftIcon aria-hidden />
            Back to scan
          </a>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <DownloadSimpleIcon aria-hidden />
          Download PDF
        </Button>
      </div>

      <div className="mx-auto w-full max-w-3xl overflow-hidden bg-background shadow-sm print:max-w-none print:shadow-none">
        <ScanReport result={result} />
      </div>
    </div>
  )
}
