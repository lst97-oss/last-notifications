import * as migration_20261011_initial_users_schema from '@/payload/migrations/20261011_initial-users-schema';

export const migrations = [
  {
    up: migration_20261011_initial_users_schema.up,
    down: migration_20261011_initial_users_schema.down,
    name: '20261011_initial-users-schema'
  },
];
