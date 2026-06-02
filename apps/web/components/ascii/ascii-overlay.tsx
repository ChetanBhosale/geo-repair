"use client"

import type { CSSProperties } from "react"

import { useAsciiCanvas } from "@/hooks/use-ascii-canvas"
import type { AsciiAnimation, AsciiTrigger } from "@/lib/ascii/sample"
import { cn } from "@/lib/utils"

export type AsciiOverlayProps = {
  /** Image whose dark regions the glyphs trace. Omit for a procedural field. */
  src?: string

  // ── Size ──────────────────────────────────────────────────────────────
  /** Glyph cell size in px. Larger = sparser, calmer. */
  size?: number
  /** Alias for `size`. */
  cellSize?: number
  /** Glyph ramp, sparse → dense. */
  charRamp?: string

  // ── Appearance ────────────────────────────────────────────────────────
  /** Glyph color (any CSS color). */
  color?: string
  /** Alias for `color`. */
  glyphColor?: string
  /** Whole-layer opacity, 0..1. */
  opacity?: number
  /** Per-glyph alpha multiplier, 0..1, how bold individual glyphs read. */
  intensity?: number
  /** CSS blend mode for the glyph layer over the image. */
  blendMode?: CSSProperties["mixBlendMode"]

  // ── Image → glyph mapping ─────────────────────────────────────────────
  /** 0..1, how readily cells get a glyph. Higher = denser coverage. */
  sensitivity?: number
  /** Advanced: explicit darkness cutoff 0..1 (overrides `sensitivity`). */
  darkThreshold?: number
  /** 0..1, fade glyphs toward the center so centered copy stays legible. */
  centerFade?: number
  /** Trace bright regions instead of dark ones. */
  invert?: boolean

  // ── Motion ────────────────────────────────────────────────────────────
  /** Motion style. */
  animation?: AsciiAnimation
  /** What makes it animate: in view, on hover, always, or never. */
  trigger?: AsciiTrigger
  /** Animation speed. */
  speed?: number
  /** Frame-rate cap. */
  fps?: number

  className?: string
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

export function AsciiOverlay({
  src,
  size,
  cellSize,
  charRamp,
  color,
  glyphColor,
  opacity = 1,
  intensity,
  blendMode,
  sensitivity,
  darkThreshold,
  centerFade,
  invert,
  animation,
  trigger,
  speed,
  fps,
  className,
}: AsciiOverlayProps) {
  // Friendly `sensitivity` (higher = denser) maps to the internal darkness
  // cutoff (lower = denser). An explicit `darkThreshold` always wins.
  const resolvedThreshold =
    darkThreshold ??
    (sensitivity != null ? clamp01(1 - sensitivity) : undefined)

  const { containerRef, canvasRef } = useAsciiCanvas({
    src,
    cellSize: size ?? cellSize,
    charRamp,
    color: color ?? glyphColor,
    intensity,
    darkThreshold: resolvedThreshold,
    centerFade,
    invert,
    animation,
    trigger,
    speed,
    fps,
  })

  return (
    <div
      ref={containerRef}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 z-0", className)}
      style={{ opacity, mixBlendMode: blendMode }}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  )
}
