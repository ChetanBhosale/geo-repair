"use client"

import { ArrowDown } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"
import { useCallback } from "react"
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom"
import { cn } from "@/lib/utils"

export type ConversationProps = ComponentProps<typeof StickToBottom>

export function Conversation({ className, ...props }: ConversationProps) {
  return (
    <StickToBottom
      className={cn("relative min-h-0 flex-1 overflow-hidden", className)}
      initial="smooth"
      resize="smooth"
      role="log"
      {...props}
    />
  )
}

export type ConversationContentProps = ComponentProps<
  typeof StickToBottom.Content
>

export function ConversationContent({
  className,
  ...props
}: ConversationContentProps) {
  return (
    <StickToBottom.Content
      className={cn("flex flex-col gap-3 p-4", className)}
      {...props}
    />
  )
}

export type ConversationEmptyStateProps = ComponentProps<"div"> & {
  title?: string
  description?: string
  icon?: ReactNode
}

export function ConversationEmptyState({
  className,
  title = "No messages yet",
  description = "Agent activity appears here after a run starts.",
  icon,
  children,
  ...props
}: ConversationEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-72 flex-col items-center justify-center gap-3 p-8 text-center",
        className
      )}
      {...props}
    >
      {children ?? (
        <>
          {icon ? <div className="text-muted-foreground">{icon}</div> : null}
          <div className="space-y-1">
            <h3 className="text-sm font-medium">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </>
      )}
    </div>
  )
}

export type ConversationScrollButtonProps = ComponentProps<"button">

export function ConversationScrollButton({
  className,
  children,
  ...props
}: ConversationScrollButtonProps) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext()
  const handleScrollToBottom = useCallback(() => {
    scrollToBottom()
  }, [scrollToBottom])

  if (isAtBottom) {
    return null
  }

  return (
    <button
      aria-label="Scroll to latest agent event"
      className={cn(
        "absolute right-4 bottom-4 grid size-8 place-items-center rounded-full border border-border bg-background text-foreground",
        className
      )}
      onClick={handleScrollToBottom}
      type="button"
      {...props}
    >
      {children ?? <ArrowDown className="size-4" aria-hidden />}
    </button>
  )
}
