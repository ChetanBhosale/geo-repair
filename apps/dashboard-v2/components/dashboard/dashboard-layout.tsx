"use client"

import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { BreadcrumbProvider } from "@/context/breadcrumb"

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <BreadcrumbProvider>
      <div className="flex min-h-svh bg-background text-foreground">
        <DashboardSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardHeader />
          <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </BreadcrumbProvider>
  )
}
