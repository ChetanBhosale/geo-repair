import { describe, expect, test } from "bun:test";

import {
  aiCreditLimitForTier,
  aiCreditsLeft,
  aiCreditsForUsage,
  FIX_ATTEMPT_LIMIT,
  legacyChatMessagesLeftForCredits,
} from "@repo/types/entitlements";
import { isRunOpen } from "./agent-plan.service";

describe("simplified agent lifecycle", () => {
  test("keeps one paid agent thread with tiered follow-up AI credits", () => {
    expect(FIX_ATTEMPT_LIMIT).toBe(1);
    expect(aiCreditLimitForTier("STARTER")).toBe(3_000_000);
    expect(aiCreditLimitForTier("GROWTH")).toBe(10_000_000);
    expect(aiCreditLimitForTier("SCALE")).toBe(25_000_000);
  });

  test("weights output tokens five times higher than input tokens", () => {
    expect(aiCreditsForUsage(1_000, 1_000)).toBe(6_000);
  });

  test("blocks the next follow-up when credits hit exact zero", () => {
    const budget = { aiCreditsIncluded: 10_000_000, aiCreditsUsed: 10_000_000 };

    expect(aiCreditsLeft(budget)).toBe(0);
    expect(legacyChatMessagesLeftForCredits(budget)).toBe(0);
  });

  test("keeps the thread open when the latest PR is merged or closed", () => {
    expect(
      isRunOpen({
        status: "PR_OPENED",
        prState: "MERGED",
        prUrl: "https://github.com/acme/site/pull/1",
        prMerged: true,
      }),
    ).toBe(true);
    expect(
      isRunOpen({
        status: "PR_OPENED",
        prState: "CLOSED",
        prUrl: "https://github.com/acme/site/pull/1",
        prMerged: false,
      }),
    ).toBe(true);
    expect(
      isRunOpen({
        status: "COMPLETED",
        prState: "MERGED",
        prUrl: "https://github.com/acme/site/pull/1",
        prMerged: true,
      }),
    ).toBe(true);
  });

  test("only failed, canceled, or no-PR completed runs are terminal", () => {
    expect(
      isRunOpen({
        status: "FAILED",
        prState: "OPEN",
        prUrl: "https://github.com/acme/site/pull/1",
      }),
    ).toBe(false);
    expect(
      isRunOpen({
        status: "CANCELED",
        prState: "OPEN",
        prUrl: "https://github.com/acme/site/pull/1",
      }),
    ).toBe(false);
    expect(
      isRunOpen({
        status: "COMPLETED",
        prState: "NONE",
        prUrl: null,
      }),
    ).toBe(false);
  });
});
