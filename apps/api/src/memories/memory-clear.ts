export type ClearableMemory = {
    deletedAt?: string | null;
    status?: string | null;
    companionId?: number | null;
};

/** An active, not-yet-deleted row. A companion id limits the wipe to her. */
export function isClearedMemory(
    row: ClearableMemory,
    companionId?: number | null,
): boolean {
    if (row.deletedAt != null) {
        return false;
    }

    if (row.status != null && row.status !== 'ACTIVE') {
        return false;
    }

    if (
        companionId != null &&
        row.companionId !== companionId
    ) {
        return false;
    }

    return true;
}

export function clearedCount(
    rows: readonly ClearableMemory[],
    companionId?: number | null,
): number {
    return rows.filter((row) =>
        isClearedMemory(row, companionId),
    ).length;
}
