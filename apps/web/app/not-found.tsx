import Link from "next/link"

import { Button } from "@/components/ui/button"
import { CtaButton } from "@/components/analytics/cta-button"

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-24 text-center">
      <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
        404
      </p>
      <h1 className="mt-3 font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-sm/relaxed text-muted-foreground">
        The page you&rsquo;re looking for doesn&rsquo;t exist or has moved. Head
        back home to run a free AI search checkup on your site.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Button asChild>
          <Link href="/">Back home</Link>
        </Button>
        <CtaButton
          href="/#checkup"
          location="404"
          label="Run free checkup"
          variant="ghost"
        />
      </div>
    </div>
  )
}
