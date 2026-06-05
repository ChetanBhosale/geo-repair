"use client";

import * as React from "react";
import { Loader2, GitBranch, ArrowRight } from "lucide-react";
import { useAudit } from "@/hooks/use-audit";
import { useUser, loginWithGithub } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuditReport } from "@/components/audit-report";

export default function Page() {
  const [url, setUrl] = React.useState("");
  const audit = useAudit();
  const { isSignedIn, isLoading: isUserLoading } = useUser();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    audit.start.mutate({ url: trimmed, singlePage: false });
  }

  const busy = audit.isStarting || audit.isPolling || audit.isLoadingResult;

  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">AI Search Readiness</h1>
          <p className="text-sm text-muted-foreground">
            Enter a website to audit how well it is understood by AI search engines.
          </p>
        </div>

        {/* GitHub auth: connect when signed out, go to dashboard when signed in. */}
        {!isUserLoading ? (
          isSignedIn ? (
            <Button variant="outline" asChild>
              <a href="/dashboard">
                Dashboard
                <ArrowRight />
              </a>
            </Button>
          ) : (
            <Button variant="outline" onClick={loginWithGithub}>
              <GitBranch />
              Connect GitHub
            </Button>
          )
        ) : null}
      </header>

      <form onSubmit={onSubmit} className="flex gap-2">
        <Input
          type="text"
          inputMode="url"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={busy}
          autoFocus
        />
        <Button type="submit" disabled={busy || !url.trim()}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          {audit.isStarting
            ? "Starting"
            : audit.isPolling
              ? "Auditing"
              : audit.isLoadingResult
                ? "Loading"
                : "Audit"}
        </Button>
      </form>

      {/* Status line */}
      {audit.startError ? (
        <p className="text-sm text-destructive">{audit.startError.message}</p>
      ) : null}

      {audit.isPolling ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Running audit, this can take a moment for larger sites…
        </p>
      ) : null}

      {audit.failed ? (
        <p className="text-sm text-destructive">
          The audit did not complete ({audit.statusName?.toLowerCase()}). Please try again.
        </p>
      ) : null}

      {/* Result */}
      {audit.result?.report ? <AuditReport report={audit.result.report} /> : null}
    </div>
  );
}
