export type ReplySubject = {
    id: number;
    role: string;
    conversationId: number;
    deletedAt?: string | null;
};

/**
 * Retry is only for the latest user line in a conversation the caller owns.
 * An assistant row, a deleted row, or a line from another conversation is
 * the same 404 as a missing id, so ownership is not leaked.
 */
export function replyTargetProblem(
    message: ReplySubject | null | undefined,
    conversationId: number,
    laterUserMessage: boolean,
): 'not_found' | 'not_latest' | null {
    if (!message || message.deletedAt != null) return 'not_found';
    if (message.conversationId !== conversationId) return 'not_found';
    if (message.role !== 'USER') return 'not_found';
    if (laterUserMessage) return 'not_latest';
    return null;
}
