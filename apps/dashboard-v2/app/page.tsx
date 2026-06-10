"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { PageLoader } from "@/components/page-loader"

// Root just routes: signed in -> /dashboard, otherwise -> /sign-in.
export default function RootPage() {
  const router = useRouter()
  const { isLoading, isSignedIn } = useAuth()

  React.useEffect(() => {
    if (isLoading) return
    router.replace(isSignedIn ? "/dashboard" : "/sign-in")
  }, [isLoading, isSignedIn, router])

  return <PageLoader />
}
