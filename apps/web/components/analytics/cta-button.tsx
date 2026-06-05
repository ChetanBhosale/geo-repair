"use client"

import type { ComponentProps } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { capture } from "@/lib/analytics"

type CtaButtonProps = {
  href: string
  // Where this CTA lives, e.g. "cta_band", "pricing", "404". Becomes the
  // `location` property so one cta_clicked event powers the whole funnel.
  location: string
  // Plain-text label for the event (children may include icons).
  label: string
  children?: React.ReactNode
} & Omit<ComponentProps<typeof Button>, "asChild" | "children">

// Small client island for primary CTAs that live in server components. Renders
// the same Button+Link and emits a labelled cta_clicked.
export function CtaButton({
  href,
  location,
  label,
  children,
  ...buttonProps
}: CtaButtonProps) {
  return (
    <Button asChild {...buttonProps}>
      <Link
        href={href}
        onClick={() => capture("cta_clicked", { location, label, href })}
      >
        {children ?? label}
      </Link>
    </Button>
  )
}
