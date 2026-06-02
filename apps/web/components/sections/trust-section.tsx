import Link from "next/link"
import { ShieldCheckIcon } from "@phosphor-icons/react/ssr"

import { TRUST_PROMISES, TRUST_TAGLINE } from "@/lib/trust"
import { Button } from "@/components/ui/button"
import { CornerMarks } from "./frame"
import { Section } from "./section"

export function TrustSection() {
  return (
    <Section
      id="security"
      eyebrow="Security & trust"
      title="We touch one repo, in a sandbox, then disappear"
      description={TRUST_TAGLINE}
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
      <div className="mt-6 flex justify-center">
        <Button asChild variant="outline" size="sm">
          <Link href="/security">Read the full security details</Link>
        </Button>
      </div>
    </Section>
  )
}
