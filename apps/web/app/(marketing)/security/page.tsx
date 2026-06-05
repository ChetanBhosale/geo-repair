import {
  ShieldCheckIcon,
  XCircleIcon,
  CheckCircleIcon,
} from "@phosphor-icons/react/ssr"

import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo"
import { TRUST_PROMISES } from "@/lib/trust"
import {
  SECURITY_HEADER,
  SECURITY_COMMITMENTS_INTRO,
  SECURITY_ACCESS_INTRO,
  SECURITY_LIFECYCLE_INTRO,
  SECURITY_ACCESS,
  SECURITY_LIFECYCLE,
  SECURITY_FAQ_INTRO,
  SECURITY_FAQ,
} from "@/lib/marketing-content"
import { JsonLd } from "@/components/seo/json-ld"
import { PageHeader } from "@/components/layout/page-header"
import { CornerMarks, Frame } from "@/components/sections/frame"
import { Section } from "@/components/sections/section"
import { Faq } from "@/components/sections/faq"
import { EeatBadge } from "@/components/layout/eeat-badge"
import { DefinitionsGlossary } from "@/components/sections/definitions-glossary"
import { CitationReferences } from "@/components/sections/citation-references"

export const metadata = buildMetadata({
  title: "Security · Zero Retention, No Model Training · GEO Repair",
  description:
    "How GEO Repair protects your code: ephemeral sandbox, least-privilege single-repo access, no third-party sharing, zero data retention, and no model training.",
  path: "/security",
})

const SECURITY_TERMS = [
  {
    name: "Ephemeral Sandbox",
    definition: "An isolated, temporary container provisioned purely for executing your fix agent run, which is completely destroyed immediately post-PR.",
  },
  {
    name: "Zero Data Retention",
    definition: "Our strict architectural policy where we never store, log, cache, or retain your private source code after the execution sandbox is deleted.",
  }
]

const SECURITY_REFERENCES = [
  {
    title: "OWASP Top Ten Security Risks Guidance",
    sourceName: "OWASP Foundation",
    url: "https://owasp.org/www-project-top-ten/",
    description: "Our sandboxed isolation and minimal-access practices are developed according to secure coding and infrastructure parameters defined by the OWASP foundation.",
  },
  {
    title: "GitHub Developer OAuth & App Security Standards",
    sourceName: "GitHub Docs",
    url: "https://docs.github.com/en/apps/maintaining-github-apps/evaluating-a-github-app-security-report",
    description: "Our single-repository, narrow scope authentication matches best-practice guidelines and security policies defined in Google and GitHub App security guidelines.",
  }
]

export default function SecurityPage() {
  return (
    <>
      {/* FAQPage JSON-LD is emitted once by the <Faq> component below. */}
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Security", path: "/security" },
        ])}
      />

      <PageHeader
        eyebrow={SECURITY_HEADER.eyebrow}
        title={SECURITY_HEADER.title}
        description={SECURITY_HEADER.description}
      />

      <EeatBadge />

      <Section
        eyebrow={SECURITY_COMMITMENTS_INTRO.eyebrow}
        title={SECURITY_COMMITMENTS_INTRO.title}
      >
        <div className="relative grid gap-px border border-border bg-border sm:grid-cols-2">
          <CornerMarks />
          {TRUST_PROMISES.map((promise) => (
            <div key={promise.title} className="flex gap-3 bg-card p-6">
              <ShieldCheckIcon
                className="size-5 shrink-0 text-foreground"
                aria-hidden
              />
              <div className="flex flex-col gap-1.5">
                <h3 className="font-heading text-sm font-medium text-foreground">
                  {promise.title}
                </h3>
                <p className="text-xs/relaxed text-muted-foreground">
                  {promise.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        eyebrow={SECURITY_ACCESS_INTRO.eyebrow}
        title={SECURITY_ACCESS_INTRO.title}
        description={SECURITY_ACCESS_INTRO.description}
      >
        <ul className="relative mx-auto max-w-2xl divide-y divide-border border border-border bg-card">
          <CornerMarks />
          {SECURITY_ACCESS.map((item) => (
            <li key={item.label} className="flex items-center gap-3 px-5 py-3">
              {item.allowed ? (
                <CheckCircleIcon
                  weight="fill"
                  className="size-4 shrink-0 text-success"
                  aria-hidden
                />
              ) : (
                <XCircleIcon
                  weight="fill"
                  className="size-4 shrink-0 text-destructive"
                  aria-hidden
                />
              )}
              <span className="text-sm text-foreground">{item.label}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        eyebrow={SECURITY_LIFECYCLE_INTRO.eyebrow}
        title={SECURITY_LIFECYCLE_INTRO.title}
        description={SECURITY_LIFECYCLE_INTRO.description}
      >
        <Frame>
          <ol className="grid gap-px bg-border md:grid-cols-4">
            {SECURITY_LIFECYCLE.map((stage, index) => (
              <li
                key={stage.title}
                className="flex flex-col gap-2 bg-card p-5"
              >
              <span className="font-mono text-xs text-muted-foreground">
                0{index + 1}
              </span>
              <h3 className="font-heading text-sm font-medium text-foreground">
                {stage.title}
              </h3>
              <p className="text-xs/relaxed text-muted-foreground">
                0{index + 1} · {stage.body}
              </p>
              </li>
            ))}
          </ol>
        </Frame>
      </Section>

      <DefinitionsGlossary terms={SECURITY_TERMS} />

      <CitationReferences references={SECURITY_REFERENCES} />

      <Faq
        items={SECURITY_FAQ}
        title={SECURITY_FAQ_INTRO.title}
        description={SECURITY_FAQ_INTRO.description}
      />
    </>
  )
}
