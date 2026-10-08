import assert from 'node:assert/strict';
import test from 'node:test';

import { avatarExtension, companionFilesIn, ownVoiceFile } from './file-types.js';

test('avatar extensions follow the image type', () => {
    assert.equal(avatarExtension('image/jpeg'), '.jpg');
    assert.equal(avatarExtension('image/png'), '.png');
    assert.equal(avatarExtension('image/webp'), '.webp');
});

test('anything else has no avatar extension', () => {
    assert.equal(avatarExtension('text/html'), null);
    assert.equal(avatarExtension('image/svg+xml'), null);
    assert.equal(avatarExtension(undefined), null);
});

test('account deletion picks only her portrait files', () => {
    assert.deepEqual(
        companionFilesIn(
            ['4-a.png', '41-b.png', '5-c.jpg', '14-d.webp', '4-e.webp'],
            [4, 5],
        ),
        ['4-a.png', '5-c.jpg', '4-e.webp'],
    );
    assert.deepEqual(companionFilesIn(['4-a.png'], []), []);
});

test('a deleted voice message removes only her own stored file', () => {
    const url = '/uploads/voice/3/0f8e2a6c-1d2b-4c3d-9e8f-123456789abc.m4a';
    assert.equal(ownVoiceFile(url, 3), '0f8e2a6c-1d2b-4c3d-9e8f-123456789abc.m4a');
    assert.equal(ownVoiceFile(url, 4), null);
    assert.equal(ownVoiceFile('/uploads/voice/3/../4/x.m4a', 3), null);
    assert.equal(ownVoiceFile(null, 3), null);
});
