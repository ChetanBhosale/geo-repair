"use client";

import * as React from "react";
import { GitBranch, Loader2, LogOut, Wrench, Check } from "lucide-react";
import type { SavedRepository } from "@repo/types/github";
import { useUser, useLogout, loginWithGithub } from "@/hooks/use-auth";
import { useSavedRepos } from "@/hooks/use-repos";
import { useStartFix } from "@/hooks/use-fix";
import { RepoPicker } from "@/components/repo-picker";
import { FixRuns } from "@/components/fix-runs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DashboardPage() {
  const { user, isLoading, isSignedIn } = useUser();
  const logout = useLogout();
  const saved = useSavedRepos();
  const startFix = useStartFix();

  const [showRepos, setShowRepos] = React.useState(false);
  const [selectedRepo, setSelectedRepo] = React.useState<SavedRepository | null>(null);
  const [website, setWebsite] = React.useState("");

  // Pre-load the currently selected repo (selected=true) for returning users.
  React.useEffect(() => {
    if (!selectedRepo && saved.data) {
      const current = saved.data.find((r) => r.selected) ?? null;
      if (current) setSelectedRepo(current);
    }
  }, [saved.data, selectedRepo]);

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  function onStartFix() {
    if (!selectedRepo || !website.trim()) return;
    startFix.mutate({ website: website.trim(), repositoryId: selectedRepo.id });
  }

  const canFix = !!selectedRepo && website.trim().length > 0 && !startFix.isPending;

  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Connect GitHub, pick a repository, and open a fix PR for your site.
          </p>
        </div>
        {isSignedIn ? (
          <Button variant="outline" onClick={() => logout.mutate()} disabled={logout.isPending}>
            <LogOut />
            Sign out
          </Button>
        ) : null}
      </header>

      {!isSignedIn ? (
        <Card>
          <CardHeader>
            <CardTitle>Connect GitHub</CardTitle>
            <CardDescription>
              We request access to read your repositories so you can pick one to fix.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={loginWithGithub}>
              <GitBranch />
              Continue with GitHub
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Step 1: repository */}
          <Card>
            <CardHeader>
              <CardTitle>1. Choose repository</CardTitle>
              <CardDescription>
                {selectedRepo
                  ? "This is the repo we will open the fix PR on."
                  : "Pick the GitHub repo that builds your site."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {selectedRepo ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Check className="size-4 text-emerald-500" />
                    <span className="font-medium">{selectedRepo.fullName}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setShowRepos((s) => !s)}>
                    Change
                  </Button>
                </div>
              ) : (
                <Button onClick={() => setShowRepos(true)} className="w-fit">
                  <GitBranch />
                  Show repositories
                </Button>
              )}

              {showRepos ? (
                <RepoPicker
                  onSelected={(repo) => {
                    setSelectedRepo(repo);
                    setShowRepos(false);
                  }}
                />
              ) : null}
            </CardContent>
          </Card>

          {/* Step 2: website + start */}
          <Card>
            <CardHeader>
              <CardTitle>2. Start the fix</CardTitle>
              <CardDescription>
                Enter the live site this repo builds. We re-scan it, fix the failing checks, and
                open a PR.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="url"
                  placeholder="https://example.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  disabled={startFix.isPending}
                />
                <Button onClick={onStartFix} disabled={!canFix}>
                  {startFix.isPending ? <Loader2 className="animate-spin" /> : <Wrench />}
                  Start fix
                </Button>
              </div>
              {!selectedRepo ? (
                <p className="text-xs text-muted-foreground">Choose a repository first.</p>
              ) : null}
              {startFix.isError ? (
                <p className="text-sm text-destructive">{(startFix.error as Error).message}</p>
              ) : null}
            </CardContent>
          </Card>

          {/* Step 3: live runs */}
          <Card>
            <CardHeader>
              <CardTitle>Fix runs</CardTitle>
              <CardDescription>Live status of your fix runs and their PRs.</CardDescription>
            </CardHeader>
            <CardContent>
              <FixRuns />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
