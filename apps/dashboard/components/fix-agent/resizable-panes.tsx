"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// Two full-height panes with a draggable divider that sets the left pane's
// width. No gap, no library — just a pointer-driven width on the left.
export function ResizablePanes({
  left,
  right,
  initialLeft = "46%",
  minLeft = 360,
  minRight = 380,
}: {
  left: React.ReactNode
  right: React.ReactNode
  initialLeft?: string
  minLeft?: number
  minRight?: number
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const cleanupRef = React.useRef<(() => void) | null>(null)
  const [leftWidth, setLeftWidth] = React.useState<number | null>(null)

  const onDown = React.useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault()
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"

      function move(moveEvent: PointerEvent) {
        const container = containerRef.current
        if (!container) return
        const rect = container.getBoundingClientRect()
        const max = rect.width - minRight
        const next = Math.max(
          minLeft,
          Math.min(max, moveEvent.clientX - rect.left),
        )
        setLeftWidth(next)
      }

      function up() {
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
        window.removeEventListener("pointermove", move)
        window.removeEventListener("pointerup", up)
        cleanupRef.current = null
      }

      window.addEventListener("pointermove", move)
      window.addEventListener("pointerup", up)
      cleanupRef.current = up
    },
    [minLeft, minRight],
  )

  React.useEffect(() => () => cleanupRef.current?.(), [])

  return (
    <div className="flex h-full w-full overflow-hidden" ref={containerRef}>
      <div
        className="h-full min-w-0 shrink-0"
        style={{ width: leftWidth != null ? `${leftWidth}px` : initialLeft }}
      >
        {left}
      </div>
      <div
        aria-label="Resize panes"
        aria-orientation="vertical"
        className={cn(
          "group relative w-px shrink-0 cursor-col-resize bg-secondary",
          "before:absolute before:inset-y-0 before:-right-1 before:-left-1 before:content-['']",
          "hover:bg-brand/60",
        )}
        onPointerDown={onDown}
        role="separator"
      />
      <div className="h-full min-w-0 flex-1">{right}</div>
    </div>
  )
}
