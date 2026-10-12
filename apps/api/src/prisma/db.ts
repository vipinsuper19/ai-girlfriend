import 'dotenv/config';
import pgvector from '@prisma/orm-extension-pgvector/runtime';
import postgres from '@prisma/orm-postgres/runtime';

import type { Contract } from './contract.d.js';
import contractJson from './contract.json' with { type: 'json' };

// Runtime connection. Use the Supabase session pooler on port 5432
// (*.pooler.supabase.com). The transaction pooler on port 6543 does not
// work: postgres() from @prisma/orm-postgres sends named prepared statements
// (pn_N) and its public options have no preparedStatements switch. node-postgres
// also ignores ?pgbouncer=true, so that flag does not turn them off.
// Migrations use DIRECT_URL via prisma.config.ts and the container entrypoint.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not defined. Check apps/api/.env and dotenv configuration.',
  );
}

export const db = postgres<Contract>({
  contractJson,
  url: connectionString,
  extensions: [pgvector],
});