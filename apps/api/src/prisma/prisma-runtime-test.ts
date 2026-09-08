import { db } from './db.js';

async function main() {
    console.log('Testing Prisma 8 PostgreSQL runtime...');

    const runtime = await db.connect();

    console.log(
        'runtime:',
        runtime?.constructor?.name,
    );

    /*
     * Deliberately use the simplest possible SELECT.
     * No joins.
     * No pgvector.
     * No where.
     * No computed fields.
     */
    const plan = db.sql.public.memory
        .select('id')
        .limit(1)
        .build();

    console.log('plan:', plan);

    const result = await runtime.query(plan);

    console.log(
        'result constructor:',
        result?.constructor?.name,
    );

    console.log(
        'is array:',
        Array.isArray(result),
    );

    console.log(
        'result:',
        result,
    );
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });