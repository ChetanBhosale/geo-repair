"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, Lock, ScanSearch, Search } from "lucide-react"
import type { GithubRepo, SavedRepository } from "@repo/types/github"
import { BrandLogo } from "@/components/brand-logo"
import { GithubIcon } from "@/components/icons/github-icon"
import { HalftoneImage } from "@/components/shaders/halftone-image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAudit } from "@/hooks/use-audit"
import { loginWithGithub, useUser } from "@/hooks/use-auth"
import {
  useRepos,
  useSavedRepos,
  useSelectRepo,
  useUpdateRepoWebsite,
} from "@/hooks/use-repos"
import { cn } from "@/lib/utils"

type OnboardingStepId = "github" | "repo" | "scan"

const STEP_ORDER: OnboardingStepId[] = ["github", "repo", "scan"]
const URL_STORAGE_KEY = "geo-repair:dashboard:website-scan-url"

const STEP_COPY: Record<OnboardingStepId, { number: number; title: string }> = {
  github: {
    number: 1,
    title: "Connect GitHub",
  },
  repo: {
    number: 2,
    title: "Choose repo",
  },
  scan: {
    number: 3,
    title: "Add website",
  },
}

export default function OnboardingPage() {
  return (
    <React.Suspense fallback={<OnboardingLoading />}>
      <OnboardingFlow />
    </React.Suspense>
  )
}

function OnboardingFlow() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedNextPath = safeNextPath(searchParams.get("next")) ?? "/"
  const nextPath = requestedNextPath === "/onboarding" ? "/" : requestedNextPath
  const authError = searchParams.get("auth_error")
  const { isLoading, isSignedIn } = useUser()
  const savedRepos = useSavedRepos(isSignedIn)
  const [pickedRepo, setPickedRepo] = React.useState<SavedRepository | null>(
    null
  )
  const repositories = savedRepos.data ?? []
  const selectedRepo =
    repositories.find((repository) => repository.selected) ??
    pickedRepo ??
    repositories[0] ??
    null
  const activeStepId = getActiveStepId({
    isLoading,
    isSignedIn,
    isRepoLoading: savedRepos.isLoading && !pickedRepo,
    selectedRepo: !!selectedRepo,
  })
  const { displayedStepId, transitionPhase } =
    useOnboardingTransition(activeStepId)
  const displayedStep = STEP_COPY[displayedStepId]

  React.useEffect(() => {
    router.prefetch("/website-scan")
  }, [router])

  return (
    <main className="grid min-h-svh bg-background text-foreground lg:grid-cols-2">
      <section className="relative hidden min-h-svh overflow-hidden bg-[#f6f5ef] lg:block">
        <HalftoneImage
          src="/images/onboarding/abstract.jpg"
          alt="Abstract printed texture"
          className="absolute inset-0"
          overrides={{
            colorBack: "#f6f5ef",
            colorFront: "#17483d",
            contrast: 0.45,
            radius: 1.35,
            size: 0.42,
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(246,245,239,0.08),rgba(246,245,239,0.42))]" />
      </section>

      <section className="grid min-h-svh content-center px-4 py-6 sm:px-8 lg:px-12">
        <div className="mx-auto grid w-full max-w-xl gap-5">
          <BrandLogo />

          <div className="grid gap-5">
            <h1 className="text-2xl font-semibold tracking-tight">
              Set up workspace
            </h1>

            <OnboardingProgress currentStep={displayedStep.number} />

            <div
              className={cn(
                "grid min-h-[300px] content-start gap-5 transition-all duration-300 ease-out motion-reduce:transition-none",
                transitionPhase === "exiting"
                  ? "translate-y-3 opacity-0"
                  : "translate-y-0 opacity-100"
              )}
            >
              <div>
                <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
                  Step {displayedStep.number} of {STEP_ORDER.length}
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight">
                  {displayedStep.title}
                </h2>
              </div>

              <OnboardingStepAction
                authError={authError}
                isLoading={isLoading}
                isRepoLoading={savedRepos.isLoading}
                isSignedIn={isSignedIn}
                nextPath={nextPath}
                onRepoSelected={setPickedRepo}
                router={router}
                selectedRepo={selectedRepo}
                stepId={displayedStepId}
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function OnboardingProgress({ currentStep }: { currentStep: number }) {
  return (
    <div
      aria-label={`Step ${currentStep} of ${STEP_ORDER.length}`}
      className="grid gap-2"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={STEP_ORDER.length}
      aria-valuenow={currentStep}
    >
      <div className="grid grid-cols-3 gap-2">
        {STEP_ORDER.map((stepId, index) => (
          <span
            aria-hidden
            className={cn(
              "h-1.5 rounded-full transition-colors duration-200",
              index + 1 <= currentStep ? "bg-primary" : "bg-muted"
            )}
            key={stepId}
          />
        ))}
      </div>
    </div>
  )
}

function OnboardingStepAction({
  authError,
  isLoading,
  isRepoLoading,
  isSignedIn,
  nextPath,
  onRepoSelected,
  router,
  selectedRepo,
  stepId,
}: {
  authError: string | null
  isLoading: boolean
  isRepoLoading: boolean
  isSignedIn: boolean
  nextPath: string
  onRepoSelected: (repo: SavedRepository) => void
  router: ReturnType<typeof useRouter>
  selectedRepo: SavedRepository | null
  stepId: OnboardingStepId
}) {
  if (stepId === "github") {
    return (
      <div className="grid gap-4">
        {authError ? (
          <p className="text-sm text-destructive">
            GitHub sign-in failed: {authError.replaceAll("_", " ")}
          </p>
        ) : null}
        {isLoading ? (
          <StatusLine label="Checking session" />
        ) : (
          <div>
            <Button
              onClick={() => loginWithGithub(onboardingReturnPath(nextPath))}
              size="lg"
            >
              <GithubIcon />
              Continue with GitHub
            </Button>
          </div>
        )}
      </div>
    )
  }

  if (stepId === "repo") {
    if (!isSignedIn || isRepoLoading) {
      return <StatusLine label="Loading repositories" />
    }

    return <RepoStep onSelected={onRepoSelected} />
  }

  return <ScanStep router={router} selectedRepo={selectedRepo} />
}

function RepoStep({
  onSelected,
}: {
  onSelected: (repo: SavedRepository) => void
}) {
  const [search, setSearch] = React.useState("")
  const repos = useRepos(true)
  const selectRepo = useSelectRepo()
  const filtered = React.useMemo(() => {
    const list = repos.data ?? []
    const query = search.trim().toLowerCase()
    if (!query) return list

    return list.filter(
      (repo) =>
        repo.fullName.toLowerCase().includes(query) ||
        (repo.description ?? "").toLowerCase().includes(query)
    )
  }, [repos.data, search])
  const pendingId = selectRepo.isPending
    ? selectRepo.variables?.githubRepoId
    : null

  function onPick(repo: GithubRepo) {
    selectRepo.mutate(toSelectPayload(repo), {
      onSuccess: (saved) => {
        onSelected(saved)
      },
    })
  }

  if (repos.isLoading) {
    return <StatusLine label="Loading GitHub repositories" />
  }

  if (repos.isError) {
    return (
      <p className="text-sm text-destructive">
        {(repos.error as Error).message}
      </p>
    )
  }

  return (
    <div className="grid gap-3">
      <div className="relative">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search repositories"
          value={search}
        />
      </div>

      <div className="max-h-80 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            No repositories found.
          </p>
        ) : (
          filtered.map((repo) => {
            const isPending = pendingId === repo.id

            return (
              <button
                className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 py-3 text-left text-sm transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                disabled={selectRepo.isPending}
                key={repo.id}
                onClick={() => onPick(repo)}
                type="button"
              >
                <span className="min-w-0">
                  <span className="flex min-w-0 items-center gap-2 font-medium">
                    <span className="truncate">{repo.fullName}</span>
                    {repo.private ? (
                      <Lock className="size-3.5 shrink-0 text-muted-foreground" />
                    ) : null}
                  </span>
                  {repo.description ? (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {repo.description}
                    </span>
                  ) : null}
                </span>
                {isPending ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                ) : repo.language ? (
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {repo.language}
                  </span>
                ) : null}
              </button>
            )
          })
        )}
      </div>

      {selectRepo.isError ? (
        <p className="text-sm text-destructive">
          {(selectRepo.error as Error).message}
        </p>
      ) : null}
    </div>
  )
}

function ScanStep({
  router,
  selectedRepo,
}: {
  router: ReturnType<typeof useRouter>
  selectedRepo: SavedRepository | null
}) {
  const [website, setWebsite] = React.useState(readStoredScanUrl)
  const updateWebsite = useUpdateRepoWebsite()
  const audit = useAudit()
  const prefilledRepoId = React.useRef<string | null>(null)
  const busy = updateWebsite.isPending || audit.start.isPending

  React.useEffect(() => {
    if (
      selectedRepo?.website &&
      prefilledRepoId.current !== selectedRepo.id &&
      !website.trim()
    ) {
      setWebsite(selectedRepo.website)
      prefilledRepoId.current = selectedRepo.id
    }
  }, [selectedRepo?.id, selectedRepo?.website, website])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = website.trim()
    if (!selectedRepo || !trimmed) {
      return
    }

    try {
      const repository = await updateWebsite.mutateAsync({
        repositoryId: selectedRepo.id,
        website: trimmed,
      })
      const scanUrl = repository.website ?? trimmed
      window.sessionStorage.setItem(URL_STORAGE_KEY, scanUrl)
      await audit.start.mutateAsync({ url: scanUrl, singlePage: false })
      router.push("/website-scan")
    } catch {
      // Mutation errors render inline from React Query state.
    }
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <div className="grid gap-2">
        <Input
          autoFocus
          disabled={busy}
          inputMode="url"
          onChange={(event) => setWebsite(event.target.value)}
          placeholder="https://example.com"
          type="text"
          value={website}
        />
        {selectedRepo ? (
          <p className="text-xs text-muted-foreground">
            {selectedRepo.fullName}
          </p>
        ) : null}
      </div>

      <div>
        <Button disabled={busy || !selectedRepo || !website.trim()} size="lg">
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ScanSearch className="size-4" />
          )}
          Start scan
        </Button>
      </div>

      {updateWebsite.error || audit.start.error ? (
        <p className="text-sm text-destructive">
          {(updateWebsite.error ?? audit.start.error)?.message}
        </p>
      ) : null}
    </form>
  )
}

function StatusLine({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  )
}

function OnboardingLoading() {
  return (
    <main className="grid min-h-svh place-items-center bg-background p-6 text-foreground">
      <div className="grid justify-items-center gap-3">
        <BrandLogo />
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    </main>
  )
}

function getActiveStepId({
  isLoading,
  isSignedIn,
  isRepoLoading,
  selectedRepo,
}: {
  isLoading: boolean
  isSignedIn: boolean
  isRepoLoading: boolean
  selectedRepo: boolean
}): OnboardingStepId {
  if (isLoading || !isSignedIn) return "github"
  if (isRepoLoading || !selectedRepo) return "repo"
  return "scan"
}

function useOnboardingTransition(activeStepId: OnboardingStepId) {
  const [displayedStepId, setDisplayedStepId] =
    React.useState<OnboardingStepId>(activeStepId)
  const [transitionPhase, setTransitionPhase] = React.useState<
    "idle" | "exiting" | "entering"
  >("idle")

  React.useEffect(() => {
    if (activeStepId === displayedStepId) {
      return
    }

    const startTimer = window.setTimeout(() => {
      setTransitionPhase("exiting")
    }, 0)
    const exitTimer = window.setTimeout(() => {
      setDisplayedStepId(activeStepId)
      setTransitionPhase("entering")
    }, 160)
    const settleTimer = window.setTimeout(() => {
      setTransitionPhase("idle")
    }, 360)

    return () => {
      window.clearTimeout(startTimer)
      window.clearTimeout(exitTimer)
      window.clearTimeout(settleTimer)
    }
  }, [activeStepId, displayedStepId])

  return { displayedStepId, transitionPhase }
}

function readStoredScanUrl() {
  if (typeof window === "undefined") return ""
  return window.sessionStorage.getItem(URL_STORAGE_KEY) ?? ""
}

function onboardingReturnPath(nextPath: string) {
  return nextPath === "/"
    ? "/onboarding"
    : `/onboarding?next=${encodeURIComponent(nextPath)}`
}

function safeNextPath(value: string | null) {
  if (!value) return null

  const trimmed = value.trim()
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    /[\r\n]/.test(trimmed)
  ) {
    return null
  }

  return trimmed.slice(0, 512)
}

function toSelectPayload(repo: GithubRepo) {
  return {
    cloneUrl: repo.cloneUrl,
    defaultBranch: repo.defaultBranch,
    description: repo.description,
    fullName: repo.fullName,
    githubRepoId: repo.id,
    htmlUrl: repo.htmlUrl,
    language: repo.language,
    name: repo.name,
    owner: repo.owner.login,
    private: repo.private,
  }
}
