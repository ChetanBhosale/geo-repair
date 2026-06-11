import { LogoMark } from "@/components/logo-mark"

// Full-screen loading state used while the session is being resolved.
export function PageLoader() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-5 bg-background">
      <LogoMark className="size-9 animate-pulse text-primary" />
      <div className="size-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
    </div>
  )
}
