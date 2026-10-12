import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const migrationsRoot = fileURLToPath(new URL('../../migrations', import.meta.url));

function opsFiles(dir: string, found: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
            opsFiles(path, found);
        } else if (name === 'ops.json') {
            found.push(path);
        }
    }
    return found;
}

test('pgvector migrations create the extension named vector', () => {
    const statements: string[] = [];
    for (const file of opsFiles(migrationsRoot)) {
        const ops = JSON.parse(readFileSync(file, 'utf8')) as Array<{
            execute?: Array<{ sql?: string }>;
        }>;
        for (const op of ops) {
            for (const step of op.execute ?? []) {
                if (step.sql?.includes('CREATE EXTENSION')) {
                    statements.push(step.sql);
                }
            }
        }
    }

    assert.ok(statements.length > 0);
    for (const sql of statements) {
        assert.match(sql, /CREATE EXTENSION IF NOT EXISTS vector\b/);
        assert.equal(sql.includes('pgvector'), false);
    }
});

test('the user age migration stores the confirmation time and not the date of birth', () => {
    const sql = opsFiles(migrationsRoot)
        .filter((file) => file.includes('add_user_age'))
        .flatMap((file) => JSON.parse(readFileSync(file, 'utf8')) as Array<{ execute?: Array<{ sql?: string }> }>)
        .flatMap((op) => op.execute ?? [])
        .map((step) => step.sql ?? '')
        .join('\n');

    assert.match(sql, /ALTER TABLE "public"\."user" ADD COLUMN "ageConfirmedAt" timestamptz/);
    assert.equal(sql.includes('dateOfBirth'), false);
});
