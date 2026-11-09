import { z } from 'zod'

import { API_KEY_SCOPES, FEATURES } from '@/lib/api-key-scopes'

export const adminSignupSchema = z.strictObject({
  name: z.string().trim().min(1, 'Enter a name').max(120),
  email: z.email('Enter a valid email address'),
  password: z.string().min(8, 'Use at least 8 characters').max(128),
})

// The first-admin form adds a retyped password. It is checked in the browser and never sent: the server takes
// adminSignupSchema, which rejects unknown keys.
export const adminFormSchema = adminSignupSchema
  .extend({ confirmPassword: z.string().min(1, 'Retype your password') })
  // An empty retype is reported by the field's own rule, so only a filled-in mismatch is reported here.
  .refine((value) => value.confirmPassword === '' || value.password === value.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const appFormSchema = z.strictObject({
  name: z.string().trim().min(1, 'Enter an app name').max(120),
  origin: z
    .string()
    .trim()
    .max(2048, 'Origin must be at most 2048 characters')
    .refine((value) => {
      try {
        const url = new URL(value)
        return ['http:', 'https:'].includes(url.protocol) && url.pathname === '/' && !url.search && !url.hash
      } catch {
        return false
      }
    }, 'Enter an origin like https://app.example.com — scheme and host only'),
})

// The key forms mirror keyCreateSchema and keyUpdateSchema on the server. The server still decides;
// its message shows if the two ever disagree.
export const apiKeyCreateFormSchema = z.object({
  target: z
    .string()
    .nullable()
    .refine((value) => Boolean(value), 'Choose an app'),
  name: z.string().trim().min(1, 'Enter a name').max(120, 'Use at most 120 characters'),
  // The feature and expiry choices are form state: the form needs them in its shape, and the server never sees them.
  features: z.array(z.enum(FEATURES)),
  expiry: z.enum(['30d', '90d', '1y', 'never']),
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1, 'Choose at least one permission'),
  perMinute: z
    .number({ error: 'Enter a number' })
    .int('Enter a whole number')
    .min(1, 'Use at least 1 request a minute')
    .max(1_000_000, 'Use at most 1,000,000 requests a minute'),
})

export const apiKeyEditFormSchema = z.object({
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1, 'Choose at least one permission'),
})
