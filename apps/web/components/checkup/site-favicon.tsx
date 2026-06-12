"use client"

/* eslint-disable @next/next/no-img-element */

import { useState } from "react"
import { GlobeSimpleIcon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

export function SiteFavicon({
  src,
  className,
  imgClassName,
}: {
  src?: string | null
  className?: string
  imgClassName?: string
}) {
  const [failed, setFailed] = useState(false)

  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center overflow-hidden bg-muted text-muted-foreground",
        className
      )}
      aria-hidden
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
        <GlobeSimpleIcon className="size-4" />
      )}
    </span>
  )
}
