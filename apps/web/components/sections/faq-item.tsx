"use client"

import { PlusIcon } from "@phosphor-icons/react/ssr"

import type { FaqItem } from "@/lib/landing-content"
import { capture } from "@/lib/analytics"

// Client island so we can track expands. The native <details> toggle isn't a
// click autocapture can label, so we emit faq_opened manually. The parent Faq
// stays a server component (it renders the FAQ JSON-LD).
export function FaqDetails({ item }: { item: FaqItem }) {
  return (
    <details
      className="group border-b border-border last:border-b-0"
      onToggle={(event) => {
        if (event.currentTarget.open) {
          capture("faq_opened", { question: item.question })
        }
      }}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
        <h3 className="font-heading text-sm font-medium">{item.question}</h3>
        <PlusIcon
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-45"
          aria-hidden
        />
      </summary>
      <div className="px-5 pb-4 text-sm/relaxed text-muted-foreground">
        {item.answer}
      </div>
    </details>
  )
}
