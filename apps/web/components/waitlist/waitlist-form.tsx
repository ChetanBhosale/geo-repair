"use client"

import { useState } from "react"
import { CheckCircleIcon, EnvelopeSimpleIcon } from "@phosphor-icons/react/ssr"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { capture } from "@/lib/analytics"

type Status = "idle" | "submitting" | "joined" | "error"

// Client island: collects an email for the launch waitlist. Posts to the
// /api/waitlist route (which is where storage/email wiring lives) and emits a
// waitlist_joined event on success so the funnel shows up in PostHog.
export function WaitlistForm({
  inputId = "waitlist-email",
  ctaLabel = "Join the waitlist",
}: {
  inputId?: string
  ctaLabel?: string
}) {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<Status>("idle")

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (status === "submitting") return
    setStatus("submitting")
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error("request failed")
      capture("waitlist_joined")
      setStatus("joined")
    } catch {
      setStatus("error")
    }
  }

  if (status === "joined") {
    return (
      <div className="flex items-center gap-2.5 rounded-md border border-success/30 bg-success/5 px-3 py-3 text-left">
        <CheckCircleIcon
          weight="fill"
          className="size-5 shrink-0 text-success"
          aria-hidden
        />
        <p className="text-sm text-foreground">
          You&rsquo;re on the list. We&rsquo;ll email{" "}
          <span className="font-medium">{email}</span>{" "}
          the moment it&rsquo;s ready.
        </p>
      </div>
    )
  }

  return (
    <form className="flex flex-col gap-2" onSubmit={onSubmit}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={inputId} className="sr-only">
          Your email address
        </label>
        <div className="relative flex-1">
          <EnvelopeSimpleIcon
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id={inputId}
            type="email"
            required
            inputMode="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            disabled={status === "submitting"}
            onChange={(event) => {
              setEmail(event.target.value)
              if (status === "error") setStatus("idle")
            }}
            className="h-10 pl-9 font-mono text-sm"
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="h-10"
          disabled={status === "submitting"}
        >
          {status === "submitting" ? "Joining…" : ctaLabel}
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {status === "error" ? (
          <span className="text-destructive">
            Something went wrong — please try again.
          </span>
        ) : (
          "Launching soon. Be the first to run a checkup when it's live."
        )}
      </p>
    </form>
  )
}
