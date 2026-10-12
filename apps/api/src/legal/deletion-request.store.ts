import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { DELETION_REQUEST_RETENTION_DAYS } from './contact.js';

export const DELETION_REQUEST_STORE = Symbol('DELETION_REQUEST_STORE');

export const DELETION_REQUEST_RETENTION_MS =
    DELETION_REQUEST_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export type StoredDeletionRequest = {
    email: string;
    note: string;
    createdAt: string;
};

export interface DeletionRequestStore {
    save(request: StoredDeletionRequest, now?: Date): Promise<void>;
}

export class MemoryDeletionRequestStore implements DeletionRequestStore {
    readonly saved: StoredDeletionRequest[] = [];

    async save(request: StoredDeletionRequest): Promise<void> {
        this.saved.push(request);
    }
}

/**
 * One JSON object per line. Rows older than the retention window are dropped
 * on the next write. The file lives on the API disk, which on Render is ephemeral,
 * so the mailer is the copy that survives a restart when SMTP is configured.
 */
export class FileDeletionRequestStore implements DeletionRequestStore {
    constructor(
        private readonly filePath = join(
            process.cwd(),
            'data',
            'account-deletion-requests.jsonl',
        ),
        private readonly retentionMs = DELETION_REQUEST_RETENTION_MS,
    ) {}

    async save(request: StoredDeletionRequest, now = new Date()): Promise<void> {
        const cutoff = now.getTime() - this.retentionMs;
        const existing = await this.read();
        const kept = existing.filter((row) => Date.parse(row.createdAt) >= cutoff);
        kept.push(request);
        await mkdir(dirname(this.filePath), { recursive: true });
        const body = kept.map((row) => JSON.stringify(row)).join('\n') + '\n';
        await writeFile(this.filePath, body, 'utf8');
    }

    async read(): Promise<StoredDeletionRequest[]> {
        let raw: string;
        try {
            raw = await readFile(this.filePath, 'utf8');
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
            throw error;
        }
        return raw
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .flatMap((line) => {
                try {
                    const row = JSON.parse(line) as StoredDeletionRequest;
                    if (typeof row.email !== 'string' || typeof row.createdAt !== 'string') {
                        return [];
                    }
                    return [{
                        email: row.email,
                        note: typeof row.note === 'string' ? row.note : '',
                        createdAt: row.createdAt,
                    }];
                } catch {
                    return [];
                }
            });
    }
}
