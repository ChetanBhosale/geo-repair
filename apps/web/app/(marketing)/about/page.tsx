import { XLogoIcon, HeartIcon } from "@phosphor-icons/react/ssr"

import { buildMetadata, breadcrumbJsonLd, SITE } from "@/lib/seo"
import {
  ABOUT_HEADER,
  ABOUT_STORY_INTRO,
  ABOUT_STORY,
  ABOUT_PROMISE,
  FOUNDERS,
} from "@/lib/marketing-content"
import { JsonLd } from "@/components/seo/json-ld"
import { PageHeader } from "@/components/layout/page-header"
import { CornerMarks } from "@/components/sections/frame"
import { Section } from "@/components/sections/section"
import { Prose } from "@/components/layout/prose"
import { CtaBand } from "@/components/sections/cta-band"

export const metadata = buildMetadata({
  title: "About · The Founders Behind GEO Repair",
  description:
    "GEO Repair is built by Ajay Pawriya and Chetan Bhosale, who spent three months getting their own product ranked and cited by AI search, then turned what they learned into a tool.",
  path: "/about",
})

// AboutPage + an Organization whose `founder` array names real people with
// `sameAs` links to their profiles. This is the structured-data backbone of the
// page's E-E-A-T story: it lets search and answer engines resolve "who makes
// GEO Repair" to verifiable human entities.
function aboutJsonLd() {
  const founders = FOUNDERS.map((f) => ({
    "@type": "Person",
    name: f.name,
    jobTitle: f.role,
    url: f.x,
    sameAs: [f.x],
  }))

  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "About GEO Repair",
    url: new URL("/about", SITE.url).toString(),
    mainEntity: {
      "@type": "Organization",
      name: SITE.name,
      url: SITE.url,
      logo: new URL("/icon-512.png", SITE.url).toString(),
      description: SITE.description,
      founder: founders,
      email: ABOUT_PROMISE.email,
    },
  }
}

export default function AboutPage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "About", path: "/about" },
          ]),
          aboutJsonLd(),
        ]}
      />

      <PageHeader
        eyebrow={ABOUT_HEADER.eyebrow}
        title={ABOUT_HEADER.title}
        description={ABOUT_HEADER.description}
      />

      <Section
        eyebrow={ABOUT_STORY_INTRO.eyebrow}
        title={ABOUT_STORY_INTRO.title}
        align="start"
      >
        <Prose className="mx-auto max-w-2xl">
          {ABOUT_STORY.map((paragraph) => (
            <p key={paragraph.slice(0, 32)}>{paragraph}</p>
          ))}
        </Prose>
      </Section>

      <Section eyebrow="The founders" title="Two people, no layers in between">
        <div className="relative mx-auto grid max-w-3xl gap-px border border-border bg-border sm:grid-cols-2">
          <CornerMarks />
          {FOUNDERS.map((founder) => (
            <div key={founder.name} className="flex flex-col gap-3 bg-card p-6">
              <div className="flex flex-col gap-0.5">
                <h3 className="font-heading text-base font-medium text-foreground">
                  {founder.name}
                </h3>
                <p className="font-mono text-xs text-muted-foreground">
                  {founder.role}
                </p>
              </div>
              <p className="text-xs/relaxed text-muted-foreground">
                {founder.bio}
              </p>
              <a
                href={founder.x}
                target="_blank"
                rel="noopener noreferrer me"
                className="mt-auto flex items-center gap-1.5 font-mono text-xs text-foreground underline underline-offset-4 hover:text-muted-foreground"
              >
                <XLogoIcon className="size-3.5" aria-hidden />
                {founder.handle}
              </a>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow={ABOUT_PROMISE.eyebrow} title={ABOUT_PROMISE.title}>
        <div className="relative mx-auto max-w-2xl border border-border bg-card p-8 text-center">
          <CornerMarks />
          <p className="text-sm/relaxed text-pretty text-muted-foreground">
            We&apos;re a two-person team, so there&apos;s no support queue
            between you and the people writing the code. Have a question, hit a
            bug, or want a feature? Email Ajay at{" "}
            <a
              href={`mailto:${ABOUT_PROMISE.email}`}
              className="font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground"
            >
              {ABOUT_PROMISE.email}
            </a>{" "}
            and we aim to fix it or ship it within 24 hours.
          </p>
          <p className="mt-6 flex items-center justify-center gap-1.5 font-mono text-xs text-muted-foreground">
            Built with
            <HeartIcon
              weight="fill"
              className="size-3.5 text-primary"
              aria-hidden
            />
            care by Ajay &amp; Chetan
          </p>
        </div>
      </Section>

      <CtaBand />
    </>
  )
}
