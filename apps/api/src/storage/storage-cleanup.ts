import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';

import { isCleanupKey } from './object-key.js';
import { OBJECT_STORAGE, type ObjectStorage } from './object-storage.js';
import type { StorageFailure } from '../users/account-deletion.js';

type CleanupQuery = {
    query(
        text: string,
        values?: readonly unknown[],
    ): Promise<{ rows: { objectKey: string }[] }>;
};

/**
 * Failed object deletes outlive the user row. Android treats a later 404 as
 * "already deleted", so the retry cannot depend on the account still existing.
 */
@Injectable()
export class StorageCleanup implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(StorageCleanup.name);
    private pool: Pool | null = null;
    private retryTimer: ReturnType<typeof setTimeout> | null = null;
    private open: (() => CleanupQuery) | null = null;

    constructor(
        @Inject(OBJECT_STORAGE)
        private readonly objects: ObjectStorage,
    ) {}

    /** Tests pass a query double so recording does not need Postgres. */
    bindQuery(open: () => CleanupQuery): void {
        this.open = open;
    }

    async onModuleInit(): Promise<void> {
        try {
            await this.retryPending();
        } catch (error) {
            this.logger.warn(`Storage cleanup retry skipped: ${errorText(error)}`);
        }
    }

    async onModuleDestroy(): Promise<void> {
        this.stop();
        await this.pool?.end();
        this.pool = null;
    }

    async record(failures: readonly StorageFailure[]): Promise<void> {
        const keys = failures.filter((failure) => {
            if (isCleanupKey(failure.key)) return true;
            throw new Error(`Refusing to queue a storage key that cannot be retried safely: ${failure.key}`);
        });
        if (keys.length === 0) return;

        const db = this.connection();
        for (const failure of keys) {
            await db.query(
                `INSERT INTO "storageCleanup" ("objectKey", "lastError")
                 VALUES ($1, $2)
                 ON CONFLICT ("objectKey") DO UPDATE
                 SET "lastError" = EXCLUDED."lastError",
                     attempts = "storageCleanup".attempts + 1,
                     "updatedAt" = now()`,
                [failure.key, failure.error.slice(0, 500)],
            );
        }
        this.scheduleRetry();
    }

    async pending(): Promise<string[]> {
        const result = await this.connection().query(
            'SELECT "objectKey" FROM "storageCleanup" ORDER BY "createdAt"',
        );
        return result.rows.map((row) => row.objectKey);
    }

    async forget(key: string): Promise<void> {
        await this.connection().query(
            'DELETE FROM "storageCleanup" WHERE "objectKey" = $1',
            [key],
        );
    }

    async retryPending(): Promise<void> {
        const keys = await this.pending();
        for (const key of keys) {
            if (!isCleanupKey(key)) {
                await this.forget(key);
                continue;
            }
            try {
                await this.deleteStored(key);
                await this.forget(key);
            } catch (error) {
                await this.connection().query(
                    `UPDATE "storageCleanup"
                     SET attempts = attempts + 1, "lastError" = $2, "updatedAt" = now()
                     WHERE "objectKey" = $1`,
                    [key, errorText(error).slice(0, 500)],
                );
            }
        }
    }

    /** Clears the deferred retry. Tests call this so the timer does not outlive the case. */
    stop(): void {
        if (!this.retryTimer) return;
        clearTimeout(this.retryTimer);
        this.retryTimer = null;
    }

    private scheduleRetry(): void {
        if (this.retryTimer) return;
        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            void this.retryPending().catch((error) => {
                this.logger.warn(`Storage cleanup retry failed: ${errorText(error)}`);
            });
        }, 60_000);
        this.retryTimer.unref?.();
    }

    private async deleteStored(key: string): Promise<void> {
        if (!isCleanupKey(key)) {
            throw new Error(`Refusing to delete an unsafe storage key: ${key}`);
        }
        if (key.endsWith('/')) {
            await this.objects.deletePrefix(key);
            return;
        }
        await this.objects.delete(key);
    }

    private connection(): CleanupQuery {
        if (this.open) return this.open();
        if (!this.pool) {
            const url = process.env['DATABASE_URL'];
            if (!url) throw new Error('DATABASE_URL is required to record storage cleanup');
            this.pool = new Pool({ connectionString: url, max: 2 });
        }
        return this.pool as unknown as CleanupQuery;
    }
}

function errorText(error: unknown): string {
    return error instanceof Error ? error.message : 'Storage delete failed';
}
