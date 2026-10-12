import 'dotenv/config';

import { definePrismaConfig } from '@prisma/cli-engine';
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config';
import pgvector from '@prisma/orm-extension-pgvector/control';

export default definePrismaConfig({
  orm: ormConfig({
    contract: './src/prisma/contract.prisma',

    extensions: [pgvector],

    db: {
      // Migrations and other CLI work need a direct session connection (Supabase
      // port 5432). The app runtime uses DATABASE_URL (pooler, port 6543,
      // ?pgbouncer=true) in src/prisma/db.ts.
      connection: (process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'])!,
    },
  }),
});
