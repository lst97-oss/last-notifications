'use client'

import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'

// Signed in, but this account has no admin role: the dashboard's queries never
// mount, so no admin API is called.
export function DashboardAccessDenied() {
  return (
    <div className="grid min-h-svh place-items-center bg-background p-4">
      <Card className="max-w-md">
        <CardContent className="grid gap-2">
          <CardTitle>No dashboard access</CardTitle>
          <CardDescription>
            This account is signed in but is not an administrator. Ask an instance admin for access, or sign in with an
            admin account.
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  )
}
