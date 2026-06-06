import { test, expect } from "bun:test";
import {
  FIX_ATTEMPT_LIMIT,
  CHAT_MESSAGE_LIMIT,
  SCAN_LIMIT_ANON_PER_DAY,
  SCAN_LIMIT_USER_PER_DAY,
  SCAN_CACHE_TTL_HOURS,
  scanLimitFor,
  EntitlementError,
} from "./entitlements";

// These are the contractual answers to "how many runs / messages / scans" the
// product promises. A test guards them so they can't drift silently.
test("plan entitlement limits are the agreed values", () => {
  expect(FIX_ATTEMPT_LIMIT).toBe(3);
  expect(CHAT_MESSAGE_LIMIT).toBe(20);
  expect(SCAN_LIMIT_ANON_PER_DAY).toBe(5);
  expect(SCAN_LIMIT_USER_PER_DAY).toBe(25);
  expect(SCAN_CACHE_TTL_HOURS).toBe(24);
});

test("scanLimitFor: signed-in users get the higher daily allowance", () => {
  expect(scanLimitFor(false)).toBe(SCAN_LIMIT_ANON_PER_DAY);
  expect(scanLimitFor(true)).toBe(SCAN_LIMIT_USER_PER_DAY);
  expect(scanLimitFor(true)).toBeGreaterThan(scanLimitFor(false));
});

test("EntitlementError carries an HTTP status", () => {
  const err = new EntitlementError(402, "limit reached");
  expect(err.status).toBe(402);
  expect(err.message).toBe("limit reached");
  expect(err instanceof Error).toBe(true);
});
