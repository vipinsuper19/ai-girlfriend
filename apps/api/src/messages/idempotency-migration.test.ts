import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const migrationsRoot = fileURLToPath(new URL('../../migrations/app', import.meta.url));
const DELETION_HASH = '87ad90ce3a7336ae8a589d64aec851b075387fc822fca3dc3d6d374880de4fa1';
const MIGRATION = '20261012T1020_add_message_idempotency_key';

test('the idempotency migration sorts after deletion request and chains from it', () => {
    assert.ok(MIGRATION > '20261012T1013_deletion_request_after_storage');
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

    assert.equal(manifest.from, DELETION_HASH);
    assert.equal(manifest.to, '6afb1ed044483b010a3ad7b98f053ca39bc0a58954913a503d04694fe7a090bb');
    const minorHold = JSON.parse(
        readFileSync(join(migrationsRoot, '20261012T1030_add_minor_hold/migration.json'), 'utf8'),
    ) as { from: string; to: string };
    assert.equal(minorHold.from, manifest.to);
    assert.equal(ref.hash, minorHold.to);
    assert.match(sql, /ALTER TABLE "public"\."message" ADD COLUMN "idempotencyKey" text/);
    assert.match(sql, /ALTER TABLE "public"\."message" ADD COLUMN "userId" int4/);
    assert.match(
        sql,
        /ADD CONSTRAINT "message_userId_idempotencyKey_key" UNIQUE \("userId", "idempotencyKey"\)/,
    );
});
