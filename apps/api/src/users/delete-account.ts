import { deleteDeletionRequestsForEmail } from '../legal/deletion-request.store.js';

/**
 * Deletes every database row owned by this account in one transaction.
 *
 * Child tables on the current contract use ON DELETE CASCADE from User, so
 * the user delete removes messages, conversations, memories, pgvector
 * embedding rows, usage, sessions (the refresh token is a column on Session),
 * and the other account-owned tables. Those cascades are not enough on their
 * own:
 *
 * - Session rows used to be deleted one at a time before the user row, and
 *   not in the same transaction. ORM `.where({ userId }).delete()` also
 *   removes a single matching row, so a second session could survive that
 *   loop if it stopped early.
 * - `messageReport` cascades from the user, the message, and the conversation.
 *   Those three paths delete the same row when the account goes away. The
 *   report rows are removed first, in this transaction, so a restrict-style
 *   key cannot abort the user delete and leave the rest of the account behind.
 *   The delete is a no-op when the table is absent.
 * - Web `deletionRequest` rows are stored by email and have no foreign key
 *   to the user. They are removed in this transaction, before the user row,
 *   via `deleteDeletionRequestsForEmail`.
 *
 * Stored files are not in this transaction. `deleteMe` passes this function
 * as the `deleteUser` callback of `deleteAccountStorageFirst`, after
 * `removeUserFiles` and after any `storageCleanup` write. Do not delete
 * files after this transaction commits.
 */
export async function deleteAccountRecords(
    db: AccountDb,
    userId: number,
): Promise<void> {
    await db.transaction(async (tx) => {
        await deleteMessageReports(db, tx, userId);
        const user = await tx.orm.public.User.where({ id: userId }).first();
        await deleteDeletionRequestsForEmail(tx, user?.email);
        await tx.orm.public.User.where({ id: userId }).delete();
    });
}

type AccountDb = {
    raw: {
        sql: (
            strings: TemplateStringsArray,
            ...values: unknown[]
        ) => RawQuery;
    };
    transaction: (fn: (tx: AccountTx) => Promise<void>) => Promise<void>;
};

type AccountTx = {
    orm: {
        public: {
            User: {
                where: (filter: { id: number }) => {
                    first: () => Promise<{ email?: unknown } | null>;
                    delete: () => Promise<unknown>;
                };
            };
        };
    };
    query: (plan: unknown) => Promise<Array<{ name: string | null }>>;
    execute: (plan: unknown) => Promise<unknown>;
};

type RawQuery = {
    returnsRow: (shape: { name: string }) => { build: () => unknown };
    affectedCount: () => { build: () => unknown };
};

async function deleteMessageReports(
    db: AccountDb,
    tx: AccountTx,
    userId: number,
): Promise<void> {
    const probe = db.raw.sql`
        SELECT to_regclass('public."messageReport"')::text AS name
    `.returnsRow({ name: 'pg/text@1' }).build();
    const found = await tx.query(probe);
    if (!found[0]?.name) return;

    // userId is an integer primary key, bound as a parameter (not interpolated).
    const remove = db.raw.sql`
        DELETE FROM "messageReport"
        WHERE "userId" = ${userId}
           OR "conversationId" IN (
                SELECT id FROM conversation WHERE "userId" = ${userId}
           )
           OR "messageId" IN (
                SELECT message.id
                FROM message
                JOIN conversation ON conversation.id = message."conversationId"
                WHERE conversation."userId" = ${userId}
           )
    `.affectedCount().build();
    await tx.execute(remove);
}
