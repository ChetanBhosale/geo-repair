import { Logo } from "@/components/layout/logo"
import { ScoreRing } from "@/components/demo/score-ring"
import { SiteFavicon } from "@/components/checkup/site-favicon"
import {
  CategoryScoreRows,
  ScoreBlockStrip,
  ScoreSummary,
  type ScoreCategoryRow,
} from "@/components/checkup/score-block-strip"
import { DASHBOARD_DISPLAY_HOST } from "@/lib/dashboard-url"
import { cn } from "@/lib/utils"
import {
  type CheckStatus,
  type ScanResult,
  type SiteCheck,
  RUBRIC_CATEGORY_ORDER,
  checkLabel,
  hostnameOf,
  isAutoFixable,
  statusLabel,
  statusTone,
} from "@/lib/scan-result"

function verdict(overall: number): string {
  if (overall >= 80) return "Strong AI search readiness."
  if (overall >= 50)
    return "Partial readiness, fixable gaps are holding the site back."
  return "Low readiness, AI engines struggle to read and cite this site."
}

const TONE_PILL: Record<ReturnType<typeof statusTone>, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/20 text-foreground",
  destructive: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
}

function StatusPill({ status }: { status: CheckStatus }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-medium tracking-wide uppercase",
        TONE_PILL[statusTone(status)]
      )}
    >
      {statusLabel(status)}
    </span>
  )
}

function CheckRow({ check }: { check: SiteCheck }) {
  const isPass = check.status === "SUCCESS"
  const affected = check.affectedPages?.length ?? 0
  return (
    <li className="flex break-inside-avoid flex-col gap-1.5 bg-card px-5 py-4">
      <div className="flex items-center gap-2">
        <StatusPill status={check.status} />
        <span className="min-w-0 text-sm font-medium text-foreground">
          {checkLabel(check.name)}
        </span>
        {isAutoFixable(check) && !isPass && (
          <span className="ml-auto shrink-0 font-mono text-[10px] tracking-wide text-primary uppercase">
            Auto-fix
          </span>
        )}
      </div>
      {check.summary && (
        <p className="text-xs/relaxed text-muted-foreground">{check.summary}</p>
      )}
      {!isPass && check.recommendation && (
        <p className="text-xs/relaxed text-foreground">
          <span className="font-medium">Fix: </span>
          {check.recommendation}
        </p>
      )}
      {affected > 0 && (
        <p className="font-mono text-[11px] text-muted-foreground">
          {affected} affected {affected === 1 ? "page" : "pages"}
        </p>
      )}
    </li>
  )
}

export function ScanReport({ result }: { result: ScanResult }) {
  const overall = Math.round(result.score.overall)
  const host = hostnameOf(result.finalUrl)

  const counts = result.checks.reduce(
    (acc, c) => {
      if (c.status === "SUCCESS") acc.pass += 1
      else if (c.status === "MID") acc.partial += 1
      else if (c.status === "FAILED") acc.fail += 1
      return acc
    },
    { pass: 0, partial: 0, fail: 0 }
  )

  // Group checks by canonical category order; trailing buckets first, then any
  // category the scanner returned that isn't in the canonical list.
  const grouped = new Map<string, SiteCheck[]>()
  for (const check of result.checks) {
    const list = grouped.get(check.category) ?? []
    list.push(check)
    grouped.set(check.category, list)
  }
  const orderedCategories = [
    ...RUBRIC_CATEGORY_ORDER.filter((c) => grouped.has(c)),
    ...[...grouped.keys()].filter(
      (c) => !RUBRIC_CATEGORY_ORDER.includes(c as never)
    ),
  ]
  const categoryRows: ScoreCategoryRow[] = orderedCategories.map((category) => {
    const checks = (grouped.get(category) ?? []).sort(
      (a, b) => b.weight - a.weight
    )
    const sub = result.score.byCategory[category]
    return {
      category,
      score:
        sub && sub.status !== "NOT_APPLICABLE" ? Math.round(sub.score) : null,
      status: sub?.status ?? "INCONCLUSIVE",
      checks,
    }
  })

  const generatedAt = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <article
      className="mx-auto w-full max-w-3xl bg-background text-foreground"
      style={{
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
    >
      {/* Cover header */}
      <header className="flex flex-col gap-7 bg-primary px-8 py-10 text-white">
        <div className="flex items-center justify-between gap-4">
          <Logo className="text-white" />
          <span className="font-mono text-[11px] tracking-widest text-white/70 uppercase">
            AI Search Readiness Report
          </span>
        </div>
        <div className="flex items-start gap-4">
          <SiteFavicon
            src={result.brand?.faviconUrl}
            className="mt-1 size-12 bg-white"
            imgClassName="size-8"
          />
          <div className="min-w-0 flex flex-col gap-1.5">
            <p className="font-mono text-[11px] tracking-widest text-white/70 uppercase">
              Analyzed site
            </p>
            <h1 className="font-heading text-3xl font-medium tracking-tight break-all">
              {host}
            </h1>
            <p className="text-sm text-white/70">
              {generatedAt} · {result.crawl.pagesChecked}{" "}
              {result.crawl.pagesChecked === 1 ? "page" : "pages"} checked
              {result.rubricVersion ? ` · rubric ${result.rubricVersion}` : ""}
            </p>
          </div>
        </div>
      </header>

      {/* Score summary */}
      <section className="grid gap-px bg-border sm:grid-cols-[auto_1fr]">
        <div className="flex items-center justify-center bg-card p-8">
          <ScoreRing score={overall} size={132} />
        </div>
        <div className="flex flex-col justify-center gap-4 bg-card p-8">
          <p className="font-heading text-xl font-medium tracking-tight text-balance">
            {verdict(overall)}
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-muted-foreground">
            <span>
              <span className="text-success">{counts.pass}</span> passing
            </span>
            <span>
              <span className="text-foreground">{counts.partial}</span> partial
            </span>
            <span>
              <span className="text-destructive">{counts.fail}</span> failing
            </span>
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Score
              </p>
              <ScoreSummary score={overall} />
            </div>
            <ScoreBlockStrip
              score={overall}
              className="mt-3"
              barClassName="h-9"
            />
          </div>
        </div>
      </section>

      {/* Category breakdown */}
      {categoryRows.length > 0 && (
        <section className="bg-card px-8 py-7">
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Category scores
          </p>
          <div className="mt-4">
            <CategoryScoreRows rows={categoryRows} />
          </div>
        </section>
      )}

      {/* Full findings, grouped by category */}
      <section className="flex flex-col gap-px bg-border">
        <div className="bg-card px-8 pt-7 pb-3">
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            All checks
          </p>
        </div>
        {categoryRows.map(({ category, checks }) => {
          const sub = result.score.byCategory[category]
          return (
            <div key={category} className="break-inside-avoid bg-card px-8 py-6">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-heading text-sm font-medium text-foreground">
                  {category}
                </h2>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {sub && sub.status !== "NOT_APPLICABLE"
                    ? `${Math.round(sub.score)} / 100 · `
                    : ""}
                  {checks.length} {checks.length === 1 ? "check" : "checks"}
                </span>
              </div>
              <ul className="mt-3 flex flex-col gap-px overflow-hidden bg-border">
                {checks.map((check) => (
                  <CheckRow key={check.name} check={check} />
                ))}
              </ul>
            </div>
          )
        })}
      </section>

      {/* Closing CTA */}
      <footer className="flex break-inside-avoid flex-col gap-3 bg-primary px-8 py-9 text-white">
        <h2 className="font-heading text-xl font-medium tracking-tight">
          Fix these automatically
        </h2>
        <p className="max-w-lg text-sm/relaxed text-white/80">
          GEO Repair&rsquo;s agent clones the one repository you pick into an
          ephemeral sandbox, applies the structural and content fixes, verifies
          the build, and opens a pull request you review and merge. Nothing ships
          without you.
        </p>
        <p className="mt-1 font-mono text-xs tracking-wide text-white/70">
          Start your fix at {DASHBOARD_DISPLAY_HOST}
        </p>
      </footer>
    </article>
  )
}
