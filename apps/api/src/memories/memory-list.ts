export type MemoryListQuery = {
    type?: string;
    companionId?: number;
    conversationId?: number;
};

export const MEMORY_CONTENT_MAX = 2000;

/** Filters go into the query so the limit counts only the rows asked for. */
export function memoryListWhere(
    userId: string | number,
    query: MemoryListQuery,
): Record<string, unknown> {
    const where: Record<string, unknown> = {
        userId: Number(userId),
        status: 'ACTIVE',
        deletedAt: null,
    };

    if (query.type) where.type = query.type;
    if (query.companionId != null) where.companionId = Number(query.companionId);
    if (query.conversationId != null) where.conversationId = Number(query.conversationId);

    return where;
}

/** A content edit needs a fresh embedding, or recall still matches the old wording. */
export function needsReembedding(
    before: string | null | undefined,
    after: string | undefined,
): boolean {
    return after !== undefined && after !== (before ?? '');
}
