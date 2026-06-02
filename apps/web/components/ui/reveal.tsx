"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"

import { cn } from "@/lib/utils"

type RevealProps = {
  children: React.ReactNode
  /** Stagger offset in ms, applied as a transition delay. */
  delay?: number
  className?: string
}

// Reveal-on-scroll wrapper. The element is visible by default (see globals.css);
// only when the `js` class is present does it start hidden and animate in as it
// enters the viewport, so no-JS users and crawlers always see the content.
export function Reveal({ children, delay = 0, className }: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (shown) return
    const el = ref.current
    if (!el) return

    const reveal = () => setShown(true)

    // Back/forward cache and tab restore serve the page frozen: this effect
    // won't re-run and the observer below may never re-deliver, leaving content
    // stuck at opacity 0. `pageshow` fires with persisted=true on those
    // restores (this listener, registered on the original visit, survives in
    // the cached page), so reveal then. Registered before the early return so
    // it covers content that was already shown on the original visit too.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) reveal()
    }
    window.addEventListener("pageshow", onPageShow)
    const cleanup = () => window.removeEventListener("pageshow", onPageShow)

    // Already in (or above) the viewport on mount: reveal right away. Covers
    // fast navigations where the observer's first async callback can be missed.
    const rect = el.getBoundingClientRect()
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      reveal()
      return cleanup
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          reveal()
          io.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cleanup()
    }
  }, [shown])

  return (
    <div
      ref={ref}
      className={cn("reveal", className)}
      data-show={shown ? "true" : undefined}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  )
}
