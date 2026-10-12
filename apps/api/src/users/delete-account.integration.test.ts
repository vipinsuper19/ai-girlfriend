import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { UsersService } from './users.service.js';

const databaseUrl = process.env.DATABASE_URL;

/**
 * Seeds one account with every kind of stored data and asserts deleteMe
 * leaves nothing of it. A second account is seeded beside it and must stay.
 *
 * Reports use the `messageReport` table.
 * Apply migrations before running this test. One report is the subject's,
 * one is someone else's flag on the subject's reply, and one is the other
 * account flagging their own reply (that row must stay).
 */
test('deleteMe removes the account and leaves the other one', { skip: !databaseUrl }, async () => {
    const { db } = await import('../prisma/db.js');
    const storage = new StorageService();
    const service = new UsersService(new PrismaService(db), storage);
    const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await requireReportTable(db);
    let subjectId: number | undefined;
    let otherId: number | undefined;

    try {
        const subject = await seedAccount(db, storage, stamp, 'subject');
        const other = await seedAccount(db, storage, stamp, 'other');
        subjectId = subject.userId;
        otherId = other.userId;
        await insertReport(db, {
            userId: subject.userId,
            messageId: subject.messageId,
            conversationId: subject.conversationId,
            reason: 'HARMFUL',
        });
        await insertReport(db, {
            userId: other.userId,
            messageId: subject.messageId,
            conversationId: subject.conversationId,
            reason: 'INACCURATE',
        });
        await insertReport(db, {
            userId: other.userId,
            messageId: other.messageId,
            conversationId: other.conversationId,
            reason: 'OTHER',
        });

        const embedding = await db.orm.public.MemoryEmbedding
            .where({ memoryId: subject.memoryId })
            .first();
        assert.equal(embedding?.status, 'READY');
        assert.equal(embedding?.embedding?.length, 1536);
        assert.equal(existsSync(subject.voicePath), true);
        assert.equal(existsSync(subject.imagePath), true);
        assert.equal(existsSync(subject.portraitPath), true);

        const result = await service.deleteMe(String(subject.userId));
        assert.equal(result.message, 'Account deleted successfully');

        assert.equal(await db.orm.public.User.where({ id: subject.userId }).first(), null);
        assert.equal(await db.orm.public.Account.where({ userId: subject.userId }).first(), null);
        assert.equal(await db.orm.public.Session.where({ refreshToken: subject.refreshTokens[0] }).first(), null);
        assert.equal(await db.orm.public.Session.where({ refreshToken: subject.refreshTokens[1] }).first(), null);
        assert.equal(await db.orm.public.DeviceToken.where({ token: subject.deviceToken }).first(), null);
        assert.equal(await db.orm.public.Companion.where({ id: subject.companionId }).first(), null);
        assert.equal(await db.orm.public.CompanionAppearance.where({ companionId: subject.companionId }).first(), null);
        assert.equal(await db.orm.public.CompanionPersonality.where({ companionId: subject.companionId }).first(), null);
        assert.equal(await db.orm.public.CompanionVoice.where({ companionId: subject.companionId }).first(), null);
        assert.equal(await db.orm.public.Conversation.where({ id: subject.conversationId }).first(), null);
        assert.equal(await db.orm.public.Message.where({ id: subject.messageId }).first(), null);
        assert.equal(await db.orm.public.Message.where({ id: subject.deletedMessageId }).first(), null);
        assert.equal(await db.orm.public.Memory.where({ id: subject.memoryId }).first(), null);
        assert.equal(await db.orm.public.MemoryEmbedding.where({ memoryId: subject.memoryId }).first(), null);
        assert.equal(await countVectors(db, subject.memoryId), 0);
        assert.equal(await db.orm.public.ImageGeneration.where({ id: subject.imageId }).first(), null);
        assert.equal(await db.orm.public.Call.where({ id: subject.callId }).first(), null);
        assert.equal(await db.orm.public.Subscription.where({ userId: subject.userId }).first(), null);
        assert.equal((await db.orm.public.UsageRecord.where({ userId: subject.userId }).all()).length, 0);
        assert.equal(await countReports(db, subject.userId, subject.messageId), 0);
        assert.equal(await countReports(db, other.userId, other.messageId), 1);

        assert.equal(existsSync(subject.voicePath), false);
        assert.equal(existsSync(subject.imagePath), false);
        assert.equal(existsSync(subject.portraitPath), false);

        assert.ok(await db.orm.public.User.where({ id: other.userId }).first());
        assert.ok(await db.orm.public.Session.where({ refreshToken: other.refreshTokens[0] }).first());
        assert.equal((await db.orm.public.UsageRecord.where({ userId: other.userId }).all()).length, 2);
        assert.equal(existsSync(other.voicePath), true);

        await assert.rejects(
            () => service.deleteMe(String(subject.userId)),
            { name: 'NotFoundException' },
        );
    } finally {
        if (otherId !== undefined) await service.deleteMe(String(otherId)).catch(() => undefined);
        if (subjectId !== undefined) await service.deleteMe(String(subjectId)).catch(() => undefined);
        await db.close();
    }
});

type Seed = {
    userId: number;
    companionId: number;
    conversationId: number;
    messageId: number;
    deletedMessageId: number;
    memoryId: number;
    imageId: number;
    callId: number;
    deviceToken: string;
    refreshTokens: [string, string];
    voicePath: string;
    imagePath: string;
    portraitPath: string;
};

async function seedAccount(
    db: any,
    storage: StorageService,
    stamp: string,
    label: string,
): Promise<Seed> {
    const now = new Date().toISOString();
    const user = await db.orm.public.User.create({
        email: `${label}-${stamp}@example.com`,
        displayName: label,
        passwordHash: 'hash',
    });
    await db.orm.public.Account.create({
        userId: user.id,
        provider: 'EMAIL',
        providerAccountId: `${label}-${stamp}`,
    });
    const refreshTokens: [string, string] = [`${label}-a-${stamp}`, `${label}-b-${stamp}`];
    for (const refreshToken of refreshTokens) {
        await db.orm.public.Session.create({
            userId: user.id,
            refreshToken,
            expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        });
    }
    const deviceToken = `${label}-fcm-${stamp}`;
    await db.orm.public.DeviceToken.create({
        userId: user.id,
        token: deviceToken,
        platform: 'ANDROID',
    });
    const companion = await db.orm.public.Companion.create({
        userId: user.id,
        name: label,
        gender: 'FEMALE',
        status: 'ACTIVE',
    });
    await db.orm.public.CompanionAppearance.create({ companionId: companion.id, age: 24 });
    await db.orm.public.CompanionPersonality.create({
        companionId: companion.id,
        traits: ['warm'],
        interests: ['tea'],
    });
    await db.orm.public.CompanionVoice.create({
        companionId: companion.id,
        provider: 'GEMINI',
        voiceId: 'Kore',
    });
    const conversation = await db.orm.public.Conversation.create({
        userId: user.id,
        companionId: companion.id,
        title: label,
    });
    const message = await db.orm.public.Message.create({
        conversationId: conversation.id,
        role: 'ASSISTANT',
        type: 'TEXT',
        content: 'hello',
        updatedAt: now,
    });
    const deletedMessage = await db.orm.public.Message.create({
        conversationId: conversation.id,
        role: 'USER',
        type: 'AUDIO',
        content: 'soft deleted',
        audioUrl: `/uploads/voice/${user.id}/note.wav`,
        updatedAt: now,
        deletedAt: now,
    });
    const memory = await db.orm.public.Memory.create({
        userId: user.id,
        companionId: companion.id,
        conversationId: conversation.id,
        type: 'FACT',
        status: 'DELETED',
        source: 'AI_EXTRACTION',
        content: 'a private fact',
        importance: 4,
        confidence: 0.5,
        accessCount: 1,
        updatedAt: now,
        deletedAt: now,
    });
    await db.orm.public.MemoryEmbedding.create({
        memoryId: memory.id,
        provider: 'GEMINI',
        model: 'gemini-embedding-001',
        dimensions: 1536,
        status: 'READY',
        embedding: Array.from({ length: 1536 }, (_, index) => index / 1536),
        updatedAt: now,
    });
    const image = await db.orm.public.ImageGeneration.create({
        userId: user.id,
        companionId: companion.id,
        conversationId: conversation.id,
        messageId: message.id,
        type: 'USER_REQUEST',
        status: 'COMPLETED',
        provider: 'GEMINI',
        prompt: 'a portrait',
        imageUrl: `/uploads/images/${user.id}/pic.png`,
    });
    const call = await db.orm.public.Call.create({
        userId: user.id,
        companionId: companion.id,
        conversationId: conversation.id,
        type: 'AUDIO',
        status: 'ENDED',
        provider: 'LIVEKIT',
    });
    await db.orm.public.Subscription.create({
        userId: user.id,
        plan: 'FREE',
        status: 'ACTIVE',
        updatedAt: now,
    });
    await db.orm.public.UsageRecord.create({
        userId: user.id,
        feature: 'MESSAGES',
        quantity: 2,
        metadata: null,
    });
    await db.orm.public.UsageRecord.create({
        userId: user.id,
        feature: 'TEXT_TOKENS',
        quantity: 40,
        metadata: null,
    });

    const voiceUrl = await storage.saveVoiceAudio(user.id, Buffer.from('voice'));
    const imageUrl = await storage.saveGeneratedImage(user.id, Buffer.from('image'), 'image/png');
    const portraitUrl = await storage.saveCompanionAvatar(companion.id, {
        mimetype: 'image/png',
        buffer: Buffer.from('portrait'),
    } as Express.Multer.File);

    return {
        userId: user.id,
        companionId: companion.id,
        conversationId: conversation.id,
        messageId: message.id,
        deletedMessageId: deletedMessage.id,
        memoryId: memory.id,
        imageId: image.id,
        callId: call.id,
        deviceToken,
        refreshTokens,
        voicePath: diskPath(voiceUrl),
        imagePath: diskPath(imageUrl),
        portraitPath: diskPath(portraitUrl),
    };
}

function diskPath(url: string): string {
    return join(process.cwd(), url);
}

async function requireReportTable(db: any): Promise<void> {
    const probe = db.raw.sql`
        SELECT to_regclass('public."messageReport"')::text AS name
    `.returnsRow({ name: 'pg/text@1' }).build();
    const found = await db.runtime().query(probe);
    if (!found[0]?.name) {
        throw new Error('messageReport is missing. Apply Prisma migrations before this test.');
    }
}

async function insertReport(
    db: any,
    row: { userId: number; messageId: number; conversationId: number; reason: string },
): Promise<void> {
    await db.orm.public.MessageReport.create({
        userId: row.userId,
        messageId: row.messageId,
        conversationId: row.conversationId,
        reason: row.reason,
        note: null,
        content: 'snapshot',
        status: 'PENDING',
        updatedAt: new Date().toISOString(),
    });
}

async function countReports(db: any, userId: number, messageId: number): Promise<number> {
    const plan = db.raw.sql`
        SELECT count(*)::int AS n
        FROM "messageReport"
        WHERE "userId" = ${userId} OR "messageId" = ${messageId}
    `.returnsRow({ n: 'pg/int4@1' }).build();
    const rows = await db.runtime().query(plan);
    return Number(rows[0]?.n ?? 0);
}

async function countVectors(db: any, memoryId: number): Promise<number> {
    const plan = db.raw.sql`
        SELECT count(*)::int AS n
        FROM "memoryEmbedding"
        WHERE "memoryId" = ${memoryId} AND embedding IS NOT NULL
    `.returnsRow({ n: 'pg/int4@1' }).build();
    const rows = await db.runtime().query(plan);
    return Number(rows[0]?.n ?? 0);
}
