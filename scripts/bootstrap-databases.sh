#!/bin/sh
# The local Postgres serves two databases: Payload's and the business/auth one.
# This runs once, on an empty data directory.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  SELECT 'CREATE DATABASE notifications_business'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'notifications_business')\gexec
EOSQL
