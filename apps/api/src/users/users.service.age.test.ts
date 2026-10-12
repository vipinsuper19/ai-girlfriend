import assert from 'node:assert/strict';
import test from 'node:test';

import { UsersService } from './users.service.js';

test('confirmAge stores the first timestamp and GET /users/me returns it', async () => {
    let row: Record<string, unknown> = {
        id: 3,
        email: 'ana@example.com',
        displayName: 'Ana',
        ageConfirmedAt: null,
    };
    let updates = 0;
    const db = {
        client: {
            orm: {
                public: {
                    User: {
                        where() {
                            return {
                                async first() {
                                    return row;
                                },
                                async update(data: { ageConfirmedAt: string }) {
                                    updates += 1;
                                    row = { ...row, ...data };
                                    return row;
                                },
                            };
                        },
                    },
                },
            },
        },
    };
    const users = new UsersService(db as never, {} as never, {} as never);

    const first = await users.confirmAge('3', { ageConfirmed: true });
    assert.match(first.ageConfirmedAt, /^\d{4}-\d{2}-\d{2}T/);
    const again = await users.confirmAge('3', { ageConfirmed: true });
    assert.equal(again.ageConfirmedAt, first.ageConfirmedAt);
    assert.equal(updates, 1);

    const profile = await users.findMe('3');
    assert.equal(profile.ageConfirmedAt, first.ageConfirmedAt);
    assert.equal('dateOfBirth' in profile, false);

    row = { ...row, ageConfirmedAt: null };
    const unset = await users.findMe('3');
    assert.equal(unset.ageConfirmedAt, null);
});

test('confirmAge rejects anything other than true', async () => {
    const users = new UsersService({} as never, {} as never, {} as never);
    await assert.rejects(
        () => users.confirmAge('3', { ageConfirmed: false as never }),
        /ageConfirmed must be true/,
    );
});
