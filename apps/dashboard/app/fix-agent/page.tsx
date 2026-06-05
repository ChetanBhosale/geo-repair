"use client"

import * as React from "react"
import Link from "next/link"
import { ExternalLink, GitBranch, Loader2 } from "lucide-react"
import type { FixIntakeQuestionId } from "@repo/types/fix"
import { FixIntakeForm } from "@/components/fix-agent/fix-intake-form"
import { FixTechPanel } from "@/components/fix-agent/fix-tech-panel"
import { RunHistory } from "@/components/fix-agent/run-history"
import { RunTranscript } from "@/components/fix-agent/run-transcript"
import { DashboardShell } from "@/components/dashboard-shell"
import { StatePanel } from "@/components/state-panel"
import { Button } from "@/components/ui/button"
import { loginWithGithub, useUser } from "@/hooks/use-auth"
import { useFixRun, useFixRuns, useStartFix } from "@/hooks/use-fix"
import { useSavedRepos } from "@/hooks/use-repos"
import {
  buildIntake,
  defaultIntakeAnswers,
  type IntakeAnswers,
  type IntakeNotes,
} from "@/lib/fix-intake"
import type { TechTab } from "@/lib/fix-run-view"

export default function FixAgentPage() {
  const { isLoading, isSignedIn } = useUser()
  const savedRepos = useSavedRepos(isSignedIn)
  const runs = useFixRuns(isSignedIn)
  const startFix = useStartFix()
  const [website, setWebsite] = React.useState("")
  const [activeTab, setActiveTab] = React.useState<TechTab>("console")
  const [selectedRunId, setSelectedRunId] = React.useState<string | null>(null)
  const [intakeAnswers, setIntakeAnswers] =
    React.useState<IntakeAnswers>(defaultIntakeAnswers)
  const [intakeNotes, setIntakeNotes] = React.useState<IntakeNotes>({})
  const [refinement, setRefinement] = React.useState(
    "Keep the FAQ copy shorter and avoid changing the hero section."
  )

  const repositories = savedRepos.data ?? []
  const selectedRepo =
    repositories.find((repository) => repository.selected) ??
    repositories[0] ??
    null
  const runList = runs.data ?? []
  const selectedRun =
    runList.find((run) => run.id === selectedRunId) ?? runList[0] ?? null
  const detail = useFixRun(selectedRun?.id ?? null, isSignedIn)

  function onAnswerChange(questionId: FixIntakeQuestionId, answerId: string) {
    setIntakeAnswers((current) => ({
      ...current,
      [questionId]: answerId,
    }))
  }

  function onNoteChange(questionId: FixIntakeQuestionId, note: string) {
    setIntakeNotes((current) => ({
      ...current,
      [questionId]: note,
    }))
  }

  function onStartFix(event: React.FormEvent) {
    event.preventDefault()
    if (!selectedRepo || !website.trim()) {
      return
    }
    startFix.mutate({
      repositoryId: selectedRepo.id,
      website: website.trim(),
      intake: buildIntake(intakeAnswers, intakeNotes),
    })
  }

  return (
    <DashboardShell
      eyebrow="Fix agent"
      title="Run workspace"
      actions={
        selectedRun?.prUrl ? (
          <Button asChild variant="outline">
            <a href={selectedRun.prUrl} rel="noreferrer" target="_blank">
              View PR
              <ExternalLink className="size-4" />
            </a>
          </Button>
        ) : null
      }
    >
      {isLoading ? (
        <StatePanel
          eyebrow="Loading"
          title="Loading fix workspace"
          description="We are checking your session and project access."
          action={
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          }
        />
      ) : null}

      {!isLoading && !isSignedIn ? (
        <StatePanel
          eyebrow="GitHub required"
          title="Connect GitHub before running the fix agent"
          description="The fix agent can only work after a repository is selected for the active project."
          action={
            <Button onClick={loginWithGithub}>
              <GitBranch className="size-4" />
              Continue with GitHub
            </Button>
          }
        />
      ) : null}

      {isSignedIn && !savedRepos.isLoading && !selectedRepo ? (
        <StatePanel
          eyebrow="No repository"
          title="Choose a repository before starting a fix"
          description="The execution plane opens a PR against one selected repo. Choose it in settings first."
          action={
            <Button asChild>
              <Link href="/settings">
                <GitBranch className="size-4" />
                Open settings
              </Link>
            </Button>
          }
        />
      ) : null}

      {isSignedIn && selectedRepo ? (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(340px,0.55fr)]">
          <FixIntakeForm
            error={startFix.error ?? null}
            intakeAnswers={intakeAnswers}
            intakeNotes={intakeNotes}
            isPending={startFix.isPending}
            onAnswerChange={onAnswerChange}
            onNoteChange={onNoteChange}
            onSubmit={onStartFix}
            onWebsiteChange={setWebsite}
            selectedRepoFullName={selectedRepo.fullName}
            website={website}
          />

          <RunHistory
            error={runs.error ?? null}
            isLoading={runs.isLoading}
            onSelectRun={setSelectedRunId}
            runs={runList}
            selectedRunId={selectedRun?.id ?? null}
          />
        </section>
      ) : null}

      {isSignedIn && selectedRun ? (
        <section className="grid min-h-[640px] gap-4 xl:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.2fr)]">
          <RunTranscript
            detail={detail.data ?? null}
            isLoading={detail.isLoading}
            onRefinementChange={setRefinement}
            refinement={refinement}
            selectedRun={selectedRun}
          />

          <FixTechPanel
            activeTab={activeTab}
            detail={detail.data ?? null}
            onActiveTabChange={setActiveTab}
          />
        </section>
      ) : null}
    </DashboardShell>
  )
}
