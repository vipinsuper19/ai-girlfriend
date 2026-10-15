/**
 * Clear a false-positive minor hold.
 *
 *   pnpm --filter @ai-girlfriend/api run safety:clear-minor-hold -- --user <id> [--conversation <id>]
 */
import 'dotenv/config';

import { clearMinorHold, parseClearMinorHoldArgs, type MinorHoldStore } from '../src/moderation/clear-minor-hold.js';
import { db } from '../src/prisma/db.js';

const store: MinorHoldStore = {
    async findUser(id) {
        const row = await db.orm.public.User.where({ id }).first();
        return row ? { id: row.id, minorHeldAt: row.minorHeldAt } : null;
    },
    async clearUser(id) {
        const now = new Date().toISOString();
        await db.orm.public.User.where({ id }).update({ minorHeldAt: null, updatedAt: now });
    },
    async findConversation(id, userId) {
        const row = await db.orm.public.Conversation.where({ id, userId }).first();
        return row ? { id: row.id, minorHeldAt: row.minorHeldAt } : null;
    },
    async listConversations(userId) {
        const rows = await db.orm.public.Conversation.where({ userId }).all();
        return rows.map((row) => ({ id: row.id, minorHeldAt: row.minorHeldAt }));
    },
    async clearConversation(id, userId) {
        const now = new Date().toISOString();
        await db.orm.public.Conversation.where({ id, userId }).update({
            minorHeldAt: null,
            updatedAt: now,
        });
    },
};

try {
    const args = parseClearMinorHoldArgs(process.argv.slice(2));
    await clearMinorHold(store, args, (line) => {
        console.warn(line);
    });
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
} finally {
    process.exit(process.exitCode ?? 0);
}
