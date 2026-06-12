"use client"

import * as React from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "@/components/ui/sonner"
import {
  createDashboardQueryClient,
  restoreDashboardQueryCache,
  subscribeDashboardQueryCachePersistence,
} from "@/lib/query-cache-persistence"

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(() => createDashboardQueryClient())

  useIsomorphicLayoutEffect(() => {
    restoreDashboardQueryCache(client)
    return subscribeDashboardQueryCachePersistence(client)
  }, [client])

  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster />
    </QueryClientProvider>
  )
}
