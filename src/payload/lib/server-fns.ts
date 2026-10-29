import configPromise from '@payload-config'
import { loadLayoutData } from '@payloadcms/tanstack-start/layouts'
import { handleServerFunctions } from '@payloadcms/tanstack-start/server'
import { createServerFn } from '@tanstack/react-start'

// Payload server functions shared by all admin routes — config + importMap
// injection point. Runs on the server via TanStack Start's wire format,
// NOT Next 'use server' actions.
export const payloadServerFn = createServerFn({ method: 'POST', strict: false })
  .validator((input: { name: string; args: Record<string, unknown> }) => input)
  .handler(async ({ data }): Promise<Response> => {
    const { getPayloadImportMap } = await import('@/payload/lib/import-map')
    const result = await handleServerFunctions({
      args: data.args,
      config: configPromise,
      importMap: getPayloadImportMap(),
      name: data.name,
    })
    // `handleServerFunctions` returns a Flight `Response` (beta.3+). TanStack
    // passes it through untouched; re-wrapping it strips the RSC elements and
    // leaves relationship drawers and form-state stuck on their spinner.
    return result
  })

export const payloadLayoutServerFn = createServerFn({ method: 'GET', strict: false }).handler(async () => {
  const { getPayloadImportMap } = await import('@/payload/lib/import-map')
  return loadLayoutData({ config: await configPromise, importMap: getPayloadImportMap() })
})
