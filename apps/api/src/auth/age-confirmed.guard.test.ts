import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';

import { GUARDS_METADATA } from '@nestjs/common/constants';

import { AvatarsController } from '../avatars/avatars.controller.js';
import { ConversationsController } from '../conversations/conversations.controller.js';
import { MessagesController } from '../messages/messages.controller.js';
import { UsersController } from '../users/users.controller.js';
import {
    AgeConfirmedGuard,
    AgeRequiredException,
    ageGateEnforced,
    ageIsConfirmed,
} from './age-confirmed.guard.js';

function prisma(row: unknown) {
    return {
        client: {
            orm: {
                public: {
                    User: {
                        where() {
                            return this;
                        },
                        async first() {
                            return row;
                        },
                    },
                },
            },
        },
    };
}

function context(sub: unknown) {
    return {
        switchToHttp: () => ({
            getRequest: () => ({ user: { sub } }),
        }),
    } as never;
}

function guardClasses(target: object): unknown[] {
    return Reflect.getMetadata(GUARDS_METADATA, target) ?? [];
}

test('the age gate is off unless AGE_GATE_ENFORCED is set', () => {
    assert.equal(ageGateEnforced(undefined), false);
    assert.equal(ageGateEnforced(''), false);
    assert.equal(ageGateEnforced('false'), false);
    assert.equal(ageGateEnforced('off'), false);
    assert.equal(ageGateEnforced('true'), true);
    assert.equal(ageGateEnforced('1'), true);
    assert.equal(ageGateEnforced('YES'), true);
});

test('a disabled age gate allows chat without reading the user', async () => {
    let queried = false;
    const guard = new AgeConfirmedGuard({
        client: {
            orm: {
                public: {
                    User: {
                        where() {
                            queried = true;
                            return this;
                        },
                        async first() {
                            return null;
                        },
                    },
                },
            },
        },
    } as never, false);
    assert.equal(await guard.canActivate(context(1)), true);
    assert.equal(queried, false);
});

test('chat stays closed until ageConfirmedAt is set when the gate is on', async () => {
    assert.equal(ageIsConfirmed(null), false);
    assert.equal(ageIsConfirmed(''), false);
    assert.equal(ageIsConfirmed('   '), false);
    assert.equal(ageIsConfirmed('2026-10-12T00:00:00.000Z'), true);

    const closed = new AgeConfirmedGuard(prisma({ id: 1, ageConfirmedAt: null }) as never, true);
    await assert.rejects(
        () => closed.canActivate(context(1)),
        (error: unknown) => {
            assert.ok(error instanceof AgeRequiredException);
            const body = error.getResponse() as { code?: string; message?: string };
            assert.equal(body.code, 'AGE_REQUIRED');
            assert.match(body.message ?? '', /18 or older/);
            return true;
        },
    );

    const missing = new AgeConfirmedGuard(prisma(null) as never, true);
    await assert.rejects(() => missing.canActivate(context(1)), AgeRequiredException);

    const open = new AgeConfirmedGuard(
        prisma({ id: 1, ageConfirmedAt: '2026-10-12T00:00:00.000Z' }) as never,
        true,
    );
    assert.equal(await open.canActivate(context('1')), true);
});

test('the age guard covers chat writes and companion creation only', () => {
    assert.equal(guardClasses(ConversationsController).includes(AgeConfirmedGuard), true);
    assert.equal(
        guardClasses(MessagesController.prototype.create).includes(AgeConfirmedGuard),
        true,
    );
    assert.equal(
        guardClasses(MessagesController.prototype.createAndStream).includes(AgeConfirmedGuard),
        true,
    );
    assert.equal(
        guardClasses(MessagesController.prototype.regenerate).includes(AgeConfirmedGuard),
        true,
    );
    assert.equal(
        guardClasses(MessagesController.prototype.replyStream).includes(AgeConfirmedGuard),
        true,
    );
    assert.equal(guardClasses(MessagesController.prototype.findAll).includes(AgeConfirmedGuard), false);
    assert.equal(guardClasses(MessagesController.prototype.remove).includes(AgeConfirmedGuard), false);
    assert.equal(guardClasses(MessagesController).includes(AgeConfirmedGuard), false);
    assert.equal(guardClasses(AvatarsController.prototype.create).includes(AgeConfirmedGuard), true);
    assert.equal(guardClasses(AvatarsController).includes(AgeConfirmedGuard), false);
    assert.equal(guardClasses(UsersController).includes(AgeConfirmedGuard), false);
    assert.equal(guardClasses(UsersController.prototype.confirmAge).includes(AgeConfirmedGuard), false);
});
