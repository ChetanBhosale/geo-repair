"use client"

import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
} from "react"
import { HalftoneDots } from "@paper-design/shaders-react"

import { cn } from "@/lib/utils"

type HalftoneOverrides = Partial<ComponentProps<typeof HalftoneDots>>

type HalftoneImageProps = {
  src: string
  alt?: string
  className?: string
  style?: CSSProperties
  overrides?: HalftoneOverrides
}

const DEFAULTS = {
  grid: "hex",
  type: "gooey",
  size: 0.45,
  radius: 1.2,
  contrast: 0.5,
  colorFront: "#14463a",
  colorBack: "#f6f5ef",
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
  const [active, setActive] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { rootMargin: "300px 0px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={cn("relative overflow-hidden", className)}
      style={style}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="absolute inset-0 h-full w-full object-cover"
      />
      {active ? (
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
      ) : null}
    </div>
  )
}
