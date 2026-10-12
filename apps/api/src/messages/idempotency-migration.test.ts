import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const migrationsRoot = fileURLToPath(new URL('../../migrations/app', import.meta.url));
const DELETION_HASH = '87ad90ce3a7336ae8a589d64aec851b075387fc822fca3dc3d6d374880de4fa1';
const MIGRATION = '20261012T1020_add_message_idempotency_key';
const AUTH_CLEANUP = '20261012T1527_add_auth_cleanup';

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
    const authDir = join(migrationsRoot, AUTH_CLEANUP);
    const auth = JSON.parse(readFileSync(join(authDir, 'migration.json'), 'utf8')) as {
        from: string;
        to: string;
    };
    assert.ok(AUTH_CLEANUP > MIGRATION);
    assert.equal(auth.from, manifest.to);
    assert.equal(ref.hash, auth.to);
    assert.match(sql, /ALTER TABLE "public"\."message" ADD COLUMN "idempotencyKey" text/);
    assert.match(sql, /ALTER TABLE "public"\."message" ADD COLUMN "userId" int4/);
    assert.match(
        sql,
        /ADD CONSTRAINT "message_userId_idempotencyKey_key" UNIQUE \("userId", "idempotencyKey"\)/,
    );
});
