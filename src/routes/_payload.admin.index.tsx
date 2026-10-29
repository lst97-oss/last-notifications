import { payloadAdminIndexRoute } from '@payloadcms/tanstack-start/client'
import { createFileRoute } from '@tanstack/react-router'
import { adminRenderServerFn } from '@/payload/lib/admin-render'

export const Route = createFileRoute('/_payload/admin/')({
  ...payloadAdminIndexRoute({ load: adminRenderServerFn }),
})
