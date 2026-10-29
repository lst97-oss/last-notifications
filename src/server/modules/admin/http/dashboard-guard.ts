import { ErrorCode, HttpError } from '@/server/http/errors'
import { requireSessionUserId } from '@/server/http/route-guards'
import { hasDashboardAccess } from '@/server/modules/admin/infrastructure/dashboard-access'

// Session-only access to the dashboard's data. A signed-in account without an
// admin role is refused, so the shell's gate cannot be bypassed through the API.
export async function requireDashboardUser(request: Request, message: string): Promise<string> {
  const userId = await requireSessionUserId(request, message)
  if (!(await hasDashboardAccess(userId))) {
    throw new HttpError(ErrorCode.FORBIDDEN, 'The dashboard is restricted to administrators')
  }
  return userId
}
