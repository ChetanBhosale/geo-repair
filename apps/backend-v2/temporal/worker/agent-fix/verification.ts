import type { RunResult } from "@repo/sandbox";

const MAX_FAILURE_OUTPUT = 800;

export function formatCommandFailure(step: string, result: RunResult): string {
  const output = [result.stderr.trim(), result.stdout.trim()]
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_FAILURE_OUTPUT);

  return output
    ? `${step} failed:\n${output}`
    : `${step} failed with exit code ${result.exitCode}.`;
}

export function buildPrBlockerMessage(reason: string): string {
  return `Build verification failed. PR was not opened.\n\n${reason}`;
}

export function buildNoVerifiedFixesMessage(): string {
  return "No checks were verified as fixed. PR was not opened.";
}

export interface CheckReadiness {
  rubricId: string;
  mode: string;
  choice: string;
  outcome: string;
}

const COMPLETE_OUTCOMES = new Set([
  "FIXED",
  "SKIPPED_BY_USER",
  "FLAGGED_MANUAL",
  "ALREADY_OK",
]);

export function unresolvedCheckIdsForPr(checks: CheckReadiness[]): string[] {
  return checks
    .filter((check) => {
      if (COMPLETE_OUTCOMES.has(check.outcome)) return false;
      if (check.choice === "DECLINED") return false;
      return (
        check.mode === "AUTO" ||
        check.choice === "APPROVED" ||
        check.choice === "PENDING"
      );
    })
    .map((check) => check.rubricId);
}
