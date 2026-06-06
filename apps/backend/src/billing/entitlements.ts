import {
  FIX_ATTEMPT_LIMIT,
  CHAT_MESSAGE_LIMIT,
  SCAN_LIMIT_ANON_PER_DAY,
  SCAN_LIMIT_USER_PER_DAY,
  SCAN_CACHE_TTL_HOURS,
} from "@repo/types/entitlements";

// Re-export the shared limits so backend code has one import for enforcement
// while the dashboard reads the same numbers from @repo/types/entitlements.
export {
  FIX_ATTEMPT_LIMIT,
  CHAT_MESSAGE_LIMIT,
  SCAN_LIMIT_ANON_PER_DAY,
  SCAN_LIMIT_USER_PER_DAY,
  SCAN_CACHE_TTL_HOURS,
};

// Thrown when a request exceeds a plan entitlement. Carries an HTTP status so
// route handlers surface the right code (402 for paid limits, 429 for scans).
export class EntitlementError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "EntitlementError";
  }
}

export function scanLimitFor(signedIn: boolean): number {
  return signedIn ? SCAN_LIMIT_USER_PER_DAY : SCAN_LIMIT_ANON_PER_DAY;
}
