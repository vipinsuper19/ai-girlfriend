import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException } from '@nestjs/common';

import { ENTITY_ID_MAX, parseEntityId, ParseEntityIdPipe } from './parse-entity-id.pipe.js';

test('entity ids are positive canonical 32-bit integers', () => {
    assert.equal(parseEntityId('1'), 1);
    assert.equal(parseEntityId(ENTITY_ID_MAX), ENTITY_ID_MAX);
    assert.equal(parseEntityId(String(ENTITY_ID_MAX)), ENTITY_ID_MAX);
    assert.equal(parseEntityId('abc'), null);
    assert.equal(parseEntityId('01'), null);
    assert.equal(parseEntityId('0'), null);
    assert.equal(parseEntityId('-4'), null);
    assert.equal(parseEntityId('1.5'), null);
    assert.equal(parseEntityId('99999999999999999999'), null);
    assert.equal(parseEntityId(ENTITY_ID_MAX + 1), null);

    const pipe = new ParseEntityIdPipe();
    assert.equal(pipe.transform('12'), 12);
    assert.throws(() => pipe.transform('abc'), BadRequestException);
    assert.throws(() => pipe.transform('99999999999999999999'), BadRequestException);
});
