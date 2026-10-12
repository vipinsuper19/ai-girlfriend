import 'dotenv/config';

import { definePrismaConfig } from '@prisma/cli-engine';
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config';
import pgvector from '@prisma/orm-extension-pgvector/control';

export default definePrismaConfig({
  orm: ormConfig({
    contract: './src/prisma/contract.prisma',

    extensions: [pgvector],

    db: {
      // Migrations need a session connection (Supabase session pooler, port 5432).
      // The container entrypoint refuses to run when DIRECT_URL is unset, so
      // production never falls through to DATABASE_URL. Local CLI commands still
      // can. The runtime pool is DATABASE_URL in src/prisma/db.ts, and that URL
      // must also be the session pooler: port 6543 rejects named prepared statements.
      connection: (process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'])!,
    },
  }),
});
