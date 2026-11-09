import { describe, expect, test } from 'bun:test'

import { adminFormSchema, adminSignupSchema } from '@/lib/admin-schema'

const form = { name: 'Ada', email: 'ada@example.com', password: 'correct horse', confirmPassword: 'correct horse' }

describe('adminFormSchema', () => {
  test('matching passwords pass', () => {
    expect(adminFormSchema.safeParse(form).success).toBe(true)
  })

  test('a mismatch is reported on the retype field, not the password', () => {
    const result = adminFormSchema.safeParse({ ...form, confirmPassword: 'correct horse!' })
    if (result.success) throw new Error('expected the mismatch to fail')
    expect(result.error.issues).toMatchObject([{ path: ['confirmPassword'], message: 'Passwords do not match' }])
  })

  test('an empty retype field asks for it', () => {
    const result = adminFormSchema.safeParse({ ...form, confirmPassword: '' })
    if (result.success) throw new Error('expected the empty retype to fail')
    expect(result.error.issues).toMatchObject([{ path: ['confirmPassword'], message: 'Retype your password' }])
  })
})

describe('adminSignupSchema', () => {
  test('the server schema rejects the retype field, so the form must strip it before sending', () => {
    expect(adminSignupSchema.safeParse(form).success).toBe(false)
    const { confirmPassword: _retype, ...account } = form
    expect(adminSignupSchema.safeParse(account).success).toBe(true)
  })
})
