import {
  QueryClient,
  type QueryKey,
  type QueryState,
} from "@tanstack/react-query"

const STORAGE_KEY = "geo-repair.dashboard.query-cache.v1"
const MAX_AGE_MS = 30 * 60 * 1000
const PERSISTED_QUERY_ROOTS = new Set([
  "me",
  "accounts",
  "projects",
  "project",
  "project-scraping",
  "project-scrapings",
  "scraping",
  "agent-runs",
  "agent-run",
  "billing-plans",
  "billing-history",
  "billing-order",
  "worker-status",
])

type PersistedQuery = {
  queryKey: QueryKey
  data: unknown
  dataUpdatedAt: number
}

type PersistedCache = {
  savedAt: number
  queries: PersistedQuery[]
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function isPersistableQueryKey(queryKey: QueryKey): boolean {
  const root = queryKey[0]
  return typeof root === "string" && PERSISTED_QUERY_ROOTS.has(root)
}

function isSuccessfulState(state: QueryState<unknown, Error>): boolean {
  return state.status === "success" && state.data != null
}

export function createDashboardQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: MAX_AGE_MS,
        retry: false,
        refetchOnMount: "always",
        refetchOnWindowFocus: false,
        staleTime: 30_000,
      },
    },
  })
  return client
}

export function restoreDashboardQueryCache(client: QueryClient) {
  const store = storage()
  if (!store) return

  try {
    const raw = store.getItem(STORAGE_KEY)
    if (!raw) return

    const parsed = JSON.parse(raw) as PersistedCache
    if (
      !parsed ||
      !Array.isArray(parsed.queries) ||
      Date.now() - parsed.savedAt > MAX_AGE_MS
    ) {
      store.removeItem(STORAGE_KEY)
      return
    }

    for (const query of parsed.queries) {
      if (!isPersistableQueryKey(query.queryKey)) continue
      client.setQueryData(query.queryKey, query.data, {
        updatedAt: query.dataUpdatedAt,
      })
    }
  } catch {
    store.removeItem(STORAGE_KEY)
  }
}

export function persistDashboardQueryCache(client: QueryClient) {
  const store = storage()
  if (!store) return

  const queries = client
    .getQueryCache()
    .getAll()
    .filter(
      (query) =>
        isPersistableQueryKey(query.queryKey) &&
        isSuccessfulState(query.state)
    )
    .map<PersistedQuery>((query) => ({
      queryKey: query.queryKey,
      data: query.state.data,
      dataUpdatedAt: query.state.dataUpdatedAt,
    }))

  try {
    if (queries.length === 0) {
      store.removeItem(STORAGE_KEY)
      return
    }

    store.setItem(
      STORAGE_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        queries,
      } satisfies PersistedCache)
    )
  } catch {
    store.removeItem(STORAGE_KEY)
  }
}

export function subscribeDashboardQueryCachePersistence(client: QueryClient) {
  let timeout: number | null = null

  const flush = () => {
    if (timeout != null) {
      window.clearTimeout(timeout)
      timeout = null
    }
    persistDashboardQueryCache(client)
  }

  const unsubscribe = client.getQueryCache().subscribe(() => {
    if (typeof window === "undefined") return
    if (timeout != null) window.clearTimeout(timeout)
    timeout = window.setTimeout(flush, 150)
  })

  return () => {
    unsubscribe()
    flush()
  }
}

export function clearDashboardQueryCachePersistence() {
  storage()?.removeItem(STORAGE_KEY)
}
