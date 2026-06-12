"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ShieldCheckIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { BrandLogo } from "@/components/brand-logo"
import { useAuth, loginWithGoogle } from "@/hooks/use-auth"
import { PageLoader } from "@/components/page-loader"
import { GoogleIcon } from "@/components/icons/google-icon"
import { safeDashboardRedirectPath } from "@/lib/auth-redirect"

export default function SignInPage() {
  const router = useRouter()
  const { isLoading, isSignedIn } = useAuth()

  function redirectPath() {
    if (typeof window === "undefined") return "/dashboard"
    return safeDashboardRedirectPath(
      new URLSearchParams(window.location.search).get("next")
    )
  }

  React.useEffect(() => {
    if (!isLoading && isSignedIn) {
      router.replace(redirectPath())
    }
  }, [isLoading, isSignedIn, router])

  if (isLoading || isSignedIn) {
    return <PageLoader />
  }

  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden bg-background px-4 py-10 text-foreground">
      {/* Subtle dotted texture, theme-aware and low contrast. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(var(--primary) 1px, transparent 1.2px)",
          backgroundSize: "16px 16px",
          maskImage:
            "radial-gradient(120% 80% at 50% 0%, black 0%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(120% 80% at 50% 0%, black 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <BrandLogo />
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <p className="font-mono text-[11px] tracking-widest text-primary uppercase">
            AI Search Optimization
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">
            Sign in to your workspace
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Continue with Google to manage your projects, scans, and fixes.
          </p>

          <Button
            className="mt-6 w-full"
            size="lg"
            variant="outline"
            onClick={() => loginWithGoogle(redirectPath())}
          >
            <GoogleIcon className="size-4" />
            Sign in with Google
          </Button>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            By continuing you agree to our terms and privacy policy.
          </p>
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheckIcon className="size-3.5 text-primary" />
          Zero data retention. Only the repo you pick is touched.
        </p>
      </div>
    </main>
  )
}
