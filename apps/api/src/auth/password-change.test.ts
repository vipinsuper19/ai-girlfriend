import assert from 'node:assert/strict';
import test from 'node:test';

import { passwordChangeProblem } from './password-change.js';

test('a matching new password is accepted', () => {
    assert.equal(
        passwordChangeProblem('old-password', 'new-password', {
            hasPassword: true,
            currentMatches: true,
        }),
        null,
    );
});

test('rejects a missing hash, a wrong current password, and a repeat', () => {
    assert.equal(
        passwordChangeProblem('old-password', 'new-password', {
            hasPassword: false,
            currentMatches: false,
        }),
        'This account has no password.',
    );
    assert.equal(
        passwordChangeProblem('old-password', 'new-password', {
            hasPassword: true,
            currentMatches: false,
        }),
        'Current password is wrong.',
    );
    assert.equal(
        passwordChangeProblem('same-password', 'same-password', {
            hasPassword: true,
            currentMatches: true,
        }),
        'Choose a different password.',
    );
    assert.equal(
        passwordChangeProblem('old-password', 'short', {
            hasPassword: true,
            currentMatches: true,
        }),
        'Use at least 8 characters.',
    );
});
