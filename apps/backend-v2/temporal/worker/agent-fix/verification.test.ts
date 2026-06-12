import { describe, expect, test } from "bun:test";

import {
  buildNoVerifiedFixesMessage,
  buildPrBlockerMessage,
  formatCommandFailure,
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
});
