import assert from 'node:assert/strict';
import test from 'node:test';

import { companionImagePrompt } from './image-prompt.js';

test('the prompt carries her look and the request', () => {
    const { prompt } = companionImagePrompt(
        'Aria',
        'FEMALE',
        { age: 25, hairColor: 'black', hairStyle: 'long', eyeColor: 'brown', metadata: { style: 'Anime' } },
        'reading in a cafe',
    );
    assert.equal(
        prompt,
        'Anime image of Aria, an adult woman about 25 years old. Appearance: black long hair, brown eyes. Scene: reading in a cafe. Fully clothed, tasteful, no text, no watermark.',
    );
});

test('she is drawn as an adult, and a minor age is refused', () => {
    assert.match(companionImagePrompt('Aria', 'FEMALE', { age: 19 }, '').prompt ?? '', /about 21 years old/);
    assert.match(companionImagePrompt('Aria', 'FEMALE', null, null).prompt ?? '', /about 21 years old.*warm, natural portrait/);
    assert.deepEqual(companionImagePrompt('Aria', 'FEMALE', { age: 16 }, 'x'), {
        prompt: null,
        problem: 'Images are only made of adult companions',
    });
});
