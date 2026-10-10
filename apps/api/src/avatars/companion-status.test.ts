import assert from 'node:assert/strict';
import test from 'node:test';

import {
    archiveFields,
    listStatus,
    restoreFields,
    restoreProblem,
} from './companion-status.js';

test('the list defaults to active companions', () => {
    assert.equal(listStatus(undefined), 'ACTIVE');
    assert.equal(listStatus(null), 'ACTIVE');
    assert.equal(listStatus('ARCHIVED'), 'ARCHIVED');
    assert.equal(listStatus('nope'), 'ACTIVE');
});

test('archive stamps the time and restore clears it', () => {
    assert.deepEqual(archiveFields('2026-01-01T00:00:00Z'), {
        status: 'ARCHIVED',
        archivedAt: '2026-01-01T00:00:00Z',
    });
    assert.deepEqual(restoreFields(), {
        status: 'ACTIVE',
        archivedAt: null,
    });
});

test('an active or archived companion can be opened again', () => {
    assert.equal(restoreProblem('ARCHIVED'), null);
    assert.equal(restoreProblem('ACTIVE'), null);
    assert.equal(restoreProblem(null), 'Companion not found');
    assert.equal(restoreProblem('DELETED'), 'Companion not found');
});
