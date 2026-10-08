export type LastMessageSource = {
    id: number;
    role?: string | null;
    type?: string | null;
    content?: string | null;
    createdAt?: string | null;
    deletedAt?: string | null;
};

export type LastMessageSnapshot = {
    id: number;
    role: string;
    type: string;
    content: string | null;
};

/** Newest non-deleted row. Equal timestamps keep the higher id. */
export function latestVisibleMessage<T extends LastMessageSource>(
    rows: readonly T[],
): T | null {
    const visible = rows.filter((row) => row.deletedAt == null);

    if (visible.length === 0) {
        return null;
    }

    return [...visible].sort((left, right) => {
        const leftAt = left.createdAt ?? '';
        const rightAt = right.createdAt ?? '';

        if (leftAt !== rightAt) {
            return leftAt < rightAt ? 1 : -1;
        }

        return right.id - left.id;
    })[0];
}

export function lastMessageSnapshot(
    row: LastMessageSource | null | undefined,
): LastMessageSnapshot | null {
    if (!row || row.deletedAt != null) {
        return null;
    }

    const type =
        typeof row.type === 'string' && row.type.trim()
            ? row.type
            : 'TEXT';

    return {
        id: row.id,
        role:
            typeof row.role === 'string' && row.role
                ? row.role
                : 'USER',
        type,
        content:
            typeof row.content === 'string'
                ? row.content
                : null,
    };
}
