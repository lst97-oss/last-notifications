import { z } from 'zod'

export const adminSignupSchema = z.strictObject({
  name: z.string().trim().min(1, 'Enter a name').max(120),
  email: z.email('Enter a valid email address'),
  password: z.string().min(8, 'Use at least 8 characters').max(128),
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
