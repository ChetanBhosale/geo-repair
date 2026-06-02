"use client"

import Link from "next/link"
import { useState } from "react"
import { ListIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { NAV_LINKS } from "@/lib/navigation"
import { capture } from "@/lib/analytics"
import { Logo } from "./logo"

export function TopNav() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
      <nav
        aria-label="Primary"
        className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6"
      >
        <Link href="/" aria-label="GEO Repair home" className="shrink-0">
          <Logo />
        </Link>

        <ul className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link href="/contact">Contact</Link>
          </Button>
          <Button asChild size="sm">
            <Link
              href="/#checkup"
              onClick={() =>
                capture("cta_clicked", {
                  location: "nav",
                  label: "Run free checkup",
                  href: "/#checkup",
                })
              }
            >
              Run free checkup
            </Link>
          </Button>
        </div>

        <Sheet
          open={open}
          onOpenChange={(next) => {
            if (next) capture("nav_opened")
            setOpen(next)
          }}
        >
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon-sm"
              className="md:hidden"
              aria-label="Open menu"
            >
              <ListIcon />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetTitle className="px-4 pt-4">
              <Logo />
            </SheetTitle>
            <div className="flex flex-col gap-1 p-4">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-none px-2 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/contact"
                onClick={() => setOpen(false)}
                className="rounded-none px-2 py-2 text-sm text-foreground transition-colors hover:bg-muted"
              >
                Contact
              </Link>
              <Button asChild className="mt-3">
                <Link
                  href="/#checkup"
                  onClick={() => {
                    capture("cta_clicked", {
                      location: "nav_mobile",
                      label: "Run free checkup",
                      href: "/#checkup",
                    })
                    setOpen(false)
                  }}
                >
                  Run free checkup
                </Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  )
}
