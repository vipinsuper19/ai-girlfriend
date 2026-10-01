export const MESSAGE_PAGE_MAX = 100;

export type MessagePageRow = {
    id: number;
    createdAt?: string | null;
    deletedAt?: string | null;
};

export type MessagePageQuery = {
    before?: number | null;
    limit?: number | null;
};

/** Omit the limit to keep the whole thread. A provided limit stays inside 1..100. */
export function messagePageLimit(
    limit: number | null | undefined,
): number | null {
    if (limit == null) {
        return null;
    }

    return Math.min(Math.max(Math.trunc(limit), 1), MESSAGE_PAGE_MAX);
}

/**
 * Messages before a known id, newest page first in the selection, then oldest-first
 * in the result. No cursor and no limit returns every visible row.
 */
export function messagePage<T extends MessagePageRow>(
    rows: readonly T[],
    query: MessagePageQuery,
): T[] {
    const visible = rows.filter((row) => row.deletedAt == null);
    const before = query.before ?? null;
    const eligible =
        before == null
            ? visible
            : visible.filter((row) => row.id < before);
    const limit = messagePageLimit(query.limit);

    if (before == null && limit == null) {
        return orderMessagePage(eligible);
    }

    const newest = [...eligible].sort((left, right) => right.id - left.id);
    const page = limit == null ? newest : newest.slice(0, limit);

    return orderMessagePage(page);
}

export function orderMessagePage<T extends MessagePageRow>(
    rows: readonly T[],
): T[] {
    return [...rows].sort((left, right) => {
        const leftAt = left.createdAt ?? '';
        const rightAt = right.createdAt ?? '';

        if (leftAt !== rightAt) {
            return leftAt < rightAt ? -1 : 1;
        }

        return left.id - right.id;
    });
}
