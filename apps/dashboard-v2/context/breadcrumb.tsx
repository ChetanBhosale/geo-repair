"use client"

import * as React from "react"

export interface Crumb {
  label: string
  href?: string
}

interface BreadcrumbContextValue {
  items: Crumb[] | null
  setItems: (items: Crumb[] | null) => void
}

const BreadcrumbContext = React.createContext<BreadcrumbContextValue | null>(
  null
)

export function BreadcrumbProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [items, setItems] = React.useState<Crumb[] | null>(null)
  const value = React.useMemo(() => ({ items, setItems }), [items])
  return (
    <BreadcrumbContext.Provider value={value}>
      {children}
    </BreadcrumbContext.Provider>
  )
}

export function useBreadcrumbState() {
  const ctx = React.useContext(BreadcrumbContext)
  if (!ctx) throw new Error("useBreadcrumbState requires BreadcrumbProvider")
  return ctx
}

// Set the header breadcrumb for the current page. Clears on unmount.
export function useBreadcrumbs(items: Crumb[]) {
  const { setItems } = useBreadcrumbState()
  const key = items.map((i) => `${i.label}:${i.href ?? ""}`).join("|")
  React.useEffect(() => {
    setItems(items)
    return () => setItems(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setItems])
}
