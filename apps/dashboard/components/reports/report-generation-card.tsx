"use client"

import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function ReportGenerationCard({
  error,
  isPending,
  notice,
  onGenerate,
}: {
  error: Error | null
  isPending: boolean
  notice: string | null
  onGenerate: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Report generation</CardTitle>
            <CardDescription>
              Generate stored report artifacts from scans, fix runs, and PR
              outcomes.
            </CardDescription>
          </div>
          <Button disabled={isPending} onClick={onGenerate}>
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Generate reports
          </Button>
        </div>
      </CardHeader>
      {error || notice ? (
        <CardContent>
          {error ? (
            <p className="text-sm text-danger">{error.message}</p>
          ) : null}
          {notice ? <p className="text-sm text-secondary">{notice}</p> : null}
        </CardContent>
      ) : null}
    </Card>
  )
}
