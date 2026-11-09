import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { setupStatusServerFn } from '@/lib/setup-status'

// The dashboard lives outside Payload's /admin so the CMS and the notification
// console never share a shell. The sidebar mounts here once.
export const Route = createFileRoute('/dashboard')({
  // Covers every /dashboard/* child: with no admin yet, sign-in cannot succeed, so go to the first-admin form.
  beforeLoad: async () => {
    const { setupAvailable } = await setupStatusServerFn()
    if (setupAvailable) throw redirect({ to: '/create-admin-user' })
  },
  component: DashboardLayout,
})

function DashboardLayout() {
  return (
    <DashboardShell>
      <Outlet />
    </DashboardShell>
  )
}
