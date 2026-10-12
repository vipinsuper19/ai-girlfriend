import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { DELETION_REQUEST_RETENTION_DAYS } from './contact.js';

export const DELETION_REQUEST_STORE = Symbol('DELETION_REQUEST_STORE');

export const DELETION_REQUEST_RETENTION_MS =
    DELETION_REQUEST_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export type NewDeletionRequest = {
    email: string;
    note: string;
    tokenHash: string;
    createdAt: string;
};

export type ConfirmResult =
    | { status: 'missing' }
    | { status: 'already'; email: string }
    | { status: 'confirmed'; email: string; note: string; createdAt: string };

export interface DeletionRequestStore {
    save(request: NewDeletionRequest, now?: Date): Promise<void>;
    confirm(tokenHash: string, now?: Date): Promise<ConfirmResult>;
}

type DeletionRow = {
    id: number;
    email: string;
    note: string;
    tokenHash: string;
    confirmedAt: string | null;
    createdAt: string;
};

type CreatedAtFilter = {
    lt(value: string): unknown;
};

type DeletionTable = {
    create(data: {
        email: string;
        note: string;
        tokenHash: string;
        confirmedAt: null;
        createdAt: string;
    }): Promise<DeletionRow>;
    where(filter: { tokenHash: string } | { id: number } | ((row: { createdAt: CreatedAtFilter }) => unknown)): {
        first(): Promise<DeletionRow | null>;
        update(data: { confirmedAt: string }): Promise<unknown>;
        deleteAndCount(): Promise<number>;
    };
};

export function deletionRequestCutoff(now: Date, retentionMs = DELETION_REQUEST_RETENTION_MS): string {
    return new Date(now.getTime() - retentionMs).toISOString();
}

export class MemoryDeletionRequestStore implements DeletionRequestStore {
    readonly saved: Array<NewDeletionRequest & { confirmedAt: string | null }> = [];

    constructor(private readonly retentionMs = DELETION_REQUEST_RETENTION_MS) {}

    async save(request: NewDeletionRequest, now = new Date()): Promise<void> {
        this.prune(now);
        this.saved.push({ ...request, confirmedAt: null });
    }

    async confirm(tokenHash: string, now = new Date()): Promise<ConfirmResult> {
        this.prune(now);
        const row = this.saved.find((item) => item.tokenHash === tokenHash);
        if (!row) return { status: 'missing' };
        if (row.confirmedAt) return { status: 'already', email: row.email };
        row.confirmedAt = now.toISOString();
        return {
            status: 'confirmed',
            email: row.email,
            note: row.note,
            createdAt: row.createdAt,
        };
    }

    prune(now: Date): void {
        const cutoff = Date.parse(deletionRequestCutoff(now, this.retentionMs));
        const kept = this.saved.filter((row) => Date.parse(row.createdAt) >= cutoff);
        this.saved.splice(0, this.saved.length, ...kept);
    }
}

/**
 * Rows live in Postgres. Each save and confirm runs one delete of rows older
 * than the retention window, then writes.
 */
@Injectable()
export class PrismaDeletionRequestStore implements DeletionRequestStore {
    constructor(private readonly prisma: PrismaService) {}

    async save(request: NewDeletionRequest, now = new Date()): Promise<void> {
        await this.prune(now);
        await this.table().create({
            email: request.email,
            note: request.note,
            tokenHash: request.tokenHash,
            confirmedAt: null,
            createdAt: request.createdAt,
        });
    }

    async confirm(tokenHash: string, now = new Date()): Promise<ConfirmResult> {
        await this.prune(now);
        const row = await this.table().where({ tokenHash }).first();
        if (!row) return { status: 'missing' };
        if (row.confirmedAt) return { status: 'already', email: row.email };
        await this.table().where({ id: row.id }).update({
            confirmedAt: now.toISOString(),
        });
        return {
            status: 'confirmed',
            email: row.email,
            note: row.note,
            createdAt: row.createdAt,
        };
    }

    /** Deletes every deletion request older than the retention window. */
    async prune(now = new Date()): Promise<number> {
        const cutoff = deletionRequestCutoff(now);
        return this.table()
            .where((row) => row.createdAt.lt(cutoff))
            .deleteAndCount();
    }

    private table(): DeletionTable {
        const client = this.prisma.client as {
            orm: { public: { DeletionRequest: DeletionTable } };
        };
        return client.orm.public.DeletionRequest;
    }
}
