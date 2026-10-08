import assert from 'node:assert/strict';
import test from 'node:test';

import { exportRows, flagColumn, userView } from './user-view.js';

test('flags read as booleans', () => {
    const view = userView({
        id: 3,
        email: 'a@b.co',
        memoryPausedAt: '2026-10-01T00:00:00.000Z',
        notificationsEnabledAt: null,
    });
    assert.equal(view.memoryPaused, true);
    assert.equal(view.notificationsEnabled, false);
    assert.equal('memoryPausedAt' in view, false);
});

test('turning a flag on keeps the first time and off clears it', () => {
    const now = '2026-10-08T00:00:00.000Z';
    assert.equal(flagColumn(true, null, now), now);
    assert.equal(flagColumn(true, '2026-01-01T00:00:00.000Z', now), '2026-01-01T00:00:00.000Z');
    assert.equal(flagColumn(false, '2026-01-01T00:00:00.000Z', now), null);
    assert.equal(flagColumn(undefined, null, now), undefined);
});

test('export leaves out credentials, tokens, and vectors', () => {
    const rows = exportRows([
        { id: 1, email: 'a@b.co', passwordHash: 'x', token: 't', embedding: [1], content: 'tea' },
    ]);
    assert.deepEqual(rows, [{ id: 1, email: 'a@b.co', content: 'tea' }]);
});
