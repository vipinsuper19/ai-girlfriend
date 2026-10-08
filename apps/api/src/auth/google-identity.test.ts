import assert from 'node:assert/strict';
import test from 'node:test';

import {
    googleDisplayName,
    googleIdentity,
    googleSignInPlan,
} from './google-identity.js';

const firebase = {
    iss: 'https://securetoken.google.com/my-app',
    sub: 'firebase-uid',
    email: 'Ana@Example.com',
    email_verified: true,
    name: 'Ana',
    firebase: {
        sign_in_provider: 'google.com',
        identities: { 'google.com': ['1234567890'] },
    },
};

test('a Firebase Google token uses the Google account id', () => {
    assert.deepEqual(googleIdentity(firebase).identity, {
        googleId: '1234567890',
        email: 'ana@example.com',
        name: 'Ana',
    });
});

test('a Firebase password or phone token is refused', () => {
    assert.equal(
        googleIdentity({ ...firebase, firebase: { sign_in_provider: 'password' } }).problem,
        'This token is not from Google sign-in',
    );
});

test('a plain Google token uses sub, and the email must be verified', () => {
    const plain = { iss: 'https://accounts.google.com', sub: '99', email: 'a@b.co', email_verified: true };
    assert.equal(googleIdentity(plain).identity?.googleId, '99');
    assert.equal(
        googleIdentity({ ...plain, email_verified: false }).problem,
        'Google email is not verified',
    );
});

test('an existing email account is never taken over', () => {
    assert.deepEqual(googleSignInPlan(4, 4), { kind: 'existing', userId: 4 });
    assert.deepEqual(googleSignInPlan(null, 7), { kind: 'conflict' });
    assert.deepEqual(googleSignInPlan(null, null), { kind: 'create' });
});

test('display name falls back to the email name', () => {
    assert.equal(googleDisplayName({ googleId: '1', email: 'ana@x.co', name: null }), 'ana');
    assert.equal(googleDisplayName({ googleId: '1', email: 'a@x.co', name: null }), 'Friend');
});
