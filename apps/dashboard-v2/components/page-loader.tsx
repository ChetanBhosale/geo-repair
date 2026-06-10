// Full-screen loading state used while the session is being resolved.
export function PageLoader() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      <div className="size-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
    </div>
  )
}
