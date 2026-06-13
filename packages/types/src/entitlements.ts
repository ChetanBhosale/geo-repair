// Plan entitlements: what a paid order includes, and how free scans are bounded.
// Single source of truth shared by backend enforcement and dashboard display, so
// the answers to "how many runs / messages / scans" can never disagree.

type AiCreditTier = "STARTER" | "GROWTH" | "SCALE" | "ENTERPRISE_CUSTOM";

// Per paid order.
export const FIX_ATTEMPT_LIMIT = 1;
export const MANUAL_REVALIDATION_LIMIT = 3;

// Follow-up agent work after the first PR spends AI credits. Credits are
// weighted to roughly track provider cost while staying explainable in-product.
export const AI_CREDIT_INPUT_TOKEN_WEIGHT = 1;
export const AI_CREDIT_OUTPUT_TOKEN_WEIGHT = 5;
export const AI_CREDIT_LIMITS_BY_TIER = {
  STARTER: 3_000_000,
  GROWTH: 10_000_000,
  SCALE: 25_000_000,
  ENTERPRISE_CUSTOM: 0,
} as const satisfies Record<AiCreditTier, number>;

// Deprecated compatibility field for old API consumers. The order-level AI
// credit balance is the source of truth.
export const LEGACY_CHAT_MESSAGE_LIMIT = 20;

export function aiCreditLimitForTier(tier: AiCreditTier): number {
  return AI_CREDIT_LIMITS_BY_TIER[tier];
}

export function aiCreditsForUsage(inputTokens: number, outputTokens: number): number {
  const input = Math.max(0, Math.floor(inputTokens));
  const output = Math.max(0, Math.floor(outputTokens));
  return (
    input * AI_CREDIT_INPUT_TOKEN_WEIGHT +
    output * AI_CREDIT_OUTPUT_TOKEN_WEIGHT
  );
}

export function aiCreditsLeft(input: {
  aiCreditsIncluded: number;
  aiCreditsUsed: number;
}): number {
  return Math.max(0, input.aiCreditsIncluded - input.aiCreditsUsed);
}

export function legacyChatMessagesLeftForCredits(input: {
  aiCreditsIncluded: number;
  aiCreditsUsed: number;
}): number {
  const included = Math.max(0, input.aiCreditsIncluded);
  const left = aiCreditsLeft(input);
  if (included <= 0 || left <= 0) return 0;
  return Math.max(1, Math.ceil((left / included) * LEGACY_CHAT_MESSAGE_LIMIT));
}

// Free scans.
export const SCAN_LIMIT_ANON_PER_DAY = 5;
export const SCAN_LIMIT_USER_PER_DAY = 25;
export const SCAN_CACHE_TTL_HOURS = 24;

// Usage snapshot for one paid order (surfaced in billing + the fix workspace).
export interface OrderEntitlements {
  fixAttemptsUsed: number;
  fixAttemptLimit: number;
  aiCreditsUsed: number;
  aiCreditsIncluded: number;
  aiCreditsLeft: number;
  /** @deprecated AI credits are the source of truth for follow-up budget. */
  chatMessagesUsed: number;
  /** @deprecated AI credits are the source of truth for follow-up budget. */
  chatMessageLimit: number;
  manualRevalidationsUsed: number;
  manualRevalidationLimit: number;
}

// Free-scan allowance for the current visitor (signed-in or anonymous).
export interface ScanQuota {
  scope: "IP" | "USER";
  used: number;
  limit: number;
  remaining: number;
  // ISO timestamp for the start of the next day (when the quota resets).
  resetsAt: string;
}
