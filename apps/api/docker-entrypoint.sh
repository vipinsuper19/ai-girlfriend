#!/bin/sh
set -eu

echo "Enable the vector extension in Supabase before the first boot (Database → Extensions → vector)."
echo "Migrations replay on-disk files, including CREATE EXTENSION IF NOT EXISTS vector, and that statement fails until the extension is available."
echo "Migrations use DIRECT_URL (Supabase session pooler, port 5432)."

if [ -z "${DIRECT_URL:-}" ]; then
  echo "DIRECT_URL is not set. Refusing to migrate through DATABASE_URL." >&2
  exit 1
fi

node --run db:migrate
exec node dist/main.js
