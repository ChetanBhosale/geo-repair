"use client"

import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { BreadcrumbProvider } from "@/context/breadcrumb"

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <BreadcrumbProvider>
      <div className="flex min-h-svh flex-col bg-background text-foreground">
        <DashboardHeader />
        <div className="flex min-h-0 flex-1">
          <DashboardSidebar />
          <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </BreadcrumbProvider>
  )
}
