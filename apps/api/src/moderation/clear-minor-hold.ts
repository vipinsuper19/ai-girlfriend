export interface MinorHoldRow {
    id: number;
    minorHeldAt: string | null;
}

export interface MinorHoldStore {
    findUser(id: number): Promise<MinorHoldRow | null>;
    clearUser(id: number): Promise<void>;
    findConversation(id: number, userId: number): Promise<MinorHoldRow | null>;
    listConversations(userId: number): Promise<MinorHoldRow[]>;
    clearConversation(id: number, userId: number): Promise<void>;
}

export interface ClearMinorHoldArgs {
    userId: number;
    conversationId?: number;
}

export function parseClearMinorHoldArgs(argv: readonly string[]): ClearMinorHoldArgs {
    let userId: number | undefined;
    let conversationId: number | undefined;
    for (let index = 0; index < argv.length; index += 1) {
        const flag = argv[index];
        const value = argv[index + 1];
        if (flag === '--user') {
            userId = requireId(value, '--user');
            index += 1;
            continue;
        }
        if (flag === '--conversation') {
            conversationId = requireId(value, '--conversation');
            index += 1;
            continue;
        }
        throw new Error(`unexpected argument ${flag ?? ''}`);
    }
    if (userId === undefined) {
        throw new Error('usage: safety:clear-minor-hold -- --user <id> [--conversation <id>]');
    }
    return conversationId === undefined ? { userId } : { userId, conversationId };
}

/**
 * Clears a false-positive minor hold. The user flag is always cleared.
 * With `--conversation`, only that conversation is cleared. Without it, every
 * conversation for the user is cleared, because a stored conversation flag
 * would keep blocking that chat.
 */
export async function clearMinorHold(
    store: MinorHoldStore,
    args: ClearMinorHoldArgs,
    log: (line: string) => void,
): Promise<void> {
    const user = await store.findUser(args.userId);
    if (!user) throw new Error(`user ${args.userId} not found`);
    const hadUserHold = user.minorHeldAt != null;

    let conversationIds: number[];
    if (args.conversationId !== undefined) {
        const conversation = await store.findConversation(args.conversationId, args.userId);
        if (!conversation) {
            throw new Error(`conversation ${args.conversationId} not found for user ${args.userId}`);
        }
        conversationIds = [conversation.id];
    } else {
        conversationIds = (await store.listConversations(args.userId)).map((row) => row.id);
    }

    await store.clearUser(args.userId);
    for (const id of conversationIds) {
        await store.clearConversation(id, args.userId);
    }

    log(
        [
            'safety audit',
            'action=clear_minor_hold',
            `userId=${args.userId}`,
            `conversationId=${args.conversationId ?? '-'}`,
            'clearedUser=1',
            `clearedConversations=${conversationIds.length}`,
            `hadUserHold=${hadUserHold ? '1' : '0'}`,
        ].join(' '),
    );
}

function requireId(value: string | undefined, flag: string): number {
    if (!value || !/^[1-9]\d*$/.test(value)) {
        throw new Error(`${flag} expects a positive integer`);
    }
    return Number(value);
}
