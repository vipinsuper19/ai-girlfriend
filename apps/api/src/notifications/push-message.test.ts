import assert from 'node:assert/strict';
import test from 'node:test';

import { parseServiceAccount } from '../common/google-service-account.js';
import { fcmEndpoint, fcmMessage, isDeadToken } from './push-message.js';

test('service account is read from JSON or base64 and must be complete', () => {
    const key = { client_email: 'a@b.iam.gserviceaccount.com', private_key: 'KEY', project_id: 'p1' };
    assert.deepEqual(parseServiceAccount(JSON.stringify(key)), key);
    assert.deepEqual(parseServiceAccount(Buffer.from(JSON.stringify(key)).toString('base64')), key);
    assert.equal(parseServiceAccount(JSON.stringify({ client_email: 'x' })), null);
    assert.equal(parseServiceAccount('not json'), null);
    assert.equal(parseServiceAccount(''), null);
    assert.equal(parseServiceAccount(undefined), null);
});

test('fcm message carries the token, trimmed text, and data only when present', () => {
    assert.equal(fcmEndpoint('my proj'), 'https://fcm.googleapis.com/v1/projects/my%20proj/messages:send');
    const plain = fcmMessage('tok', { title: 'Hi', body: 'There' });
    assert.equal(plain.message.token, 'tok');
    assert.equal('data' in plain.message, false);
    const long = fcmMessage('tok', { title: 'x'.repeat(300), body: 'y', data: { kind: 'test' } });
    assert.equal(long.message.notification.title.length, 100);
    assert.deepEqual((long.message as { data?: unknown }).data, { kind: 'test' });
});

test('only unregistered or invalid tokens count as dead', () => {
    assert.equal(isDeadToken(404, null), true);
    assert.equal(isDeadToken(400, { error: { status: 'INVALID_ARGUMENT', details: [{ errorCode: 'INVALID_ARGUMENT' }] } }), true);
    assert.equal(isDeadToken(403, { error: { details: [{ errorCode: 'UNREGISTERED' }] } }), true);
    assert.equal(isDeadToken(503, { error: { status: 'UNAVAILABLE', details: [{ errorCode: 'UNAVAILABLE' }] } }), false);
    assert.equal(isDeadToken(401, { error: { status: 'UNAUTHENTICATED' } }), false);
});
