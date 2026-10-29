'use client'

import { AdminLogin } from '@/components/dashboard/admin-login'
import { AdminSidebar } from '@/components/dashboard/admin-sidebar'
import { DashboardAccessDenied } from '@/components/dashboard/dashboard-access-denied'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Spinner } from '@/components/ui/spinner'
import { useSessionPrincipal } from '@/lib/business-auth-client'

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { principal, dashboard, isPending } = useSessionPrincipal()

  if (isPending) {
    return (
      <div className="grid min-h-svh place-items-center bg-background">
        <p aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner data-icon="inline-start" />
          Loading…
        </p>
      </div>
    )
  }

  if (!principal) return <AdminLogin />
  if (!dashboard) return <DashboardAccessDenied />

  return (
    <SidebarProvider defaultOpen>
      <AdminSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger />
          <span className="text-sm font-medium">Notification dashboard</span>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
