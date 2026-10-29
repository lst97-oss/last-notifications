import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { BusinessDb } from '@/server/db/business-sql'
import { getBusinessDb } from '@/server/db/business-sql'
import { appChannels, appMemberships, appOrigins, apps } from '@/server/db/schema'
import type { NotificationChannelKind } from '@/server/db/vocabularies'

export type AppRecord = { id: string; key: string; name: string; createdAt: Date }

const appColumns = { id: apps.id, key: apps.key, name: apps.name, createdAt: apps.createdAt }

// Every registered origin, for Better Auth's trusted-origin check.
export async function listAppOrigins(db: BusinessDb = getBusinessDb()): Promise<readonly string[]> {
  const rows = await db.select({ origin: appOrigins.origin }).from(appOrigins)
  return rows.map((row) => row.origin)
}

export async function listAppOriginsForApp(appKey: string, db: BusinessDb = getBusinessDb()): Promise<string[]> {
  const rows = await db
    .select({ origin: appOrigins.origin })
    .from(appOrigins)
    .innerJoin(apps, eq(apps.id, appOrigins.appId))
    .where(eq(apps.key, appKey))
  return rows.map((row) => row.origin)
}

// True when the origin may read this app's browser-facing responses. A missing
// or unregistered Origin on a non-browser call is handled by the caller.
export async function appOriginAllowed(
  appKey: string,
  origin: string,
  db: BusinessDb = getBusinessDb(),
): Promise<boolean> {
  return (await listAppOriginsForApp(appKey, db)).includes(origin)
}

export async function getAppByKey(appKey: string, db: BusinessDb = getBusinessDb()): Promise<AppRecord | null> {
  const [row] = await db.select(appColumns).from(apps).where(eq(apps.key, appKey)).limit(1)
  return row ?? null
}

export async function getAppId(appKey: string, db: BusinessDb = getBusinessDb()): Promise<string | null> {
  const [row] = await db.select({ id: apps.id }).from(apps).where(eq(apps.key, appKey)).limit(1)
  return row?.id ?? null
}

export async function listApps(db: BusinessDb = getBusinessDb()): Promise<AppRecord[]> {
  return db.select(appColumns).from(apps).orderBy(asc(apps.name))
}

// The apps one user administers. Instance admins use listApps() instead.
export async function listAppsForUser(userId: string, db: BusinessDb = getBusinessDb()): Promise<AppRecord[]> {
  return db
    .select(appColumns)
    .from(appMemberships)
    .innerJoin(apps, eq(apps.id, appMemberships.appId))
    .where(and(eq(appMemberships.userId, userId), eq(appMemberships.role, 'admin')))
    .orderBy(asc(apps.name))
}

export async function createApp(
  userId: string | null,
  input: { name: string; origin: string },
  db: BusinessDb = getBusinessDb(),
): Promise<AppRecord> {
  const key = `${slugify(input.name)}-${crypto.randomUUID().slice(0, 8)}`
  return db.transaction(async (tx) => {
    const [app] = await tx.insert(apps).values({ key, name: input.name }).returning(appColumns)
    if (!app) throw new Error('Could not create app')
    await tx.insert(appOrigins).values({ appId: app.id, origin: input.origin })
    if (userId !== null) {
      await tx.insert(appMemberships).values({ appId: app.id, userId, role: 'admin' })
    }
    return app
  })
}

export async function updateApp(
  appKey: string,
  input: { name?: string; origin?: string },
  db: BusinessDb = getBusinessDb(),
): Promise<AppRecord> {
  return db.transaction(async (tx) => {
    const [app] = await tx
      .update(apps)
      .set(input.name === undefined ? {} : { name: input.name })
      .where(eq(apps.key, appKey))
      .returning(appColumns)
    if (!app) throw new Error('APP_NOT_FOUND')
    if (input.origin !== undefined) {
      await tx.delete(appOrigins).where(eq(appOrigins.appId, app.id))
      await tx.insert(appOrigins).values({ appId: app.id, origin: input.origin })
    }
    return app
  })
}

// Cascades to origins, memberships, keys, notifications, subscriptions, and tokens.
export async function deleteApp(appKey: string, db: BusinessDb = getBusinessDb()): Promise<void> {
  await db.delete(apps).where(eq(apps.key, appKey))
}

export type AppChannelSetting = { enabled: boolean; config: Record<string, unknown> }
// The dashboard and host view: whether a secret is set, never the secret.
export type AppChannelView = AppChannelSetting & { secretConfigured: boolean }

// Absent row means enabled with plugin defaults.
export async function getAppChannelSettings(
  appId: string,
  db: BusinessDb = getBusinessDb(),
): Promise<Record<string, AppChannelView>> {
  const rows = await db
    .select({
      channel: appChannels.channel,
      enabled: appChannels.enabled,
      config: appChannels.config,
      secretConfigured: sql<boolean>`${appChannels.signingSecretEncrypted} is not null`,
    })
    .from(appChannels)
    .where(eq(appChannels.appId, appId))
  const settings: Record<string, AppChannelView> = {}
  for (const row of rows) {
    settings[row.channel] = {
      enabled: row.enabled,
      config: (row.config ?? {}) as Record<string, unknown>,
      secretConfigured: row.secretConfigured,
    }
  }
  return settings
}

// The sealed secret is written only through this function; reads for delivery go through
// loadAppChannelRuntime, and listings only ever see `secretConfigured`.
export async function setAppChannelSecret(
  appId: string,
  channel: NotificationChannelKind,
  sealed: string,
  db: BusinessDb = getBusinessDb(),
): Promise<void> {
  await db
    .insert(appChannels)
    .values({ appId, channel, signingSecretEncrypted: sealed })
    .onConflictDoUpdate({
      target: [appChannels.appId, appChannels.channel],
      set: { signingSecretEncrypted: sealed },
    })
}

// Stores a secret only while none is stored. One statement, so two callers racing on the first
// registration cannot both win: exactly one gets `true`, and only that caller may return the secret.
export async function setAppChannelSecretIfAbsent(
  appId: string,
  channel: NotificationChannelKind,
  sealed: string,
  db: BusinessDb = getBusinessDb(),
): Promise<boolean> {
  const stored = await db
    .insert(appChannels)
    .values({ appId, channel, signingSecretEncrypted: sealed })
    .onConflictDoUpdate({
      target: [appChannels.appId, appChannels.channel],
      set: { signingSecretEncrypted: sealed },
      setWhere: isNull(appChannels.signingSecretEncrypted),
    })
    .returning({ appId: appChannels.appId })
  return stored.length > 0
}

export type AppChannelRuntime = {
  config: Record<string, unknown>
  signingSecretEncrypted: string | null
}

// Settings a delivery needs, for many apps at once; an app with no row gets the defaults.
export async function loadAppChannelRuntime(
  appIds: readonly string[],
  channel: NotificationChannelKind,
  db: BusinessDb = getBusinessDb(),
): Promise<Map<string, AppChannelRuntime>> {
  const runtime = new Map<string, AppChannelRuntime>()
  if (appIds.length === 0) return runtime
  const rows = await db
    .select({
      appId: appChannels.appId,
      config: appChannels.config,
      signingSecretEncrypted: appChannels.signingSecretEncrypted,
    })
    .from(appChannels)
    .where(and(inArray(appChannels.appId, [...appIds]), eq(appChannels.channel, channel)))
  for (const row of rows) {
    runtime.set(row.appId, {
      config: (row.config ?? {}) as Record<string, unknown>,
      signingSecretEncrypted: row.signingSecretEncrypted,
    })
  }
  return runtime
}

export async function setAppChannelSetting(
  appId: string,
  channel: NotificationChannelKind,
  patch: { enabled?: boolean; config?: Record<string, unknown> },
  db: BusinessDb = getBusinessDb(),
): Promise<AppChannelSetting> {
  const [row] = await db
    .insert(appChannels)
    .values({ appId, channel, enabled: patch.enabled ?? true, config: patch.config ?? {} })
    .onConflictDoUpdate({
      target: [appChannels.appId, appChannels.channel],
      set: {
        ...(patch.enabled === undefined ? {} : { enabled: patch.enabled }),
        ...(patch.config === undefined ? {} : { config: patch.config }),
      },
    })
    .returning({ enabled: appChannels.enabled, config: appChannels.config })
  return { enabled: row?.enabled ?? true, config: (row?.config ?? {}) as Record<string, unknown> }
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return slug || 'app'
}
