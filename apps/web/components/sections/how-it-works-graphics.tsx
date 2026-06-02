"use client"

import {
  CheckCircleIcon,
  GitBranchIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react/ssr"
import { motion, useReducedMotion } from "framer-motion"
import type { Transition } from "framer-motion"

import { cn } from "@/lib/utils"

// Small, code-built replicas of the real product surfaces (checkup → report →
// PR), animated with Framer Motion. Decorative (aria-hidden) and reduced-motion
// safe: when motion is off, each graphic renders its completed end state. Every
// tile loops on the same ~4.5s clock so the three cards breathe together.

const LOOP = 4.5
const EASE = [0.32, 0.72, 0, 1] as const

function loop(extra?: Partial<Transition>): Transition {
  return { duration: LOOP, repeat: Infinity, ease: EASE, ...extra }
}

function Frame({
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
        "relative aspect-video w-full overflow-hidden bg-muted/60 p-4",
        className
      )}
    >
      {children}
    </div>
  )
}

const SCAN_ROWS = ["Rendering", "Structured data", "Answerability"]

export function ScanGraphic() {
  const reduce = useReducedMotion()
  return (
    <Frame>
      {/* Sweeping scan line: `left` is panel-relative so it always crosses the
          full width, at a steady (linear) pace. */}
      <motion.span
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-[linear-gradient(90deg,transparent,color-mix(in_oklch,var(--primary),transparent_80%),transparent)]"
        animate={
          reduce
            ? { opacity: 0 }
            : { left: ["-25%", "100%", "100%"], opacity: [0, 1, 1, 0, 0] }
        }
        transition={
          reduce
            ? { duration: 0 }
            : loop({
                ease: "linear",
                left: { times: [0, 0.55, 1], ease: "linear" },
                opacity: { times: [0, 0.1, 0.55, 0.62, 1], ease: "linear" },
              })
        }
      />

      <div className="flex items-center gap-1.5 rounded-md border border-border bg-white px-2 py-1 font-mono text-[10px] text-muted-foreground">
        <MagnifyingGlassIcon className="size-2.5 text-primary" aria-hidden />
        yoursite.com
      </div>

      <ul className="mt-2.5 space-y-1.5">
        {SCAN_ROWS.map((row, i) => (
          <li
            key={row}
            className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground"
          >
            <motion.span
              className="size-1.5 rounded-full bg-border"
              animate={
                reduce
                  ? { backgroundColor: "var(--primary)", scale: 1, opacity: 1 }
                  : {
                      backgroundColor: [
                        "var(--border)",
                        "var(--border)",
                        "var(--primary)",
                        "var(--primary)",
                        "var(--border)",
                        "var(--border)",
                      ],
                      scale: [0.6, 0.6, 1, 1, 0.6, 0.6],
                      opacity: [0.5, 0.5, 1, 1, 0.5, 0.5],
                    }
              }
              transition={
                reduce
                  ? { duration: 0 }
                  : loop({
                      times: [0, 0.12, 0.24, 0.82, 0.92, 1],
                      delay: i * 0.5,
                    })
              }
            />
            {row}
          </li>
        ))}
      </ul>

      <div className="absolute inset-x-4 bottom-4 h-1 overflow-hidden rounded-full bg-border/70">
        <motion.div
          className="h-full rounded-full bg-primary"
          animate={
            reduce
              ? { width: "61%" }
              : { width: ["8%", "8%", "100%", "100%", "8%", "8%"] }
          }
          transition={
            reduce
              ? { duration: 0 }
              : loop({ times: [0, 0.08, 0.55, 0.78, 0.92, 1] })
          }
        />
      </div>
    </Frame>
  )
}

const REPORT_ROWS = [
  { label: "Metadata", color: "bg-success" },
  { label: "Crawl surface", color: "bg-warning" },
  { label: "Content", color: "bg-destructive" },
]

const RING_C = 2 * Math.PI * 20
const RING_TARGET = RING_C * 0.38

export function ReportGraphic() {
  const reduce = useReducedMotion()
  return (
    <Frame className="flex items-center gap-4">
      <div className="relative grid size-16 shrink-0 place-items-center">
        <svg viewBox="0 0 48 48" className="size-16 -rotate-90">
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke="var(--border)"
            strokeWidth="4"
          />
          <motion.circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke="var(--warning)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={RING_C}
            animate={
              reduce
                ? { strokeDashoffset: RING_TARGET }
                : {
                    strokeDashoffset: [
                      RING_C,
                      RING_C,
                      RING_TARGET,
                      RING_TARGET,
                      RING_C,
                      RING_C,
                    ],
                  }
            }
            transition={
              reduce
                ? { duration: 0 }
                : loop({ times: [0, 0.1, 0.55, 0.8, 0.95, 1] })
            }
          />
        </svg>
        <span className="absolute font-mono text-base font-medium text-foreground">
          61
        </span>
      </div>

      <ul className="flex-1 space-y-1.5">
        {REPORT_ROWS.map((row, i) => (
          <motion.li
            key={row.label}
            className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground"
            animate={
              reduce
                ? { opacity: 1, y: 0 }
                : { opacity: [0, 0, 1, 1, 0, 0], y: [9, 9, 0, 0, 9, 9] }
            }
            transition={
              reduce
                ? { duration: 0 }
                : loop({
                    times: [0, 0.14, 0.3, 0.82, 0.94, 1],
                    delay: 0.3 + i * 0.4,
                  })
            }
          >
            <span className={cn("size-1.5 rounded-full", row.color)} />
            {row.label}
          </motion.li>
        ))}
      </ul>
    </Frame>
  )
}

const DIFF_LINES = [
  "+ <meta name=description>",
  "+ JSON-LD Article",
  "+ sitemap.xml route",
]

export function PrGraphic() {
  const reduce = useReducedMotion()
  return (
    <Frame className="flex flex-col gap-2 font-mono text-[10px]">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <GitBranchIcon className="size-2.5 text-primary" aria-hidden />
        <span className="text-foreground">ai-search-readiness</span>
      </div>

      <div className="space-y-1">
        {DIFF_LINES.map((line, i) => (
          <motion.div
            key={line}
            className="flex items-center justify-between rounded-sm bg-success/10 px-1.5 py-0.5 text-[9px] text-success"
            animate={
              reduce
                ? { opacity: 1, y: 0 }
                : { opacity: [0, 0, 1, 1, 0, 0], y: [9, 9, 0, 0, 9, 9] }
            }
            transition={
              reduce
                ? { duration: 0 }
                : loop({
                    times: [0, 0.14, 0.3, 0.82, 0.94, 1],
                    delay: 0.2 + i * 0.45,
                  })
            }
          >
            <span className="truncate">{line}</span>
            <span className="shrink-0 pl-1.5 tabular-nums">+1</span>
          </motion.div>
        ))}
      </div>

      <div className="mt-auto flex items-center gap-3 text-[9px] text-muted-foreground">
        {/* Checks pop in only after the diff lines have landed (~2.5s), then
            hold — so "passed" reads as a consequence of the changes. */}
        {[
          { label: "Build", delay: 0 },
          { label: "Types", delay: 0.25 },
        ].map((check) => (
          <span key={check.label} className="flex items-center gap-1">
            <motion.span
              className="inline-flex"
              animate={
                reduce
                  ? { opacity: 1, scale: 1 }
                  : {
                      opacity: [0, 0, 1, 1, 1, 0, 0],
                      scale: [0.5, 0.5, 1.18, 1, 1, 0.5, 0.5],
                    }
              }
              transition={
                reduce
                  ? { duration: 0 }
                  : loop({
                      times: [0, 0.56, 0.64, 0.72, 0.82, 0.94, 1],
                      delay: check.delay,
                    })
              }
            >
              <CheckCircleIcon
                weight="fill"
                className="size-2.5 text-success"
                aria-hidden
              />
            </motion.span>
            {check.label}
          </span>
        ))}
      </div>
    </Frame>
  )
}
