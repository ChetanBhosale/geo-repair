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

export interface ScoreGateCheck {
  rubricId: string;
  status: string | null;
  pointsPossible?: number | null;
}

const COMPLETE_OUTCOMES = new Set([
  "FIXED",
  "SKIPPED_BY_USER",
  "FLAGGED_MANUAL",
  "ALREADY_OK",
]);

const SCORE_LOSS_STATUSES = new Set(["FAILED", "MID"]);

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

export function skippedCheckIdsForPr(checks: CheckReadiness[]): Set<string> {
  return new Set(
    checks
      .filter(
        (check) =>
          check.outcome === "SKIPPED_BY_USER" || check.choice === "DECLINED",
      )
      .map((check) => check.rubricId),
  );
}

export function scoredFailureIdsForPr(
  checks: ScoreGateCheck[],
  readiness: CheckReadiness[],
): string[] {
  const skipped = skippedCheckIdsForPr(readiness);
  return checks
    .filter((check) => {
      if (!check.status || !SCORE_LOSS_STATUSES.has(check.status)) {
        return false;
      }
      if ((check.pointsPossible ?? 1) <= 0) return false;
      return !skipped.has(check.rubricId);
    })
    .map((check) => check.rubricId);
}

export function allScoredFailureIds(checks: ScoreGateCheck[]): string[] {
  return checks
    .filter((check) => {
      if (!check.status || !SCORE_LOSS_STATUSES.has(check.status)) {
        return false;
      }
      return (check.pointsPossible ?? 1) > 0;
    })
    .map((check) => check.rubricId);
}

export function scoreGateBlockersForPr(args: {
  score: number | null | undefined;
  checks: ScoreGateCheck[];
  readiness: CheckReadiness[];
}): string[] {
  const blockers: string[] = [];
  const score = args.score;
  const allFailures = allScoredFailureIds(args.checks);
  const unskippedFailures = scoredFailureIdsForPr(args.checks, args.readiness);
  const scoreLossIsOnlySkipped =
    typeof score === "number" &&
    score !== 100 &&
    allFailures.length > 0 &&
    unskippedFailures.length === 0;

  if (typeof score !== "number") {
    blockers.push("no successful validation scan has recorded an after-score");
  } else if (score !== 100 && !scoreLossIsOnlySkipped) {
    blockers.push(`latest validation score is ${score}/100`);
  }

  for (const rubricId of unskippedFailures) {
    blockers.push(`${rubricId} is still FAILED or MID`);
  }

  return blockers;
}

export function buildScoreGateBlockerMessage(blockers: string[]): string {
  return `PR was not opened because the latest validation has not reached 100/100.\n\nRemaining blocker(s): ${blockers.join(", ")}.`;
}
