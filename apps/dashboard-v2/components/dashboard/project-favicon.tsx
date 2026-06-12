"use client"

/* eslint-disable @next/next/no-img-element */

import * as React from "react"
import { GlobeIcon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

export function ProjectFavicon({
  src,
  className,
  imgClassName,
}: {
  src?: string | null
  className?: string
  imgClassName?: string
}) {
  const [failed, setFailed] = React.useState(false)

  return (
    <div
      className={cn(
        "grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-accent text-accent-foreground",
        className
      )}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          className={cn("size-5 object-contain", imgClassName)}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <GlobeIcon className="size-4" />
      )}
    </div>
  )
}
