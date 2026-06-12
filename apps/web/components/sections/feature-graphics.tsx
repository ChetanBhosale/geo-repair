import { GitPullRequestIcon } from "@phosphor-icons/react/ssr"

import { DEMO_CATEGORY_SUBSCORES, DEMO_SCORE } from "@/lib/demo-data"
import { ScoreRing } from "@/components/demo/score-ring"
import { CategoryBar } from "@/components/demo/category-bar"

export function ScoreGraphic() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <div className="flex items-center gap-4">
        <ScoreRing score={DEMO_SCORE} size={88} />
        <div className="flex-1">
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            Readiness
          </p>
          <p className="font-heading text-sm font-medium text-foreground">
            26 checks · 7 categories
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {DEMO_CATEGORY_SUBSCORES.slice(0, 4).map((subscore) => (
          <CategoryBar key={subscore.category} subscore={subscore} />
        ))}
      </div>
    </div>
  )
}

export function JsonLdGraphic() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
        Added to &lt;head&gt;
      </p>
      <pre className="overflow-hidden bg-foreground/[0.04] p-3 font-mono text-[10px]/relaxed text-foreground/80">
        <code>{`<script type="application/ld+json">
{
  "@type": "Article",
  "headline": "…",
  "author": { "@type": "Person" },
  "datePublished": "2026-05-12"
}
</script>`}</code>
      </pre>
    </div>
  )
}

export function PrGraphic() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <div className="flex items-center gap-2">
        <GitPullRequestIcon
          weight="bold"
          className="size-4 text-success"
          aria-hidden
        />
        <span className="font-mono text-[11px] font-medium text-foreground">
          ai-search-readiness
        </span>
      </div>
      <ul className="flex flex-col gap-1.5 font-mono text-[10px]">
        {[
          ["app/layout.tsx", "+48", "−2"],
          ["app/robots.ts", "+14", "−3"],
          ["public/llms.txt", "+21", "−0"],
        ].map(([path, add, del]) => (
          <li key={path} className="flex items-center justify-between gap-2">
            <span className="truncate text-foreground/80">{path}</span>
            <span className="shrink-0 tabular-nums">
              <span className="text-success">{add}</span>{" "}
              <span className="text-destructive">{del}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3 border-t border-foreground/10 pt-2 font-mono text-[10px] text-success">
        <span>✓ build</span>
        <span>✓ types</span>
      </div>
    </div>
  )
}
