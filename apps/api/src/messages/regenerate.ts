export type ThreadRow = {
    id: number;
    role: string;
    deletedAt?: string | null;
};

/**
 * Only her latest reply can be regenerated, so the context she answers from
 * is the same thread the user saw.
 */
export function regenerateProblem(
    target: ThreadRow | null | undefined,
    newest: ThreadRow | null | undefined,
): string | null {
    if (!target || target.deletedAt != null) return 'Message not found';
    if (target.role !== 'ASSISTANT') return 'Only her replies can be regenerated';
    if (!newest || newest.id !== target.id) return 'Only her latest reply can be regenerated';
    return null;
}
