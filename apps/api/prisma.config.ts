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
      // Render is a native Node service. Its start command runs `db:migrate`
      // with this URL, then `start:prod`. An empty DIRECT_URL falls through to
      // DATABASE_URL here; production boot still refuses to listen without
      // DIRECT_URL. The Docker entrypoint is not what Render runs, and that
      // script exits before migrating when DIRECT_URL is unset. The runtime
      // pool is DATABASE_URL in src/prisma/db.ts, and that URL must also be
      // the session pooler: port 6543 rejects named prepared statements.
      connection: (process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'])!,
    },
  }),
});
