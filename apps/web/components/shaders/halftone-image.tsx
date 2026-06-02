"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { HalftoneDots } from "@paper-design/shaders-react"

import { cn } from "@/lib/utils"

type HalftoneOverrides = Partial<React.ComponentProps<typeof HalftoneDots>>

type HalftoneImageProps = {
  /** Image to halftone. Same-origin (served from /public) sidesteps WebGL CORS
   *  tainting — external hosts must send permissive CORS headers. */
  src: string
  alt?: string
  className?: string
  style?: CSSProperties
  /** Merged over the brand-matched defaults below. */
  overrides?: HalftoneOverrides
}

// Brand-matched halftone: emerald dots on the site's off-white, static (speed 0)
// so it reads as a printed texture rather than motion. Tuned in the shader lab.
const DEFAULTS = {
  grid: "hex",
  type: "gooey",
  size: 0.45,
  radius: 1.2,
  contrast: 0.5,
  colorFront: "#14463a",
  colorBack: "#f2f1e8",
  fit: "cover",
} satisfies HalftoneOverrides

export function HalftoneImage({
  src,
  alt = "",
  className,
  style,
  overrides,
}: HalftoneImageProps) {
  const ref = useRef<HTMLDivElement>(null)
  // Each shader holds a live WebGL context and browsers cap how many can exist
  // (~16), so only mount it near the viewport and release it once well out of
  // view. The plain <img> underneath covers every other state.
  const [active, setActive] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { rootMargin: "300px 0px" }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={cn("relative overflow-hidden", className)}
      style={style}
    >
      {/* Real image: SSR/crawler content, and what shows before the shader
          mounts or after it's released out of view. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="absolute inset-0 h-full w-full object-cover"
      />
      {active && (
        <HalftoneDots
          image={src}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
          }}
          {...DEFAULTS}
          {...overrides}
        />
      )}
    </div>
  )
}
