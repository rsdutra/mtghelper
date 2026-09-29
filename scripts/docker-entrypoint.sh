#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

if [ -z "${AUTH_SECRET:-}" ]; then
  echo "AUTH_SECRET is required" >&2
  exit 1
fi

echo "Waiting for Postgres..."
i=0
until psql "$DATABASE_URL" -c "SELECT 1" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "Postgres did not become ready in time" >&2
    exit 1
  fi
  sleep 2
done

echo "Applying SQL schema/migrations..."
node scripts/migrate.mjs

echo "Starting Next.js..."
exec node server.js
