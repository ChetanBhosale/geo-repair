import {
  EnvelopeSimpleIcon,
  ShieldCheckIcon,
  GithubLogoIcon,
} from "@phosphor-icons/react/ssr"

import { buildMetadata, breadcrumbJsonLd, SITE } from "@/lib/seo"
import {
  CONTACT_HEADER,
  CONTACT_CHANNELS,
  SUPPORT_EMAIL,
  SECURITY_EMAIL,
} from "@/lib/marketing-content"
import { JsonLd } from "@/components/seo/json-ld"
import { PageHeader } from "@/components/layout/page-header"
import { CornerMarks } from "@/components/sections/frame"
import { Section } from "@/components/sections/section"
import { ContactForm } from "@/components/contact/contact-form"

export const metadata = buildMetadata({
  title: "Contact · Talk to the GEO Repair Team",
  description:
    "Questions about AI search readiness, the fix agent, security, or pricing? Email the GEO Repair team, and we read every message.",
  path: "/contact",
})

// Icons stay colocated with the component; channel copy lives in
// lib/marketing-content so the page and its Markdown twin share one source.
// Index-aligned with CONTACT_CHANNELS.
const CHANNEL_ICONS = [EnvelopeSimpleIcon, ShieldCheckIcon, GithubLogoIcon]

function contactPointJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.name,
    url: SITE.url,
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: SUPPORT_EMAIL,
        availableLanguage: "English",
      },
      {
        "@type": "ContactPoint",
        contactType: "security",
        email: SECURITY_EMAIL,
        availableLanguage: "English",
      },
    ],
  }
}

export default function ContactPage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Contact", path: "/contact" },
          ]),
          contactPointJsonLd(),
        ]}
      />

      <PageHeader
        eyebrow={CONTACT_HEADER.eyebrow}
        title={CONTACT_HEADER.title}
        description={CONTACT_HEADER.description}
      />

      <Section>
        <div className="mx-auto grid max-w-4xl gap-10 md:grid-cols-2">
          <div className="relative flex flex-col gap-px border border-border bg-border">
            <CornerMarks />
            {CONTACT_CHANNELS.map((channel, index) => {
              const Icon = CHANNEL_ICONS[index]
              return (
              <div key={channel.label} className="flex gap-3 bg-card p-5">
                <Icon
                  className="mt-0.5 size-5 shrink-0 text-foreground"
                  aria-hidden
                />
                <div className="flex flex-col gap-1">
                  <h2 className="font-heading text-sm font-medium text-foreground">
                    {channel.label}
                  </h2>
                  <a
                    href={channel.href}
                    className="font-mono text-xs text-foreground underline underline-offset-4 hover:text-muted-foreground"
                  >
                    {channel.value}
                  </a>
                  <p className="text-xs/relaxed text-muted-foreground">
                    {channel.body}
                  </p>
                </div>
              </div>
              )
            })}
          </div>

          <ContactForm supportEmail={SUPPORT_EMAIL} />
        </div>
      </Section>
    </>
  )
}
