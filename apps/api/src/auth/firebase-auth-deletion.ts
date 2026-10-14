import { Inject, Injectable, Logger, Optional, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';

import {
    createFirebaseAuthAdmin,
    emailCleanupSubject,
    firebaseAdminConfigProblem,
    firebaseDeletionTargets,
    firebaseErrorCode,
    isFirebaseUid,
    isFirebaseUserNotFound,
    type FirebaseAuthAdmin,
    type LinkedAccount,
} from './firebase-auth-admin.js';

/** Not registered. Nest leaves it empty so the client is built from the env. */
export const FIREBASE_AUTH_ADMIN = Symbol('FIREBASE_AUTH_ADMIN');

type CleanupQuery = {
    query(
        text: string,
        values?: readonly unknown[],
    ): Promise<{ rows: { subject: string }[] }>;
};

/**
 * Deletes the Firebase Auth user after the database row is gone.
 * `auth/user-not-found` is success. Any other failure is queued in
 * `authCleanup` and retried, and does not fail DELETE /users/me.
 */
@Injectable()
export class FirebaseAuthDeletion implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(FirebaseAuthDeletion.name);
    private pool: Pool | null = null;
    private retryTimer: ReturnType<typeof setTimeout> | null = null;
    private open: (() => CleanupQuery) | null = null;
    private resolved: Promise<FirebaseAuthAdmin | null> | null = null;

    /**
     * Omit the client to build one from FIREBASE_SERVICE_ACCOUNT_JSON.
     * Pass null when Admin is intentionally off (unit tests).
     */
    constructor(
        @Optional()
        @Inject(FIREBASE_AUTH_ADMIN)
        private readonly injected?: FirebaseAuthAdmin | null,
    ) {}

    bindQuery(open: () => CleanupQuery): void {
        this.open = open;
    }

    async onModuleInit(): Promise<void> {
        const problem = firebaseAdminConfigProblem();
        if (problem) this.logger.error(problem);
        try {
            await this.retryPending();
        } catch (error) {
            this.logger.warn(`Firebase Auth cleanup retry skipped: ${errorText(error)}`);
        }
    }

    async onModuleDestroy(): Promise<void> {
        this.stop();
        await this.pool?.end();
        this.pool = null;
    }

    /**
     * Caller has already deleted the user row. This never throws.
     * True only when every `deleteUser` for this account succeeded or
     * returned `auth/user-not-found`. No uid, a missing Admin client, and
     * any other failure are false.
     */
    async removeForDeletedAccount(
        accounts: readonly LinkedAccount[],
        email: unknown,
    ): Promise<boolean> {
        const targets = firebaseDeletionTargets(accounts, email);
        if (targets.uids.length === 0 && !targets.lookupEmail) return false;
        try {
            await this.retryPending();
        } catch (error) {
            this.logger.error(`Firebase Auth cleanup retry failed: ${errorText(error)}`);
        }
        let deleted = true;
        for (const uid of targets.uids) {
            if (!await this.deleteUid(uid)) deleted = false;
        }
        if (targets.lookupEmail && !await this.deleteByEmail(targets.lookupEmail)) {
            deleted = false;
        }
        return deleted;
    }

    async retryPending(): Promise<void> {
        const subjects = await this.pending();
        for (const subject of subjects) {
            if (subject.startsWith('email:')) {
                const email = subject.slice('email:'.length);
                await this.deleteByEmail(email);
                continue;
            }
            if (!isFirebaseUid(subject)) {
                await this.forget(subject);
                continue;
            }
            await this.deleteUid(subject);
        }
    }

    stop(): void {
        if (!this.retryTimer) return;
        clearTimeout(this.retryTimer);
        this.retryTimer = null;
    }

    private async deleteByEmail(email: string): Promise<boolean> {
        const subject = emailCleanupSubject(email);
        if (!subject) return false;
        const auth = await this.admin();
        if (!auth) {
            await this.record(subject, 'Firebase Admin is not configured');
            return false;
        }
        try {
            const user = await auth.getUserByEmail(email);
            await this.forget(subject);
            return this.deleteUid(user.uid);
        } catch (error) {
            if (isFirebaseUserNotFound(error)) {
                await this.forget(subject);
                return false;
            }
            await this.record(subject, errorText(error));
            this.logger.error(
                `Firebase Auth lookup failed during account deletion: ${firebaseErrorCode(error)}`,
            );
            return false;
        }
    }

    private async deleteUid(uid: string): Promise<boolean> {
        if (!isFirebaseUid(uid)) return false;
        const auth = await this.admin();
        if (!auth) {
            await this.record(uid, 'Firebase Admin is not configured');
            return false;
        }
        try {
            await auth.deleteUser(uid);
            await this.forget(uid);
            return true;
        } catch (error) {
            if (isFirebaseUserNotFound(error)) {
                await this.forget(uid);
                return true;
            }
            await this.record(uid, errorText(error));
            this.logger.error(
                `Firebase Auth delete failed during account deletion: ${firebaseErrorCode(error)}`,
            );
            return false;
        }
    }

    private async admin(): Promise<FirebaseAuthAdmin | null> {
        if (this.injected !== undefined) return this.injected;
        this.resolved ??= createFirebaseAuthAdmin().catch((error) => {
            this.logger.error(
                `Firebase Admin failed to start: ${error instanceof Error ? error.name : 'Error'}`,
            );
            return null;
        });
        return this.resolved;
    }

    private async record(subject: string, error: string): Promise<void> {
        if (!isFirebaseUid(subject) && !subject.startsWith('email:')) return;
        try {
            await this.connection().query(
                `INSERT INTO "authCleanup" ("subject", "lastError")
                 VALUES ($1, $2)
                 ON CONFLICT ("subject") DO UPDATE
                 SET "lastError" = EXCLUDED."lastError",
                     attempts = "authCleanup".attempts + 1,
                     "updatedAt" = now()`,
                [subject, error.slice(0, 500)],
            );
            this.scheduleRetry();
        } catch (failure) {
            this.logger.error(`Could not queue Firebase Auth cleanup: ${errorText(failure)}`);
        }
    }

    private async pending(): Promise<string[]> {
        const result = await this.connection().query(
            'SELECT "subject" FROM "authCleanup" ORDER BY "createdAt"',
        );
        return result.rows.map((row) => row.subject);
    }

    private async forget(subject: string): Promise<void> {
        try {
            await this.connection().query(
                'DELETE FROM "authCleanup" WHERE "subject" = $1',
                [subject],
            );
        } catch (error) {
            this.logger.error(`Could not clear Firebase Auth cleanup: ${errorText(error)}`);
        }
    }

    private scheduleRetry(): void {
        if (this.retryTimer) return;
        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            void this.retryPending().catch((error) => {
                this.logger.error(`Firebase Auth cleanup retry failed: ${errorText(error)}`);
            });
        }, 60_000);
        this.retryTimer.unref?.();
    }

    private connection(): CleanupQuery {
        if (this.open) return this.open();
        if (!this.pool) {
            const url = process.env['DATABASE_URL'];
            if (!url) throw new Error('DATABASE_URL is required to record Firebase Auth cleanup');
            this.pool = new Pool({ connectionString: url, max: 2 });
        }
        return this.pool as unknown as CleanupQuery;
    }
}

function errorText(error: unknown): string {
    return error instanceof Error ? error.message : 'Firebase Auth delete failed';
}
