import { openAPI } from 'better-auth/plugins/open-api'

// The public OpenAPI install switch: delete the entry below to disable every
// OpenAPI surface. The auth reference unregisters with the plugin, and the
// business spec + Scalar page read `openApiDocsEnabled` and answer not found.
export const installedOpenApiPlugins = [openAPI({ path: '/reference' })]

export const openApiDocsEnabled = installedOpenApiPlugins.length > 0
