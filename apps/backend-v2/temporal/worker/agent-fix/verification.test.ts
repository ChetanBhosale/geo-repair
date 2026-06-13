import { describe, expect, test } from "bun:test";

import {
  buildNoVerifiedFixesMessage,
  buildPrBlockerMessage,
  buildScoreGateBlockerMessage,
  formatCommandFailure,
  scoreGateBlockersForPr,
  unresolvedCheckIdsForPr,
} from "./verification";

describe("agent fix verification gate", () => {
  test("formats command failures with stderr before stdout", () => {
    expect(
      formatCommandFailure("Build", {
        exitCode: 137,
        stdout: "stdout detail",
        stderr: "stderr detail",
      }),
    ).toBe("Build failed:\nstderr detail\nstdout detail");
  });

  test("makes build failure a PR blocker", () => {
    expect(
      buildPrBlockerMessage(
        "Build failed:\nerror: script exited with code 137",
      ),
    ).toBe(
      "Build verification failed. PR was not opened.\n\nBuild failed:\nerror: script exited with code 137",
    );
  });

  test("blocks PRs when no check ended up verified", () => {
    expect(buildNoVerifiedFixesMessage()).toBe(
      "No checks were verified as fixed. PR was not opened.",
    );
  });

  test("blocks PRs until every approved check is fixed or skipped", () => {
    expect(
      unresolvedCheckIdsForPr([
        {
          rubricId: "answerability",
          mode: "AUTO",
          choice: "APPROVED",
          outcome: "FAILED",
        },
        {
          rubricId: "definitions",
          mode: "NEEDS_INPUT",
          choice: "DECLINED",
          outcome: "SKIPPED_BY_USER",
        },
        {
          rubricId: "content-negotiation",
          mode: "AUTO",
          choice: "APPROVED",
          outcome: "FIXED",
        },
      ]),
    ).toEqual(["answerability"]);
  });

  test("blocks PRs when the latest validation score is below 100", () => {
    expect(
      scoreGateBlockersForPr({
        score: 90,
        checks: [
          {
            rubricId: "markdown-twin",
            status: "FAILED",
            pointsPossible: 12,
          },
        ],
        readiness: [
          {
            rubricId: "markdown-twin",
            mode: "AUTO",
            choice: "APPROVED",
            outcome: "FAILED",
          },
        ],
      }),
    ).toEqual([
      "latest validation score is 90/100",
      "markdown-twin is still FAILED or MID",
    ]);
  });

  test("blocks non-100 PRs even when no approved checks are left", () => {
    expect(
      scoreGateBlockersForPr({
        score: 85,
        checks: [
          {
            rubricId: "structured-data",
            status: "FAILED",
            pointsPossible: 10,
          },
        ],
        readiness: [],
      }),
    ).toEqual([
      "latest validation score is 85/100",
      "structured-data is still FAILED or MID",
    ]);
  });

  test("allows a non-100 score only when all scored failures were skipped by the user", () => {
    expect(
      scoreGateBlockersForPr({
        score: 85,
        checks: [
          {
            rubricId: "ssr-visibility",
            status: "FAILED",
            pointsPossible: 30,
          },
        ],
        readiness: [
          {
            rubricId: "ssr-visibility",
            mode: "NEEDS_INPUT",
            choice: "DECLINED",
            outcome: "SKIPPED_BY_USER",
          },
        ],
      }),
    ).toEqual([]);
  });

  test("blocks PRs when no validation score has been recorded", () => {
    const blockers = scoreGateBlockersForPr({
      score: null,
      checks: [],
      readiness: [],
    });

    expect(blockers).toEqual([
      "no successful validation scan has recorded an after-score",
    ]);
    expect(buildScoreGateBlockerMessage(blockers)).toContain(
      "latest validation has not reached 100/100",
    );
  });
});
