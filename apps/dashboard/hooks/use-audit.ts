"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  createAudit,
  getTemporalStatus,
  getAuditResult,
  type TemporalStatus,
} from "@/lib/api";

const TERMINAL: TemporalStatus["status"][] = [
  "COMPLETED",
  "FAILED",
  "TERMINATED",
  "CANCELED",
  "TIMED_OUT",
  "NOT_FOUND",
];

export function useAudit() {
  const [temporalId, setTemporalId] = React.useState<string | null>(null);

  // 1) Start the audit.
  const start = useMutation({
    mutationFn: ({ url, singlePage }: { url: string; singlePage: boolean }) =>
      createAudit(url, singlePage),
    onSuccess: (data) => {
      setTemporalId(data.temporalId);
    },
  });

  // 2) Poll the workflow status until it reaches a terminal state.
  const status = useQuery({
    queryKey: ["temporal-status", temporalId],
    queryFn: () => getTemporalStatus(temporalId as string),
    enabled: !!temporalId,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s && TERMINAL.includes(s) ? false : 2000;
    },
  });

  // 3) The result key is derived from the completed status, not mirrored into
  //    state via an effect (avoids cascading renders).
  const resultKey =
    status.data?.status === "COMPLETED" ? status.data.result.key : null;

  // 4) Fetch the full saved report.
  const result = useQuery({
    queryKey: ["audit-result", resultKey],
    queryFn: () => getAuditResult(resultKey as string),
    enabled: !!resultKey,
  });

  const statusName = status.data?.status;
  const isPolling = !!temporalId && !!statusName && !TERMINAL.includes(statusName);
  const failed =
    statusName === "FAILED" ||
    statusName === "TERMINATED" ||
    statusName === "CANCELED" ||
    statusName === "TIMED_OUT" ||
    statusName === "NOT_FOUND";

  return {
    start,
    statusName,
    isStarting: start.isPending,
    isPolling,
    failed,
    startError: start.error,
    result: result.data,
    isLoadingResult: result.isLoading && !!resultKey,
  };
}
