import 'dotenv/config';
import pgvector from '@prisma/orm-extension-pgvector/runtime';
import postgres from '@prisma/orm-postgres/runtime';

import type { Contract } from './contract.d.js';
import contractJson from './contract.json' with { type: 'json' };

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