"use client"

import { useEffect, useRef } from "react"

import {
  DEFAULT_RAMP,
  darkCellsFromLuma,
  glyphFor,
  lumaFromImageData,
  proceduralLuma,
  type AsciiAnimation,
  type AsciiTrigger,
  type DarkCell,
} from "@/lib/ascii/sample"

export type UseAsciiCanvasOptions = {
  src?: string
  cellSize?: number
  charRamp?: string
  /** Glyph color (any CSS color string). */
  color?: string
  /** Per-glyph alpha multiplier, 0..1. */
  intensity?: number
  /** Darkness cutoff 0..1; cells below this emit no glyph. */
  darkThreshold?: number
  /** 0..1 how strongly glyphs fade toward the center so centered copy reads. */
  centerFade?: number
  /** Paint glyphs on bright regions instead of dark ones. */
  invert?: boolean
  /** Motion style. */
  animation?: AsciiAnimation
  /** What makes the field animate. */
  trigger?: AsciiTrigger
  speed?: number
  fps?: number
}

const DPR_CAP = 2

function resolveMonoFont(el: Element): string {
  const family = getComputedStyle(el).getPropertyValue("--font-mono").trim()
  return family || "monospace"
}

async function lumaForSize(
  cols: number,
  rows: number,
  src?: string
): Promise<number[]> {
  if (!src) return proceduralLuma(cols, rows)
  try {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src = src
    await img.decode()
    const off = document.createElement("canvas")
    off.width = cols
    off.height = rows
    const ctx = off.getContext("2d", { willReadFrequently: true })
    if (!ctx) return proceduralLuma(cols, rows)
    ctx.drawImage(img, 0, 0, cols, rows)
    const { data } = ctx.getImageData(0, 0, cols, rows)
    return lumaFromImageData(data, cols, rows)
  } catch {
    return proceduralLuma(cols, rows)
  }
}

export function useAsciiCanvas({
  src,
  cellSize = 12,
  charRamp = DEFAULT_RAMP,
  color = "rgba(255,255,255,0.55)",
  intensity = 1,
  darkThreshold = 0.45,
  centerFade = 0,
  invert = false,
  animation = "cycle",
  trigger = "in-view",
  speed = 0.0016,
  fps = 30,
}: UseAsciiCanvasOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
    const dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1)
    const frameInterval = 1000 / fps
    // Hover trigger needs a hit target; the overlay itself is pointer-events:none,
    // so listen on the positioned parent (the feature/CTA panel).
    const hoverTarget = container.parentElement

    let cells: DarkCell[] = []
    let cols = 0
    let rows = 0
    let rafId = 0
    let lastFrame = 0
    let ready = false
    let disposed = false
    let resizeTimer = 0

    let inView = false
    let tabVisible = document.visibilityState === "visible"
    let hovering = false
    let animating = false

    const draw = (time: number) => {
      const w = canvas.width / dpr
      const h = canvas.height / dpr
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = color
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      const half = cellSize / 2
      for (const cell of cells) {
        const { char, alpha } = glyphFor(cell, charRamp, time, speed, animation)
        if (char === " ") continue
        ctx.globalAlpha = Math.min(
          1,
          cell.darkness * 0.9 * intensity * alpha * cell.edge
        )
        ctx.fillText(
          char,
          cell.col * cellSize + half,
          cell.row * cellSize + half
        )
      }
      ctx.globalAlpha = 1
    }

    const loop = (time: number) => {
      if (disposed || !animating) return
      if (time - lastFrame >= frameInterval) {
        lastFrame = time
        draw(time)
      }
      rafId = requestAnimationFrame(loop)
    }

    // Whether motion is wanted right now, given trigger + live state.
    const wantsMotion = () => {
      if (reducedMotion || animation === "none" || trigger === "none") {
        return false
      }
      if (trigger === "always") return tabVisible
      if (trigger === "hover") return tabVisible && hovering
      return tabVisible && inView // "in-view"
    }

    // Reconcile the RAF loop with current intent; paint a settled static frame
    // whenever we're not animating (so the field is never blank when on-screen).
    const refresh = () => {
      if (!ready) return
      const want = wantsMotion()
      if (want && !animating) {
        animating = true
        lastFrame = 0
        rafId = requestAnimationFrame(loop)
      } else if (!want && animating) {
        animating = false
        cancelAnimationFrame(rafId)
        draw(0)
      } else if (!want) {
        draw(0)
      }
    }

    const setup = async () => {
      const rect = container.getBoundingClientRect()
      const width = Math.max(1, Math.floor(rect.width))
      const height = Math.max(1, Math.floor(rect.height))
      cols = Math.max(1, Math.ceil(width / cellSize))
      rows = Math.max(1, Math.ceil(height / cellSize))

      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      await document.fonts.ready
      ctx.font = `${Math.round(cellSize)}px ${resolveMonoFont(container)}`

      const luma = await lumaForSize(cols, rows, src)
      if (disposed) return
      cells = darkCellsFromLuma(
        luma,
        cols,
        rows,
        darkThreshold,
        charRamp.length,
        invert,
        centerFade
      )
      ready = true
      animating = false
      cancelAnimationFrame(rafId)
      refresh()
    }

    const onDocVisibility = () => {
      tabVisible = document.visibilityState === "visible"
      refresh()
    }
    const onEnter = () => {
      hovering = true
      refresh()
    }
    const onLeave = () => {
      hovering = false
      refresh()
    }

    const io = new IntersectionObserver(
      (entries) => {
        inView = entries[0].isIntersecting
        refresh()
      },
      { threshold: 0 }
    )
    io.observe(container)

    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        if (!disposed) void setup()
      }, 200)
    })
    ro.observe(container)

    document.addEventListener("visibilitychange", onDocVisibility)
    if (trigger === "hover" && hoverTarget) {
      hoverTarget.addEventListener("mouseenter", onEnter)
      hoverTarget.addEventListener("mouseleave", onLeave)
    }

    void setup()

    return () => {
      disposed = true
      cancelAnimationFrame(rafId)
      window.clearTimeout(resizeTimer)
      io.disconnect()
      ro.disconnect()
      document.removeEventListener("visibilitychange", onDocVisibility)
      if (trigger === "hover" && hoverTarget) {
        hoverTarget.removeEventListener("mouseenter", onEnter)
        hoverTarget.removeEventListener("mouseleave", onLeave)
      }
    }
  }, [
    src,
    cellSize,
    charRamp,
    color,
    intensity,
    darkThreshold,
    centerFade,
    invert,
    animation,
    trigger,
    speed,
    fps,
  ])

  return { containerRef, canvasRef }
}
