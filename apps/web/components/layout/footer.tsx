import Link from "next/link"
import { LinkedinLogoIcon, XLogoIcon } from "@phosphor-icons/react/ssr"

import { SITE } from "@/lib/seo"
import { FOOTER_SECTIONS, SOCIAL_LINKS } from "@/lib/navigation"
import { Logo } from "./logo"

const TRUST_LINE = [
  "Your code is never kept",
  "Only the one repo you pick",
  "Zero data retention, no model training",
]

// Icons stay colocated with the component; the URLs live in lib/navigation.ts.
const SOCIAL_ICONS = {
  LinkedIn: LinkedinLogoIcon,
  X: XLogoIcon,
} as const

// Underline that expands from 0 → full width, anchored left, on hover.
const FOOTER_LINK_CLASS =
  "relative inline-block text-xs text-muted-foreground transition-colors hover:text-foreground after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-foreground after:transition-transform after:duration-300 after:content-[''] hover:after:scale-x-100"

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="flex flex-col gap-3">
            <Logo />
            <p className="max-w-xs text-xs/relaxed text-muted-foreground">
              The free checkup that scores your site for AI search engines like
              ChatGPT, Perplexity, and Google AI, then ships a pull request that
              fixes it.
            </p>
            <ul className="mt-1 flex items-center gap-3">
              {SOCIAL_LINKS.map((social) => {
                const Icon = SOCIAL_ICONS[social.label]
                return (
                  <li key={social.href}>
                    <Link
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`GEO Repair on ${social.label}`}
                      className="inline-flex text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Icon className="size-5" aria-hidden />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <nav key={section.title} aria-label={section.title}>
              <h2 className="font-heading text-xs font-medium text-foreground">
                {section.title}
              </h2>
              <ul className="mt-3 flex flex-col gap-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={FOOTER_LINK_CLASS}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <ul className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {TRUST_LINE.map((item, index) => (
              <li key={item} className="flex items-center gap-2">
                {index > 0 && <span aria-hidden className="text-border">·</span>}
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p>
            © {new Date().getFullYear()} {SITE.name}
          </p>
        </div>
      </div>
    </footer>
  )
}
