import assert from 'node:assert/strict';
import test from 'node:test';

import {
    normalizeEmail,
    passwordFingerprint,
    resetLink,
    resetSecret,
} from './password-reset.js';

test('the fingerprint changes with the hash', () => {
    assert.equal(passwordFingerprint('a'), passwordFingerprint('a'));
    assert.notEqual(passwordFingerprint('a'), passwordFingerprint('b'));
    assert.equal(passwordFingerprint('a').length, 24);
});

test('the reset secret differs from the access secret', () => {
    assert.equal(resetSecret({ JWT_RESET_SECRET: 'own' }), 'own');
    assert.equal(resetSecret({ JWT_ACCESS_SECRET: 'acc' }), 'acc:password-reset');
    assert.equal(resetSecret({}), undefined);
});

test('the link points at the web reset page', () => {
    assert.equal(
        resetLink('a.b', { APP_URL: 'https://app.example/' }),
        'https://app.example/reset-password?token=a.b',
    );
    assert.equal(resetLink('t', {}), 'http://localhost:3000/reset-password?token=t');
});

test('emails compare trimmed and lower case', () => {
    assert.equal(normalizeEmail('  Ana@Example.COM '), 'ana@example.com');
});
