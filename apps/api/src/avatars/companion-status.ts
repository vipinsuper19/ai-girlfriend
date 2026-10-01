export type CompanionListStatus = 'ACTIVE' | 'ARCHIVED';

export function listStatus(
    status: string | null | undefined,
): CompanionListStatus {
    return status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE';
}

export function archiveFields(now: string): {
    status: 'ARCHIVED';
    archivedAt: string;
} {
    return {
        status: 'ARCHIVED',
        archivedAt: now,
    };
}

export function restoreFields(): {
    status: 'ACTIVE';
    archivedAt: null;
} {
    return {
        status: 'ACTIVE',
        archivedAt: null,
    };
}

/** Null when this companion can be opened again. */
export function restoreProblem(
    status: string | null | undefined,
): string | null {
    if (status === 'ACTIVE' || status === 'ARCHIVED') {
        return null;
    }

    return 'Companion not found';
}
