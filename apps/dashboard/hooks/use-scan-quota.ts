"use client"

import { useQuery } from "@tanstack/react-query"
import { getScanQuota } from "@/lib/api"

// The signed-in user's remaining free scans for today.
export function useScanQuota(enabled = true) {
  return useQuery({
    queryKey: ["scan-quota"],
    queryFn: getScanQuota,
    enabled,
  })
}
