import assert from 'node:assert/strict';
import test from 'node:test';

import { imageKindFromBytes } from './image-signature.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test('jpeg, png, and webp signatures are accepted', () => {
    assert.equal(imageKindFromBytes(Buffer.from([0xff, 0xd8, 0xff, 0xe1])), 'jpeg');
    assert.equal(imageKindFromBytes(Buffer.concat([PNG, Buffer.from([0x00])])), 'png');

    const webp = Buffer.alloc(12);
    webp.write('RIFF', 0, 'ascii');
    webp.write('WEBP', 8, 'ascii');
    assert.equal(imageKindFromBytes(webp), 'webp');
});

test('a declared type cannot disguise another file', () => {
    assert.equal(imageKindFromBytes(Buffer.from('GIF89a')), null);
    assert.equal(imageKindFromBytes(Buffer.from('<html></html>')), null);
    assert.equal(imageKindFromBytes(Buffer.from([0xff, 0xd8])), null);
    assert.equal(imageKindFromBytes(null), null);

    const wave = Buffer.alloc(12);
    wave.write('RIFF', 0, 'ascii');
    wave.write('WAVE', 8, 'ascii');
    assert.equal(imageKindFromBytes(wave), null);
});
