"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  ChartLineUpIcon,
  CreditCardIcon,
  FolderIcon,
  LifebuoyIcon,
  SignOutIcon,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { BrandLogo } from "@/components/brand-logo"
import { useAuth, useLogout } from "@/hooks/use-auth"

type NavItem = {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string; weight?: "fill" | "regular" }>
}

const MAIN_NAV: NavItem[] = [
  { label: "Projects", href: "/dashboard/projects", icon: FolderIcon },
  {
    label: "AI Visibility",
    href: "/dashboard/ai-visibility",
    icon: ChartLineUpIcon,
  },
]

const ACCOUNT_NAV: NavItem[] = [
  { label: "Purchase", href: "/dashboard/purchase", icon: CreditCardIcon },
  { label: "Support", href: "/dashboard/support", icon: LifebuoyIcon },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const logout = useLogout()

  return (
    <aside className="sticky top-0 flex h-svh w-60 shrink-0 flex-col border-r border-border bg-sidebar">
      {/* Brand header */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <Link href="/dashboard/projects" aria-label="GEO Repair">
          <BrandLogo />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-2 pb-2 font-mono text-[10px] font-medium tracking-widest text-muted-foreground/70 uppercase">
          Workspace
        </p>
        <div className="space-y-0.5">
          {MAIN_NAV.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>

        <p className="mt-6 px-2 pb-2 font-mono text-[10px] font-medium tracking-widest text-muted-foreground/70 uppercase">
          Account
        </p>
        <div className="space-y-0.5">
          {ACCOUNT_NAV.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
      </nav>

      {/* Footer: user profile */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-accent/60">
          <div className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-xs font-medium text-primary">
            {user?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              (user?.name ?? user?.email ?? "U").slice(0, 1).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {user?.name ?? "Account"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user?.email ?? ""}
            </p>
          </div>
          <button
            aria-label="Sign out"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            disabled={logout.isPending}
            onClick={() =>
              logout.mutate(undefined, {
                onSuccess: () => router.replace("/sign-in"),
              })
            }
          >
            <SignOutIcon className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = pathname.startsWith(item.href)
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        active
          ? "bg-accent font-medium text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      )}
    >
      <Icon className="size-4" weight={active ? "fill" : "regular"} />
      {item.label}
    </Link>
  )
}
