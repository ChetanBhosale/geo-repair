"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { MoonIcon, SunIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"

const subscribeMounted = () => () => {}
const getClientMounted = () => true
const getServerMounted = () => false

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = React.useSyncExternalStore(
    subscribeMounted,
    getClientMounted,
    getServerMounted
  )

  const isDark = resolvedTheme === "dark"

  return (
    <Button
      variant="ghost"
      size="icon"
      className="cursor-pointer"
      aria-label="Toggle theme"
      title="Toggle theme (D)"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {mounted && isDark ? (
        <SunIcon className="size-4" />
      ) : (
        <MoonIcon className="size-4" />
      )}
    </Button>
  )
}
