"use client"

import type { ReactNode } from "react"
import { ExternalLink, FileText, ShieldCheck } from "lucide-react"
import type {
  ProjectReportDetail,
  ProjectReportType,
} from "@repo/types/reports"
import { LogoMark } from "@/components/brand-logo"

const TYPE_LABELS: Record<ProjectReportType, string> = {
  SCAN: "AI Search readiness report",
  FIX_SUMMARY: "Fix summary report",
  BEFORE_AFTER: "Before and after report",
  EXPORT: "Client report export",
}

function hostLabel(value: string | null) {
  if (!value) return "Not specified"

  try {
    return new URL(value).hostname.replace(/^www\./, "")
  } catch {
    return value
  }
}

function safeExternalUrl(value: string) {
  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return url.toString()
  } catch {
    return null
  }
}

function formatReportDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value))
}

export function ProfessionalReport({
  actions,
  report,
}: {
  actions?: ReactNode
  report: ProjectReportDetail
}) {
  return (
    <article className="overflow-hidden rounded-lg border border-secondary bg-primary text-primary">
      <header className="border-b border-secondary bg-secondary/25 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <LogoMark className="size-8 text-brand" />
            <div>
              <p className="text-sm font-semibold">GEO Repair</p>
              <p className="text-xs text-secondary">
                {TYPE_LABELS[report.type]}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">{actions}</div>
        </div>

        <div className="mt-8 grid gap-3">
          <p className="text-xs font-semibold text-secondary uppercase">
            {report.status.toLowerCase()} artifact
          </p>
          <h2 className="max-w-3xl text-2xl leading-tight font-semibold sm:text-4xl">
            {report.title}
          </h2>
          <p className="max-w-3xl text-sm leading-6 text-secondary sm:text-base">
            {report.summary}
          </p>
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Meta label="Website" value={hostLabel(report.website)} />
          <Meta
            label="Repository"
            value={report.repoFullName ?? "Not specified"}
          />
          <Meta
            label="Generated"
            value={formatReportDate(report.generatedAt)}
          />
          <Meta label="Source" value={report.content.generatedFrom} />
        </dl>
      </header>

      <div className="grid gap-6 p-5 sm:p-6">
        {report.content.metrics.length > 0 ? (
          <section
            aria-label="Report metrics"
            className="grid gap-3 sm:grid-cols-3"
          >
            {report.content.metrics.map((metric) => (
              <div
                className="min-w-0 rounded-md border border-secondary bg-secondary/20 p-4"
                key={metric.label}
              >
                <p className="text-xs font-semibold text-secondary uppercase">
                  {metric.label}
                </p>
                <p className="mt-3 text-2xl font-semibold break-words text-brand">
                  {metric.value}
                </p>
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-secondary">
                  {metric.detail ?? "No extra detail recorded."}
                </p>
              </div>
            ))}
          </section>
        ) : null}

        <section aria-label="Report sections" className="grid gap-5">
          {report.content.sections.map((section, index) => (
            <section
              className="border-t border-secondary pt-5"
              key={section.heading}
            >
              <p className="text-xs font-semibold text-secondary uppercase">
                Section {index + 1}
              </p>
              <h3 className="mt-2 text-xl font-semibold">{section.heading}</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">
                {section.body}
              </p>
              {section.items.length > 0 ? (
                <ul className="mt-4 grid gap-2">
                  {section.items.map((item) => (
                    <li
                      className="border-l-4 border-brand bg-secondary/20 px-3 py-2 text-sm leading-6"
                      key={item}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 rounded-md bg-secondary/20 px-3 py-2 text-sm text-secondary">
                  No line items recorded for this section.
                </p>
              )}
            </section>
          ))}
        </section>

        {report.content.links.length > 0 ? (
          <nav
            aria-label="Report links"
            className="flex flex-wrap gap-2 border-t border-secondary pt-5"
          >
            {report.content.links.map((link) => {
              const href = safeExternalUrl(link.url)
              if (!href) return null

              return (
                <a
                  className="inline-flex items-center gap-2 rounded-md border border-secondary px-3 py-2 text-sm font-medium text-brand hover:bg-secondary/25"
                  href={href}
                  key={`${link.label}-${href}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink className="size-4" />
                  {link.label}
                </a>
              )
            })}
          </nav>
        ) : null}

        <section className="grid gap-3 border-t border-secondary pt-5 sm:grid-cols-2">
          <TrustNote
            icon={<FileText className="size-4" />}
            title="What this report means"
            body="This measures technical AI Search readiness from stored scan, run, and PR data. It does not promise rankings, traffic, or citations."
          />
          <TrustNote
            icon={<ShieldCheck className="size-4" />}
            title="What stays private"
            body="Reports avoid raw source code, secrets, full terminal logs, and private repository file contents."
          />
        </section>
      </div>
    </article>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-secondary bg-primary p-3">
      <dt className="text-xs font-semibold text-secondary uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium break-words">{value}</dd>
    </div>
  )
}

function TrustNote({
  body,
  icon,
  title,
}: {
  body: string
  icon: ReactNode
  title: string
}) {
  return (
    <div className="rounded-md border border-secondary bg-secondary/20 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-brand">{icon}</span>
        {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-secondary">{body}</p>
    </div>
  )
}
