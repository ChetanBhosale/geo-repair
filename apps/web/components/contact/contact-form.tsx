"use client"

import { useState } from "react"
import { CheckCircleIcon } from "@phosphor-icons/react/ssr"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { capture } from "@/lib/analytics"

type Status = "idle" | "submitting" | "sent" | "error"

// Client island: collects a contact message. Posts to the /api/contact route
// (where storage/email wiring will live) and, on success, emits a
// contact_submitted event into PostHog with the submission as properties — so
// messages are readable there until a real inbox/store is wired. Mirrors the
// WaitlistForm contract: POST { name?, email, message } → 200 { ok: true }.
export function ContactForm({ supportEmail }: { supportEmail: string }) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [status, setStatus] = useState<Status>("idle")

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (status === "submitting") return
    setStatus("submitting")
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      })
      if (!res.ok) throw new Error("request failed")
      capture("contact_submitted", { name, email, message })
      setStatus("sent")
    } catch {
      setStatus("error")
    }
  }

  if (status === "sent") {
    return (
      <div className="flex items-center gap-2.5 rounded-md border border-success/30 bg-success/5 px-4 py-4 text-left">
        <CheckCircleIcon
          weight="fill"
          className="size-5 shrink-0 text-success"
          aria-hidden
        />
        <p className="text-sm text-foreground">
          Thanks{name.trim() ? `, ${name.trim()}` : ""} — your message is in.
          We&rsquo;ll reply to{" "}
          <span className="font-medium">{email}</span> soon.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 border border-border bg-card p-6"
    >
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="contact-name"
          className="text-xs font-medium text-foreground"
        >
          Name
        </label>
        <Input
          id="contact-name"
          name="name"
          autoComplete="name"
          value={name}
          disabled={status === "submitting"}
          onChange={(event) => {
            setName(event.target.value)
            if (status === "error") setStatus("idle")
          }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="contact-email"
          className="text-xs font-medium text-foreground"
        >
          Email
        </label>
        <Input
          id="contact-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          disabled={status === "submitting"}
          onChange={(event) => {
            setEmail(event.target.value)
            if (status === "error") setStatus("idle")
          }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="contact-message"
          className="text-xs font-medium text-foreground"
        >
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={5}
          required
          value={message}
          disabled={status === "submitting"}
          onChange={(event) => {
            setMessage(event.target.value)
            if (status === "error") setStatus("idle")
          }}
          className="w-full resize-y rounded-md border border-input bg-transparent px-2.5 py-2 text-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:opacity-60"
        />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={status === "submitting"}>
        {status === "submitting" ? "Sending…" : "Send message"}
      </Button>
      <p className="text-[11px]/relaxed text-muted-foreground">
        {status === "error" ? (
          <span className="text-destructive">
            Something went wrong — please try again, or email{" "}
            <a
              href={`mailto:${supportEmail}`}
              className="underline underline-offset-4"
            >
              {supportEmail}
            </a>
            .
          </span>
        ) : (
          <>
            We read every message and reply by email. Prefer to write directly?
            Email{" "}
            <a
              href={`mailto:${supportEmail}`}
              className="text-foreground underline underline-offset-4"
            >
              {supportEmail}
            </a>
            .
          </>
        )}
      </p>
    </form>
  )
}
