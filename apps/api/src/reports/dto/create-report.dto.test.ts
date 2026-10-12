import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateReportDto, REPORT_NOTE_MAX, REPORT_REASONS } from './create-report.dto.js';

async function problems(body: unknown) {
    const dto = plainToInstance(CreateReportDto, body);
    const errors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
    });
    return errors.map((error) => error.property).sort();
}

const valid = {
    messageId: 12,
    conversationId: 8,
    reason: 'HARMFUL',
};

test('accepts the Android report body, including a numeric-string id', async () => {
    assert.deepEqual(await problems(valid), []);
    assert.deepEqual(
        await problems({ ...valid, messageId: '12', conversationId: '8', note: 'unsafe' }),
        [],
    );
    assert.deepEqual(REPORT_REASONS, [
        'HARMFUL',
        'SEXUAL',
        'HATE',
        'INACCURATE',
        'OTHER',
    ]);
});

test('accepts every picker reason and a note of 500 characters', async () => {
    for (const reason of REPORT_REASONS) {
        assert.deepEqual(
            await problems({ ...valid, reason, note: 'x'.repeat(REPORT_NOTE_MAX) }),
            [],
        );
    }
});

test('trims a note and treats a blank note as omitted', async () => {
    const noted = plainToInstance(CreateReportDto, { ...valid, note: '  too sharp  ' });
    assert.equal(noted.note, 'too sharp');
    assert.deepEqual(await validate(noted), []);

    const blank = plainToInstance(CreateReportDto, { ...valid, note: '   ' });
    assert.equal(blank.note, undefined);
    assert.deepEqual(await validate(blank), []);
});

test('rejects an unknown reason, a long note, and a missing message', async () => {
    assert.deepEqual(await problems({ ...valid, reason: 'RUDE' }), ['reason']);
    assert.deepEqual(await problems({ ...valid, reason: 'harmful' }), ['reason']);
    assert.deepEqual(
        await problems({ ...valid, note: 'x'.repeat(REPORT_NOTE_MAX + 1) }),
        ['note'],
    );
    assert.ok((await problems({ conversationId: 8, reason: 'HATE' })).includes('messageId'));
    assert.deepEqual(await problems({ ...valid, messageId: 0 }), ['messageId']);
    assert.deepEqual(await problems({ ...valid, extra: true }), ['extra']);
});
