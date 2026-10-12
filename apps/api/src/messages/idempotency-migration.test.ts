import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const migrationsRoot = fileURLToPath(new URL('../../migrations/app', import.meta.url));
const AGE_HASH = '75dc65ac17c5defb76dc683d91b5af7bff8567dcd77675fa3c46e1296927baa5';
const MIGRATION = '20261012T1000_add_message_idempotency_key';

test('the idempotency migration sorts after storage cleanup and chains from user age', () => {
    assert.ok(MIGRATION > '20261012T0947_add_storage_cleanup');
    const dir = join(migrationsRoot, MIGRATION);
    const manifest = JSON.parse(readFileSync(join(dir, 'migration.json'), 'utf8')) as {
        from: string;
        to: string;
    };
    const ref = JSON.parse(readFileSync(join(migrationsRoot, 'refs/db.json'), 'utf8')) as {
        hash: string;
    };
    const sql = (JSON.parse(readFileSync(join(dir, 'ops.json'), 'utf8')) as Array<{
        execute?: Array<{ sql?: string }>;
    }>)
        .flatMap((op) => op.execute ?? [])
        .map((step) => step.sql ?? '')
        .join('\n');

    assert.equal(manifest.from, AGE_HASH);
    assert.equal(ref.hash, manifest.to);
    assert.match(sql, /ALTER TABLE "public"\."message" ADD COLUMN "idempotencyKey" text/);
    assert.match(sql, /ALTER TABLE "public"\."message" ADD COLUMN "userId" int4/);
    assert.match(
        sql,
        /ADD CONSTRAINT "message_userId_idempotencyKey_key" UNIQUE \("userId", "idempotencyKey"\)/,
    );
});
