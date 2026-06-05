"use client"

import { CornerDownLeft, Square } from "lucide-react"
import type {
  ComponentProps,
  FormEvent,
  FormEventHandler,
  ReactNode,
} from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export type PromptInputMessage = {
  text: string
}

export type PromptInputProps = Omit<
  ComponentProps<"form">,
  "onSubmit" | "children"
> & {
  children: ReactNode
  onSubmit: (
    message: PromptInputMessage,
    event: FormEvent<HTMLFormElement>
  ) => void | Promise<void>
}

export function PromptInput({
  children,
  className,
  onSubmit,
  ...props
}: PromptInputProps) {
  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const text = String(formData.get("message") ?? "")

    onSubmit({ text }, event)
  }

  return (
    <form
      className={cn("grid w-full gap-3", className)}
      onSubmit={handleSubmit}
      {...props}
    >
      {children}
    </form>
  )
}

export type PromptInputTextareaProps = ComponentProps<"textarea">

export function PromptInputTextarea({
  className,
  ...props
}: PromptInputTextareaProps) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full resize-y rounded-lg bg-primary p-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-focus/40",
        className
      )}
      name="message"
      {...props}
    />
  )
}

export type PromptInputFooterProps = ComponentProps<"div">

export function PromptInputFooter({
  className,
  ...props
}: PromptInputFooterProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3",
        className
      )}
      {...props}
    />
  )
}

export type PromptInputSubmitProps = ComponentProps<typeof Button> & {
  status?: "ready" | "submitted" | "streaming" | "error"
}

export function PromptInputSubmit({
  className,
  children,
  status = "ready",
  type = "submit",
  ...props
}: PromptInputSubmitProps) {
  const isGenerating = status === "submitted" || status === "streaming"

  return (
    <Button
      aria-label={isGenerating ? "Stop refinement" : "Send refinement"}
      className={className}
      type={isGenerating ? "button" : type}
      {...props}
    >
      {children ?? (
        <>
          {isGenerating ? (
            <Square className="size-3.5" aria-hidden />
          ) : (
            <CornerDownLeft className="size-3.5" aria-hidden />
          )}
          <span>{isGenerating ? "Stop" : "Send refinement"}</span>
        </>
      )}
    </Button>
  )
}
