import { createFileRoute, Outlet } from '@tanstack/react-router'

import { DashboardShell } from '@/components/dashboard/dashboard-shell'

// The dashboard lives outside Payload's /admin so the CMS and the notification
// console never share a shell. The sidebar mounts here once.
export const Route = createFileRoute('/dashboard')({
  component: DashboardLayout,
})

function DashboardLayout() {
  return (
    <DashboardShell>
      <Outlet />
    </DashboardShell>
  )
}
