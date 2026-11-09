import { describe, expect, test } from 'bun:test'

import { type BusinessDb, getBusinessDb } from '@/server/db/business-sql'
import { instanceAdmins, user } from '@/server/db/schema'
import {
  grantInstanceAdmin,
  hasInstanceAdmin,
  isInitialAdminSetupAvailable,
} from '@/server/modules/admin/infrastructure/admin-repository'

// The dev database may already hold a real admin, so each case runs in a transaction that is rolled back.
class Rollback extends Error {}

async function rolledBack(work: (tx: BusinessDb) => Promise<void>): Promise<void> {
  await getBusinessDb()
    .transaction(async (tx) => {
      await work(tx)
      throw new Rollback()
    })
    .catch((error) => {
      if (!(error instanceof Rollback)) throw error
    })
}

// Starts a case with no admin row and one account, both visible only inside the transaction.
async function accountWithoutAdmin(tx: BusinessDb, id: string): Promise<void> {
  await tx.delete(instanceAdmins)
  await tx.insert(user).values({ id, name: 'Setup test', email: `${id}@example.test` })
}

describe('first admin setup', () => {
  test('an account that is not an admin does not close setup', async () => {
    await rolledBack(async (tx) => {
      const id = `setup-plain-${crypto.randomUUID()}`
      await accountWithoutAdmin(tx, id)
      expect(await hasInstanceAdmin(undefined, tx)).toBe(false)
      expect(await isInitialAdminSetupAvailable(tx)).toBe(true)
    })
  })

  test('granting an existing account the admin role closes setup', async () => {
    await rolledBack(async (tx) => {
      const id = `setup-admin-${crypto.randomUUID()}`
      await accountWithoutAdmin(tx, id)
      await grantInstanceAdmin(id, tx)
      expect(await hasInstanceAdmin(id, tx)).toBe(true)
      expect(await isInitialAdminSetupAvailable(tx)).toBe(false)
    })
  })

  test('a second grant is ignored, so only the first account is admin', async () => {
    await rolledBack(async (tx) => {
      const first = `setup-first-${crypto.randomUUID()}`
      const second = `setup-second-${crypto.randomUUID()}`
      await accountWithoutAdmin(tx, first)
      await tx.insert(user).values({ id: second, name: 'Second', email: `${second}@example.test` })
      await grantInstanceAdmin(first, tx)
      await grantInstanceAdmin(second, tx)
      expect(await hasInstanceAdmin(first, tx)).toBe(true)
      expect(await hasInstanceAdmin(second, tx)).toBe(false)
    })
  })
})
