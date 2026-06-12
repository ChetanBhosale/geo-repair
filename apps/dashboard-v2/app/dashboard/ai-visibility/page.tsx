"use client"

import {
  ChartLineUpIcon,
  CheckCircleIcon,
  SpinnerGapIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/dashboard/page-header"
import { useBreadcrumbs } from "@/context/breadcrumb"
import {
  useAiVisibilityInterest,
  useMarkAiVisibilityInterest,
} from "@/query/feature-interest.query"

const WHAT_IT_SHOWS = [
  "Which prompts mention your brand",
  "Which pages get cited",
  "Which competitors appear instead",
  "What to fix before monitoring again",
]

const HOW_IT_WORKS = [
  {
    title: "Choose prompts",
    body: "Start with buyer questions that matter to your category.",
  },
  {
    title: "Run samples",
    body: "Check the same prompts across AI search platforms over time.",
  },
  {
    title: "Repair gaps",
    body: "Turn missed citations into concrete site fixes.",
  },
]

export default function AiVisibilityPage() {
  useBreadcrumbs([{ label: "AI Visibility" }])
  const interest = useAiVisibilityInterest()
  const markInterest = useMarkAiVisibilityInterest()
  const interested = !!interest.data?.interested
  const saving = interest.isLoading || markInterest.isPending

  async function onShowInterest() {
    try {
      await markInterest.mutateAsync()
      toast.success("Interest saved.")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save your interest."
      )
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <PageHeader
        title="AI Visibility"
        description="Coming soon: see where AI search mentions you, cites you, or skips you."
      />

      <section className="grid gap-8 bg-card p-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex min-w-0 flex-col justify-center">
          <div className="grid size-12 place-items-center bg-muted text-muted-foreground">
            <ChartLineUpIcon className="size-6" />
          </div>
          <h2 className="mt-6 max-w-2xl text-2xl font-semibold tracking-tight">
            Track the AI answers your buyers see.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Monitor sampled prompts, cited URLs, and competitor mentions. Then
            use GEO Repair to fix the pages AI systems are missing.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              className="cursor-pointer"
              disabled={saving || interested}
              onClick={onShowInterest}
            >
              {saving ? (
                <SpinnerGapIcon className="size-4 animate-spin" />
              ) : interested ? (
                <CheckCircleIcon className="size-4" weight="fill" />
              ) : null}
              {interest.isLoading
                ? "Checking interest"
                : interested
                  ? "Interest saved"
                  : "Show interest"}
            </Button>
            <span className="text-xs text-muted-foreground">
              No monitoring runs yet. This only saves your interest.
            </span>
          </div>
        </div>

        <div className="grid content-start gap-2 bg-muted p-5">
          <h3 className="text-sm font-medium">What it will show</h3>
          <div className="grid gap-2">
            {WHAT_IT_SHOWS.map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 bg-background px-3 py-2 text-sm"
              >
                <CheckCircleIcon className="size-4 text-muted-foreground" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-3">
        {HOW_IT_WORKS.map((item) => (
          <div key={item.title} className="bg-card p-5">
            <h3 className="text-sm font-medium">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {item.body}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-4 bg-muted p-5">
        <h3 className="text-sm font-medium">Important</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Results will be sample-based. We will report appearances in monitored
          prompts, not total ChatGPT impressions or guaranteed citation volume.
        </p>
      </section>
    </div>
  )
}
