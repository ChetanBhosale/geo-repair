"use client"

import { LifebuoyIcon, EnvelopeSimpleIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/dashboard/page-header"

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <PageHeader
        title="Support"
        description="Questions, issues, or feedback. We&apos;re here to help."
      />
      <div className="grid place-items-center rounded-xl border border-dashed border-border bg-card/40 px-6 py-20 text-center">
        <div className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
          <LifebuoyIcon className="size-6" />
        </div>
        <h2 className="mt-4 text-base font-semibold">Need a hand?</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Reach out and we&apos;ll get back to you. Include your project and what you
          were trying to do.
        </p>
        <Button className="mt-5" asChild>
          <a href="mailto:support@geo.repair">
            <EnvelopeSimpleIcon className="size-4" />
            Contact support
          </a>
        </Button>
      </div>
    </div>
  )
}
