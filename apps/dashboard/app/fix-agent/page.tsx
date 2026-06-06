"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ExternalLink, GitBranch, Loader2, Plus } from "lucide-react"
import { ArtifactPanel } from "@/components/fix-agent/artifact-panel"
import { NewRunDialog } from "@/components/fix-agent/new-run-dialog"
import { ResizablePanes } from "@/components/fix-agent/resizable-panes"
import { RunChat } from "@/components/fix-agent/run-chat"
import { RunSwitcher } from "@/components/fix-agent/run-switcher"
import { DashboardShell } from "@/components/dashboard-shell"
import { StatePanel } from "@/components/state-panel"
import { Button } from "@/components/ui/button"
import { useUser } from "@/hooks/use-auth"
import { useArtifactTab } from "@/hooks/use-auto-artifact-tab"
import { useFixRun, useFixRuns } from "@/hooks/use-fix"
import { useSavedRepos } from "@/hooks/use-repos"

export default function FixAgentPage() {
  return (
    <React.Suspense
      fallback={
        <DashboardShell eyebrow="Fix agent" title="Run workspace">
          <StatePanel
            action={<Loader2 className="size-4 animate-spin text-secondary" />}
            description="We are checking your session and project access."
            eyebrow="Loading"
            title="Loading fix workspace"
          />
        </DashboardShell>
      }
    >
      <FixAgentWorkspace />
    </React.Suspense>
  )
}

function FixAgentWorkspace() {
  const { isSignedIn, isLoading: authLoading } = useUser()
  const savedRepos = useSavedRepos(isSignedIn)
  const runs = useFixRuns(isSignedIn)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // Keep the selected run in the URL so a browser refresh restores it instead of
  // snapping back to the first run.
  const selectedRunId = searchParams.get("run")
  const setSelectedRunId = React.useCallback(
    (runId: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (runId) {
        params.set("run", runId)
      } else {
        params.delete("run")
      }
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      })
    },
    [pathname, router, searchParams],
  )
  const [newRunOpen, setNewRunOpen] = React.useState(false)

  const repositories = savedRepos.data ?? []
  const selectedRepo =
    repositories.find((repository) => repository.selected) ??
    repositories[0] ??
    null

  const runList = runs.data ?? []
  const selectedRun =
    runList.find((run) => run.id === selectedRunId) ?? runList[0] ?? null
  const detail = useFixRun(selectedRun?.id ?? null, isSignedIn)

  const { activeTab, selectTab } = useArtifactTab(
    detail.data ?? null,
    selectedRun?.id ?? null,
  )

  if (isSignedIn && !savedRepos.isLoading && !selectedRepo) {
    return (
      <DashboardShell eyebrow="Fix agent" title="Run workspace">
        <StatePanel
          action={
            <Button asChild>
              <Link href="/settings">
                <GitBranch className="size-4" />
                Open settings
              </Link>
            </Button>
          }
          description="The execution plane opens a PR against one selected repo. Choose it in settings first."
          eyebrow="No repository"
          title="Choose a repository before starting a fix"
        />
      </DashboardShell>
    )
  }

  return (
    <DashboardShell
      actions={
        <div className="flex items-center gap-2">
          <RunSwitcher
            isLoading={runs.isLoading}
            onSelectRun={setSelectedRunId}
            runs={runList}
            selectedRunId={selectedRun?.id ?? null}
          />
          <Button onClick={() => setNewRunOpen(true)} size="sm">
            <Plus className="size-4" />
            New run
          </Button>
          {selectedRun?.prUrl ? (
            <Button asChild size="sm" variant="outline">
              <a href={selectedRun.prUrl} rel="noreferrer" target="_blank">
                View PR
                <ExternalLink className="size-4" />
              </a>
            </Button>
          ) : null}
        </div>
      }
      eyebrow="Fix agent"
      fullBleed
      title="Run workspace"
    >
      <NewRunDialog
        onOpenChange={setNewRunOpen}
        onStarted={(runId) => {
          setSelectedRunId(runId)
          setNewRunOpen(false)
        }}
        open={newRunOpen}
        selectedRepo={selectedRepo}
      />

      {!selectedRun && (authLoading || runs.isLoading) ? (
        <div className="p-4 lg:p-6">
          <StatePanel
            action={<Loader2 className="size-4 animate-spin text-secondary" />}
            description="Restoring your fix runs."
            eyebrow="Loading"
            title="Loading runs"
          />
        </div>
      ) : selectedRun ? (
        <ResizablePanes
          left={
            <RunChat
              detail={detail.data ?? null}
              isLoading={detail.isLoading}
              onFocusArtifact={selectTab}
              onNewRun={() => setNewRunOpen(true)}
              selectedRun={selectedRun}
            />
          }
          right={
            <ArtifactPanel
              activeTab={activeTab}
              detail={detail.data ?? null}
              onSelectTab={selectTab}
            />
          }
        />
      ) : (
        <div className="p-4 lg:p-6">
          <StatePanel
            action={
              <Button onClick={() => setNewRunOpen(true)}>
                <Plus className="size-4" />
                New run
              </Button>
            }
            description="Pick a paid order and the agent will scan your site, fix the failing checks, and open a PR."
            eyebrow="No runs yet"
            title="Start your first fix run"
          />
        </div>
      )}
    </DashboardShell>
  )
}
