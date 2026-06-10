"use client"

import * as React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { cn } from "@/lib/utils"

// Renders agent chat text as Markdown (bold, lists, inline code, fenced code
// blocks, links) sized for the chat column. Used for AGENT message bubbles.
export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-2 text-xs leading-relaxed [&_:first-child]:mt-0 [&_:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-4">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-4">{children}</ol>,
          li: ({ children }) => <li className="pl-0.5">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              {children}
            </a>
          ),
          h1: ({ children }) => <h1 className="text-sm font-semibold">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="text-xs font-semibold">{children}</h3>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-border" />,
          code: ({ className, children, ...props }) => {
            const isBlock = /language-/.test(className ?? "")
            if (isBlock) {
              return (
                <code className={cn("font-mono", className)} {...props}>
                  {children}
                </code>
              )
            }
            return (
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                {children}
              </code>
            )
          },
          pre: ({ children }) => (
            <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-background/60 p-3 font-mono text-[11px] leading-relaxed">
              {children}
            </pre>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
