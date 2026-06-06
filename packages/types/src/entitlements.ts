// Plan entitlements: what a paid order includes, and how free scans are bounded.
// Single source of truth shared by backend enforcement and dashboard display, so
// the answers to "how many runs / messages / scans" can never disagree.

// Per paid order.
export const FIX_ATTEMPT_LIMIT = 3;
export const CHAT_MESSAGE_LIMIT = 20;

// Free scans.
export const SCAN_LIMIT_ANON_PER_DAY = 5;
export const SCAN_LIMIT_USER_PER_DAY = 25;
export const SCAN_CACHE_TTL_HOURS = 24;

// Usage snapshot for one paid order (surfaced in billing + the fix workspace).
export interface OrderEntitlements {
  fixAttemptsUsed: number;
  fixAttemptLimit: number;
  chatMessagesUsed: number;
  chatMessageLimit: number;
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
