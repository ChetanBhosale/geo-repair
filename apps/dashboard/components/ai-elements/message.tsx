"use client"

import { cjk } from "@streamdown/cjk"
import { code } from "@streamdown/code"
import { math } from "@streamdown/math"
import { mermaid } from "@streamdown/mermaid"
import { memo } from "react"
import type { ComponentProps, HTMLAttributes } from "react"
import { Streamdown } from "streamdown"
import { cn } from "@/lib/utils"

export type MessageRole = "assistant" | "user" | "system" | "tool"

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: MessageRole
}

export function Message({ className, from, ...props }: MessageProps) {
  return (
    <div
      className={cn(
        "group flex w-full max-w-[96%] flex-col gap-2",
        from === "user" ? "ml-auto items-end" : "items-start",
        className
      )}
      data-role={from}
      {...props}
    />
  )
}

export type MessageContentProps = HTMLAttributes<HTMLDivElement>

export function MessageContent({ className, ...props }: MessageContentProps) {
  return (
    <div
      className={cn(
        "grid w-full gap-2 overflow-hidden rounded-lg border border-border bg-card p-4 text-sm",
        className
      )}
      {...props}
    />
  )
}

export type MessageResponseProps = ComponentProps<typeof Streamdown>

const streamdownPlugins = { cjk, code, math, mermaid }

export const MessageResponse = memo(
  ({ className, ...props }: MessageResponseProps) => (
    <Streamdown
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none text-muted-foreground [&_code]:rounded [&_code]:border [&_code]:border-border [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
      plugins={streamdownPlugins}
      {...props}
    />
  ),
  (previousProps, nextProps) =>
    previousProps.children === nextProps.children &&
    previousProps.isAnimating === nextProps.isAnimating
)

MessageResponse.displayName = "MessageResponse"
