// Pure helpers for the ASCII-over-image brand overlay. No DOM/React here so the
// logic stays testable and the hook can stay focused on the RAF/observer loop.

export const DEFAULT_RAMP = " .:-=+*x#%@"

// Motion style for the glyph field.
export type AsciiAnimation = "cycle" | "flow" | "wave" | "flicker" | "none"
// What makes the field animate.
export type AsciiTrigger = "in-view" | "hover" | "always" | "none"

export type DarkCell = {
  col: number
  row: number
  // Index into the char ramp at rest, scaled by darkness.
  baseIdx: number
  // Per-cell animation offset so glyphs don't cycle in lockstep.
  phase: number
  // 0..1 darkness (1 = fully dark); drives glyph alpha.
  darkness: number
  // 0..1 static alpha multiplier from `centerFade`: ~0 near the panel center
  // (so headline copy reads cleanly) rising to 1 at the edges. 1 when disabled.
  edge: number
}

const REC709 = { r: 0.2126, g: 0.7152, b: 0.0722 }

function luminance(r: number, g: number, b: number): number {
  return (REC709.r * r + REC709.g * g + REC709.b * b) / 255
}

// Deterministic per-cell phase so animation is stable across resamples.
function cellPhase(col: number, row: number): number {
  const n = Math.sin(col * 12.9898 + row * 78.233) * 43758.5453
  return n - Math.floor(n)
}

// Smooth 0→1 ramp between edges `a` and `b` (Hermite). x outside [a,b] clamps.
function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// Turn a luminance grid (row-major, length = cols*rows, each 0..1) into the list
// of cells dark enough to paint a glyph. Bright cells emit nothing so a colorful
// image (or gradient) shows through cleanly.
export function darkCellsFromLuma(
  luma: number[],
  cols: number,
  rows: number,
  darkThreshold = 0.45,
  rampLength = DEFAULT_RAMP.length,
  // When true, paint glyphs on the *bright* regions instead of the dark ones.
  invert = false,
  // 0..1 how strongly glyphs fade toward the panel center; 0 disables (uniform
  // field). Lets a centered headline breathe while the texture frames the edges.
  centerFade = 0
): DarkCell[] {
  const cells: DarkCell[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const lum = luma[row * cols + col]
      // `weight` is the value that gates selection and drives glyph alpha:
      // darkness for the normal pass, brightness when inverted.
      const weight = invert ? lum : 1 - lum
      if (weight < darkThreshold) continue
      const baseIdx = Math.min(
        rampLength - 1,
        Math.round(weight * (rampLength - 1))
      )
      let edge = 1
      if (centerFade > 0) {
        // Normalized radial distance from center: 0 at the middle, ~1 by the
        // edges/corners. Glyphs inside the cleared core drop to `1-centerFade`.
        const nx = (cols > 1 ? col / (cols - 1) : 0.5) - 0.5
        const ny = (rows > 1 ? row / (rows - 1) : 0.5) - 0.5
        const dist = Math.min(1, Math.hypot(nx, ny) / 0.5)
        edge = 1 - centerFade * (1 - smoothstep(0.2, 0.85, dist))
      }
      cells.push({
        col,
        row,
        baseIdx,
        phase: cellPhase(col, row),
        darkness: weight,
        edge,
      })
    }
  }
  return cells
}

// Sample an already-drawn offscreen canvas into a luminance grid.
export function lumaFromImageData(
  data: Uint8ClampedArray,
  cols: number,
  rows: number
): number[] {
  const luma = new Array<number>(cols * rows)
  for (let i = 0; i < cols * rows; i++) {
    const o = i * 4
    luma[i] = luminance(data[o], data[o + 1], data[o + 2])
  }
  return luma
}

// Procedural luminance field matching the feature backdrop gradient: two bright
// color blobs (top-left, bottom-right) over a dark base. Used when no image src
// is supplied so the brand overlay still has dark regions to animate on.
export function proceduralLuma(cols: number, rows: number): number[] {
  const blobs = [
    { x: 0.3, y: 0.2, r: 0.55 },
    { x: 0.75, y: 0.8, r: 0.5 },
  ]
  const luma = new Array<number>(cols * rows)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col / (cols - 1)
      const y = row / (rows - 1)
      let bright = 0.12
      for (const blob of blobs) {
        const dx = x - blob.x
        const dy = y - blob.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        bright = Math.max(bright, 1 - Math.min(1, dist / blob.r))
      }
      luma[row * cols + col] = Math.min(1, bright)
    }
  }
  return luma
}

// Glyph + alpha multiplier for a cell at time t, per animation style. Darker
// (or, when inverted, brighter) cells sit higher on the ramp. The returned
// `alpha` is an extra 0..1 multiplier the renderer applies on top of the cell
// weight, used by "flicker" to blink individual glyphs.
export function glyphFor(
  cell: DarkCell,
  ramp: string,
  t: number,
  speed: number,
  animation: AsciiAnimation = "cycle"
): { char: string; alpha: number } {
  const max = ramp.length - 1
  let idx = cell.baseIdx
  let alpha = 1

  switch (animation) {
    case "none":
      idx = cell.baseIdx
      break
    case "flow": {
      // Two waves drift in different directions at an irrational frequency
      // ratio (≈φ), so their interference never visibly repeats — organic
      // caustic-like motion rather than a single marching diagonal. The phase
      // term decorrelates neighbors so the field shimmers instead of sliding.
      const u = cell.col * 0.26
      const v = cell.row * 0.31
      const w1 = Math.sin(t * speed + u + v)
      const w2 = Math.sin(t * speed * 0.618 - u * 0.7 + v + cell.phase * 6.2832)
      idx = cell.baseIdx + w1 * 1.05 + w2 * 0.75
      break
    }
    case "wave": {
      // Same layered approach, oriented differently and a touch slower so the
      // CTA bookend reads as a sibling of the hero without mirroring it.
      const u = cell.col * 0.33
      const v = cell.row * 0.17
      const w1 = Math.sin(t * speed * 0.85 + u - v)
      const w2 = Math.sin(t * speed * 0.47 + v * 1.3 + cell.phase * 6.2832)
      idx = cell.baseIdx + w1 * 1.0 + w2 * 0.7
      break
    }
    case "flicker": {
      // Mostly steady, with a rotating subset blinking brighter/denser.
      const f = Math.sin(t * speed * 3 + cell.phase * Math.PI * 2)
      const lit = f > 0.85
      idx = lit ? cell.baseIdx + 2 : cell.baseIdx
      alpha = lit ? 1 : 0.5
      break
    }
    case "cycle":
    default: {
      // Per-cell phase keeps the field shimmering rather than pulsing in unison.
      const drift = Math.sin(t * speed + cell.phase * Math.PI * 2)
      idx = cell.baseIdx + drift * 1.5
      break
    }
  }

  const ci = Math.round(Math.max(0, Math.min(max, idx)))
  return { char: ramp[ci], alpha }
}
