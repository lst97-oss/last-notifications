import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  authorship: false,
  auth: true,
  admin: {
    useAsTitle: 'email',
  },
  fields: [],
}
