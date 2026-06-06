import type { Request } from "express";
import { prisma } from "@repo/db";
import type { ScanQuota } from "@repo/types/entitlements";
import { scanLimitFor } from "../billing/entitlements";

export type ScanSubject = { scope: "USER" | "IP"; key: string };

function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.ip ?? "unknown";
}

// Who the scan is attributed to: the signed-in user when present, else the IP.
export function scanSubject(req: Request): ScanSubject {
  if (req.userId) return { scope: "USER", key: req.userId };
  return { scope: "IP", key: clientIp(req) };
}

function utcDayStart(now = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function nextUtcDay(now = new Date()): Date {
  const day = utcDayStart(now);
  day.setUTCDate(day.getUTCDate() + 1);
  return day;
}

function snapshot(subject: ScanSubject, used: number): ScanQuota {
  const limit = scanLimitFor(subject.scope === "USER");
  return {
    scope: subject.scope,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    resetsAt: nextUtcDay().toISOString(),
  };
}

// Atomically consume one scan from the subject's daily allowance. Returns the
// post-consume snapshot, or null if the limit was already reached (nothing is
// consumed in that case). The speculative increment + rollback keeps the count
// correct under concurrent requests.
export async function consumeScanQuota(
  subject: ScanSubject,
): Promise<ScanQuota | null> {
  const limit = scanLimitFor(subject.scope === "USER");
  const day = utcDayStart();
  const where = {
    scope_key_day: { scope: subject.scope, key: subject.key, day },
  };

  const usage = await prisma.scanUsage.upsert({
    where,
    create: { scope: subject.scope, key: subject.key, day, count: 1 },
    update: { count: { increment: 1 } },
  });

  if (usage.count > limit) {
    await prisma.scanUsage.update({ where, data: { count: { decrement: 1 } } });
    return null;
  }

  return snapshot(subject, usage.count);
}

// Give back a scan when the run failed to start, so infra errors don't burn the
// visitor's allowance.
export async function refundScanQuota(subject: ScanSubject): Promise<void> {
  const day = utcDayStart();
  await prisma.scanUsage
    .update({
      where: { scope_key_day: { scope: subject.scope, key: subject.key, day } },
      data: { count: { decrement: 1 } },
    })
    .catch(() => {});
}

// Read-only "X scans left today" without consuming.
export async function getScanQuota(subject: ScanSubject): Promise<ScanQuota> {
  const day = utcDayStart();
  const usage = await prisma.scanUsage.findUnique({
    where: { scope_key_day: { scope: subject.scope, key: subject.key, day } },
    select: { count: true },
  });
  return snapshot(subject, usage?.count ?? 0);
}
