"use client"

import { motion, useReducedMotion } from "framer-motion"
import { RobotIcon } from "@phosphor-icons/react/ssr"

import type { RubricCategory } from "@/lib/rubric-meta"
import { cn } from "@/lib/utils"
import {
  OpenAIGlyph,
  ClaudeGlyph,
  PerplexityGlyph,
  GoogleGlyph,
} from "./crawler-logos"

// Each rubric category is a small looping "recording" of the real thing the
// check is about. Framer Motion, decorative (aria-hidden), reduced-motion safe.

const EASE = [0.32, 0.72, 0, 1] as const
const RED = "rgba(214, 60, 60, 0.85)"
const GREEN = "rgba(18, 140, 96, 0.9)"
const CLEAR = "rgba(18, 140, 96, 0)"

function Tile({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative aspect-video w-full overflow-hidden bg-muted/60 p-4 font-mono text-[10px] leading-relaxed text-muted-foreground",
        className
      )}
    >
      {children}
    </div>
  )
}

// 1. Rendering — a crawler arrives and scans the content in the raw HTML.
function Rendering() {
  const reduce = useReducedMotion()
  return (
    <Tile className="flex items-center justify-center gap-4">
      <motion.div
        className="flex shrink-0 flex-col items-center gap-1 text-primary"
        animate={
          reduce
            ? { x: 0, opacity: 1 }
            : { x: [-24, 0, 0, -24], opacity: [0, 1, 1, 0] }
        }
        transition={
          reduce
            ? { duration: 0 }
            : {
                duration: 6,
                times: [0, 0.16, 0.84, 1],
                repeat: Infinity,
                ease: EASE,
              }
        }
      >
        <RobotIcon weight="fill" className="size-6" />
        <span className="text-[9px]">GPTBot</span>
      </motion.div>

      <div className="relative w-[60%] overflow-hidden rounded-md border border-border bg-card px-2.5 py-2">
        <div className="text-[11px] font-medium text-foreground">
          AI Search Optimization
        </div>
        <div className="mt-1.5">Run a free checkup that</div>
        <div>scores your site for AI.</div>
        <motion.div
          className="pointer-events-none absolute inset-x-0 h-6 bg-[linear-gradient(180deg,color-mix(in_oklch,var(--primary),transparent_65%),transparent)]"
          animate={
            reduce
              ? { opacity: 0 }
              : { top: ["-10%", "-10%", "100%", "100%"], opacity: [0, 1, 1, 0] }
          }
          transition={
            reduce
              ? { duration: 0 }
              : {
                  duration: 6,
                  times: [0.24, 0.34, 0.74, 0.82],
                  repeat: Infinity,
                  ease: "easeInOut",
                }
          }
        />
      </div>
    </Tile>
  )
}

// 2. Structured data — a blog screen gets annotated, row by aligned row.
function StructuredData() {
  const reduce = useReducedMotion()
  const win = 1.7
  const cycle = 3 * win
  const rows = [
    {
      label: "headline",
      el: (
        <span className="text-[11px] font-medium text-foreground">
          What is AEO?
        </span>
      ),
    },
    {
      label: "author",
      el: <span className="text-[9px]">By GEO Repair · May 2026</span>,
    },
    {
      label: "articleBody",
      el: (
        <span className="block leading-snug">
          Answer engines read your page and quote it back directly.
        </span>
      ),
    },
  ]
  return (
    <Tile className="flex items-center justify-center whitespace-normal">
      <div className="w-[86%] space-y-2 rounded-md border border-border bg-card p-3">
        {rows.map((r, i) => (
          <div key={r.label} className="relative w-fit max-w-full">
            {r.el}
            <motion.span
              className="absolute -inset-x-1.5 -inset-y-1 rounded-sm border border-dashed border-primary"
              animate={reduce ? { opacity: i === 0 ? 1 : 0 } : { opacity: [0, 1, 1, 0] }}
              transition={
                reduce
                  ? { duration: 0 }
                  : {
                      duration: win,
                      times: [0, 0.16, 0.74, 1],
                      repeat: Infinity,
                      repeatDelay: cycle - win,
                      delay: i * win,
                      ease: EASE,
                    }
              }
            >
              <motion.span
                className="absolute -top-[7px] left-1.5 rounded-sm bg-primary px-1 text-[8px] text-primary-foreground"
                animate={reduce ? { opacity: i === 0 ? 1 : 0 } : { opacity: [0, 1, 1, 0] }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : {
                        duration: win,
                        times: [0, 0.16, 0.74, 1],
                        repeat: Infinity,
                        repeatDelay: cycle - win,
                        delay: i * win,
                      }
                }
              >
                {r.label}
              </motion.span>
            </motion.span>
          </div>
        ))}
      </div>
    </Tile>
  )
}

// 3. Metadata — base HTML, then meta tags type in one by one.
function Metadata() {
  const reduce = useReducedMotion()
  const lines = [
    `  <meta name="description">`,
    `  <meta property="og:title">`,
    `  <link rel="canonical">`,
  ]
  return (
    <Tile className="flex flex-col justify-center gap-1 whitespace-pre">
      <span className="text-muted-foreground">{"<head>"}</span>
      <span className="text-foreground">{"  <title>GEO Repair</title>"}</span>
      {lines.map((line, i) => {
        const start = 0.16 + i * 0.18
        return (
          <motion.span
            key={i}
            className="block overflow-hidden text-foreground"
            animate={
              reduce
                ? { clipPath: "inset(0 0 0 0)" }
                : {
                    clipPath: [
                      "inset(0 100% 0 0)",
                      "inset(0 100% 0 0)",
                      "inset(0 0 0 0)",
                      "inset(0 0 0 0)",
                      "inset(0 100% 0 0)",
                    ],
                  }
            }
            transition={
              reduce
                ? { duration: 0 }
                : {
                    duration: 6,
                    times: [0, start, start + 0.12, 0.9, 1],
                    repeat: Infinity,
                    ease: "linear",
                  }
            }
          >
            {line}
          </motion.span>
        )
      })}
      <span className="text-muted-foreground">{"</head>"}</span>
    </Tile>
  )
}

// 4. Crawl surface — the AI crawlers get invited in, one by one.
function CrawlSurface() {
  const reduce = useReducedMotion()
  const bots = [
    { Logo: OpenAIGlyph, name: "ChatGPT", ua: "GPTBot" },
    { Logo: ClaudeGlyph, name: "Claude", ua: "ClaudeBot" },
    { Logo: PerplexityGlyph, name: "Perplexity", ua: "PerplexityBot" },
    { Logo: GoogleGlyph, name: "Google", ua: "Google-Extended" },
  ]
  const cycle = 5.5
  return (
    <Tile className="flex flex-col justify-center gap-2">
      {bots.map((b, i) => {
        const Logo = b.Logo
        const start = (0.6 + i * 0.55) / cycle
        return (
          <div key={b.ua} className="flex items-center gap-2">
            <span className="inline-flex w-4 shrink-0 justify-center">
              <Logo className="h-4 w-auto max-w-4 object-contain" />
            </span>
            <span className="text-[10px] text-foreground">{b.name}</span>
            <span className="truncate text-[8px] text-muted-foreground">
              {b.ua}
            </span>
            <motion.span
              className="ml-auto inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] text-primary"
              animate={
                reduce
                  ? { opacity: 1, scale: 1 }
                  : { opacity: [0, 0, 1, 1, 0], scale: [0.4, 0.4, 1.12, 1, 0.4] }
              }
              transition={
                reduce
                  ? { duration: 0 }
                  : {
                      duration: cycle,
                      times: [0, start, start + 0.07, 0.9, 1],
                      repeat: Infinity,
                      ease: EASE,
                    }
              }
            >
              ✓ Allow
            </motion.span>
          </div>
        )
      })}
    </Tile>
  )
}

// 5. Semantics — two H1s, the duplicate is flagged, then demoted to H2.
function Semantics() {
  const reduce = useReducedMotion()
  const D = 6
  const fade = (times: number[], values: number[]) => ({
    animate: reduce ? { opacity: 0 } : { opacity: values },
    transition: reduce
      ? { duration: 0 }
      : { duration: D, times, repeat: Infinity },
  })
  return (
    <Tile className="flex flex-col justify-center gap-2">
      <div className="flex items-center gap-2">
        <span className="inline-flex w-7 justify-center rounded-sm bg-border py-0.5 text-[9px] text-foreground">
          H1
        </span>
        <span className="text-[12px] font-medium text-foreground">
          Your Page Title
        </span>
      </div>
      <div className="pl-1 text-[9px]">A short intro paragraph…</div>

      <motion.div
        className="flex items-center gap-2 rounded-sm border px-1.5 py-1"
        animate={
          reduce
            ? { borderColor: GREEN }
            : { borderColor: [CLEAR, CLEAR, RED, RED, GREEN, GREEN, CLEAR] }
        }
        transition={
          reduce
            ? { duration: 0 }
            : {
                duration: D,
                times: [0, 0.24, 0.3, 0.5, 0.58, 0.9, 1],
                repeat: Infinity,
              }
        }
      >
        <span className="relative inline-flex h-4 w-7 shrink-0 justify-center">
          {reduce ? (
            <span className="inline-flex w-7 items-center justify-center rounded-sm bg-primary/15 py-0.5 text-[9px] text-primary">
              H2
            </span>
          ) : (
            <>
              <motion.span
                className="absolute inset-0 inline-flex items-center justify-center rounded-sm bg-border text-[9px] text-foreground"
                {...fade([0, 0.24, 0.3, 0.9, 1], [1, 1, 0, 0, 1])}
              >
                H1
              </motion.span>
              <motion.span
                className="absolute inset-0 inline-flex items-center justify-center rounded-sm bg-destructive/15 text-[9px] text-destructive"
                {...fade([0, 0.28, 0.32, 0.56, 0.6], [0, 0, 1, 1, 0])}
              >
                H1
              </motion.span>
              <motion.span
                className="absolute inset-0 inline-flex items-center justify-center rounded-sm bg-primary/15 text-[9px] text-primary"
                {...fade([0, 0.58, 0.62, 0.9, 1], [0, 0, 1, 1, 0])}
              >
                H2
              </motion.span>
            </>
          )}
        </span>
        <span className="text-[12px] font-medium text-foreground">
          Our Mission
        </span>
        {!reduce && (
          <span className="relative ml-auto h-3 w-16 shrink-0 text-right text-[8px]">
            <motion.span
              className="absolute inset-0 text-destructive"
              {...fade([0, 0.3, 0.34, 0.56, 0.6], [0, 0, 1, 1, 0])}
            >
              duplicate H1
            </motion.span>
            <motion.span
              className="absolute inset-0 text-primary"
              {...fade([0, 0.6, 0.64, 0.9, 1], [0, 0, 1, 1, 0])}
            >
              ✓ fixed
            </motion.span>
          </span>
        )}
      </motion.div>
    </Tile>
  )
}

// 6. Content — a phrase becomes a link, then a citation footnote drops in.
function Content() {
  const reduce = useReducedMotion()
  return (
    <Tile className="flex flex-col justify-center gap-2.5 whitespace-normal">
      <div className="text-[11px] text-foreground">
        Backed by{" "}
        <span className="relative whitespace-nowrap text-primary">
          primary research
          <motion.span
            className="absolute -bottom-0.5 left-0 h-px bg-primary"
            animate={reduce ? { width: "100%" } : { width: ["0%", "100%", "100%", "0%"] }}
            transition={
              reduce
                ? { duration: 0 }
                : {
                    duration: 5.5,
                    times: [0.12, 0.34, 0.82, 0.95],
                    repeat: Infinity,
                    ease: EASE,
                  }
            }
          />
        </span>{" "}
        and open standards.
      </div>
      <motion.div
        className="rounded-sm border-l-2 border-primary bg-card px-2.5 py-1.5 text-[9px] leading-relaxed"
        animate={reduce ? { opacity: 1, y: 0 } : { opacity: [0, 0, 1, 1, 0], y: [10, 10, 0, 0, 10] }}
        transition={
          reduce
            ? { duration: 0 }
            : {
                duration: 5.5,
                times: [0, 0.42, 0.52, 0.86, 1],
                repeat: Infinity,
                ease: EASE,
              }
        }
      >
        <div className="text-muted-foreground">[1] schema.org ↗</div>
        <div className="text-muted-foreground">[2] W3C WCAG ↗</div>
      </motion.div>
    </Tile>
  )
}

// 7. Answerability — a question, then a rich answer streams in line by line.
function Answerability() {
  const reduce = useReducedMotion()
  const answer = [
    "We run a free AI-search checkup,",
    "then ship a PR that fixes the",
    "issues, not just a list of them.",
  ]
  return (
    <Tile className="flex flex-col justify-center gap-2 whitespace-normal">
      <div className="flex gap-2">
        <span className="h-fit rounded-sm bg-border px-1.5 py-0.5 text-[10px] text-foreground">
          Q
        </span>
        <span className="text-[11px] text-foreground">
          What does your business do?
        </span>
      </div>
      <div className="flex gap-2">
        <span className="h-fit rounded-sm bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
          A
        </span>
        <div className="flex-1 space-y-0.5">
          {answer.map((line, i) => {
            const start = 0.16 + i * 0.16
            return (
              <motion.div
                key={i}
                className="overflow-hidden whitespace-nowrap"
                animate={
                  reduce
                    ? { clipPath: "inset(0 0 0 0)" }
                    : {
                        clipPath: [
                          "inset(0 100% 0 0)",
                          "inset(0 100% 0 0)",
                          "inset(0 0 0 0)",
                          "inset(0 0 0 0)",
                          "inset(0 100% 0 0)",
                        ],
                      }
                }
                transition={
                  reduce
                    ? { duration: 0 }
                    : {
                        duration: 6,
                        times: [0, start, start + 0.12, 0.9, 1],
                        repeat: Infinity,
                        ease: "linear",
                      }
                }
              >
                {line}
              </motion.div>
            )
          })}
        </div>
      </div>
    </Tile>
  )
}

const GRAPHICS: Record<RubricCategory, () => React.ReactElement> = {
  Rendering,
  "Structured data": StructuredData,
  Metadata,
  "Crawl surface": CrawlSurface,
  Semantics,
  Content,
  Answerability,
}

export function RubricGraphic({ category }: { category: RubricCategory }) {
  const Graphic = GRAPHICS[category]
  return <Graphic />
}
