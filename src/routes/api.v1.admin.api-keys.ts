import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { createKeyData, deleteKeyData, listKeysData, updateKeyData } from '@/server/modules/admin/http/admin-api-keys'

// Permissions and the app binding are server-only in the better-auth plugin, so
// issuance goes through this wrapper. Listing and updates read our own apikey
// table, which keeps every dashboard auth provider working.
export const Route = createFileRoute('/api/v1/admin/api-keys')({
  server: {
    handlers: {
      GET: ({ request }) => withContext(async () => listKeysData(request))({ request }),
      POST: ({ request }) => withContext(async () => createKeyData(request))({ request }),
      PATCH: ({ request }) => withContext(async () => updateKeyData(request))({ request }),
      DELETE: ({ request }) => withContext(async () => deleteKeyData(request))({ request }),
    },
  },
})
