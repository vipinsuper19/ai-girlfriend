import assert from 'node:assert/strict';
import test from 'node:test';

import {
    appearanceFields,
    ownAvatarUrl,
    personalityFields,
    voiceFields,
} from './companion-fields.js';

test('foreign keys never pass through a nested block', () => {
    const picked = appearanceFields({
        id: 9,
        companionId: 77,
        hairColor: 'Black',
        age: 24,
    });
    assert.equal(picked.problem, null);
    assert.deepEqual(picked.data, { hairColor: 'Black', age: 24 });

    assert.deepEqual(
        voiceFields({ companionId: 77, voiceId: 'warm', speed: 1.1 }).data,
        { voiceId: 'warm', speed: 1.1 },
    );
});

test('a wrong type is reported instead of reaching the database', () => {
    assert.equal(appearanceFields({ age: 'twenty' }).problem, 'appearance.age is not valid');
    assert.equal(personalityFields({ traits: 'kind' }).problem, 'personality.traits is not valid');
    assert.equal(personalityFields({ humorLevel: 5.5 }).problem, 'personality.humorLevel is not valid');
});

test('null clears a column and a missing block is empty', () => {
    assert.deepEqual(appearanceFields({ hairStyle: null }).data, { hairStyle: null });
    assert.deepEqual(appearanceFields(undefined), { data: {}, problem: null });
});

test('only her own stored portrait is kept', () => {
    const own = '/uploads/companions/4-0f8e2a6c-1d2b-4c3d-9e8f-123456789abc.png';
    assert.equal(ownAvatarUrl(own, 4), own);
    assert.equal(ownAvatarUrl(own, 5), null);
    assert.equal(ownAvatarUrl('https://evil.example/x.png', 4), null);
    assert.equal(ownAvatarUrl('/uploads/companions/4-../../x.html', 4), null);
    assert.equal(ownAvatarUrl(null, 4), null);
});
