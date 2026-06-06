"use client"

import * as React from "react"
import { QueryClient } from "@tanstack/react-query"
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client"
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister"

// Keep cached data around long enough that a browser refresh rehydrates the
// previous screen instantly and refetches in the background, instead of
// blanking out to loading/empty states.
const ONE_DAY = 1000 * 60 * 60 * 24

// On the server (SSR) there is no localStorage; persistence is a no-op there and
// kicks in once we're in the browser.
const noopStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: false,
            staleTime: 30_000,
            gcTime: ONE_DAY,
          },
        },
      })
  )

  const [persister] = React.useState(() =>
    createSyncStoragePersister({
      storage: typeof window === "undefined" ? noopStorage : window.localStorage,
      key: "geo-repair-query-cache",
    })
  )

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{ persister, maxAge: ONE_DAY }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}
