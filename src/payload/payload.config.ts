import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'

import { Users } from '@/payload/collections/users'
import { migrations } from '@/payload/migrations'
import { resolvePayloadServerUrl } from '@/payload/security/payload-server-url'
import { getServerEnv } from '@/server/env'

const env = getServerEnv()
// import.meta.dir is Bun-only; the Payload CLI (generate:types,
// migrate:create) runs under Node, so fall back to import.meta.dirname.
const payloadDirectory = import.meta.dir ?? import.meta.dirname
const payloadPath = (relativePath: string) => `${payloadDirectory}/${relativePath.replace(/^\.\//, '')}`

export default buildConfig({
  graphQL: {
    disable: true,
  },
  llmInstructions: false,
  maxDepth: 5,
  serverURL: resolvePayloadServerUrl(env),
  admin: {
    user: 'users',
    importMap: {
      importMapFile: payloadPath('./payload-import-map.ts'),
    },
  },
  collections: [Users],
  db: postgresAdapter({
    push: false,
    prodMigrations: migrations,
    // Payload's default (<cwd>/src/migrations) would miss this folder.
    migrationDir: payloadPath('./migrations'),
    pool: {
      connectionString: env.DATABASE_URL,
    },
  }),
  editor: lexicalEditor({}),
  secret: env.PAYLOAD_SECRET,
  typescript: {
    outputFile: payloadPath('./payload-types.ts'),
  },
  jobs: {
    tasks: [],
  },
})
