import assert from 'node:assert/strict';
import test from 'node:test';

import { HttpStatus } from '@nestjs/common';

import {
    AGE_FIELDS_INCOMPLETE,
    AGE_INVALID_CONFIRMED_AT,
    AGE_INVALID_DATE_OF_BIRTH,
    AGE_UNDER_18,
    AgeRejectedException,
    completedYears,
    parseAgeAttestation,
} from './age.js';

const today = new Date('2026-10-12T15:04:05.000Z');
const confirmedAt = '2026-10-12T15:04:05Z';

function rejection(run: () => void) {
    try {
        run();
    } catch (error) {
        assert.ok(error instanceof AgeRejectedException);
        const body = error.getResponse() as { code: string; message: string };
        return { status: error.getStatus(), code: body.code, message: body.message };
    }
    assert.fail('expected an age rejection');
}

test('an adult attestation is stored as an ISO date and instant', () => {
    assert.deepEqual(
        parseAgeAttestation(
            { dateOfBirth: '1991-03-17', ageConfirmedAt: confirmedAt },
            today,
        ),
        {
            dateOfBirth: '1991-03-17',
            ageConfirmedAt: '2026-10-12T15:04:05.000Z',
        },
    );
});

test('omitting both fields leaves registration alone', () => {
    assert.equal(parseAgeAttestation({}, today), null);
    assert.equal(parseAgeAttestation({ dateOfBirth: null, ageConfirmedAt: null }, today), null);
});

test('the 18th birthday is allowed and the day before is refused', () => {
    const allowed = parseAgeAttestation(
        { dateOfBirth: '2008-10-12', ageConfirmedAt: confirmedAt },
        today,
    );
    assert.equal(allowed?.dateOfBirth, '2008-10-12');

    const blocked = rejection(() => {
        parseAgeAttestation(
            { dateOfBirth: '2008-10-13', ageConfirmedAt: confirmedAt },
            today,
        );
    });
    assert.equal(blocked.status, HttpStatus.FORBIDDEN);
    assert.equal(blocked.code, AGE_UNDER_18);
    assert.equal(blocked.message, 'You must be 18 or older.');
    assert.equal(completedYears({ y: 2008, m: 10, d: 13 }, { y: 2026, m: 10, d: 12 }), 17);
});

test('a Feb 29 birthday is 18 on March 1, not on February 28', () => {
    const dayBefore = new Date('2026-02-28T23:00:00.000Z');
    const anniversary = new Date('2026-03-01T00:30:00.000Z');
    const birth = { dateOfBirth: '2008-02-29', ageConfirmedAt: '2026-02-28T12:00:00Z' };

    const blocked = rejection(() => parseAgeAttestation(birth, dayBefore));
    assert.equal(blocked.code, AGE_UNDER_18);

    const allowed = parseAgeAttestation(
        { dateOfBirth: '2008-02-29', ageConfirmedAt: '2026-03-01T00:30:00Z' },
        anniversary,
    );
    assert.equal(allowed?.dateOfBirth, '2008-02-29');
});

test('future, impossible, and non-ISO birth dates are rejected', () => {
    const cases = [
        '2026-10-13',
        '2026-02-31',
        '2023-02-29',
        '1991-13-01',
        '1991-3-17',
        '1991-03-17T00:00:00Z',
        'March 17, 1991',
        '',
    ];
    for (const dateOfBirth of cases) {
        const blocked = rejection(() => {
            parseAgeAttestation({ dateOfBirth, ageConfirmedAt: confirmedAt }, today);
        });
        assert.equal(blocked.status, HttpStatus.BAD_REQUEST);
        assert.equal(blocked.code, AGE_INVALID_DATE_OF_BIRTH);
    }
});

test('a confirmation time must be a real instant after birth and not in the future', () => {
    const beforeBirth = rejection(() => {
        parseAgeAttestation(
            { dateOfBirth: '1991-03-17', ageConfirmedAt: '1991-03-16T23:59:59Z' },
            today,
        );
    });
    assert.equal(beforeBirth.code, AGE_INVALID_CONFIRMED_AT);

    const future = rejection(() => {
        parseAgeAttestation(
            { dateOfBirth: '1991-03-17', ageConfirmedAt: '2026-10-12T15:10:00Z' },
            today,
        );
    });
    assert.equal(future.code, AGE_INVALID_CONFIRMED_AT);
    assert.match(future.message, /future/);

    const withinSkew = parseAgeAttestation(
        { dateOfBirth: '1991-03-17', ageConfirmedAt: '2026-10-12T15:09:05Z' },
        today,
    );
    assert.equal(withinSkew?.ageConfirmedAt, '2026-10-12T15:09:05.000Z');

    for (const ageConfirmedAt of ['2026-10-12', 'yesterday', '2026-02-31T00:00:00Z', '2026-10-12T25:00:00Z']) {
        const blocked = rejection(() => {
            parseAgeAttestation({ dateOfBirth: '1991-03-17', ageConfirmedAt }, today);
        });
        assert.equal(blocked.code, AGE_INVALID_CONFIRMED_AT);
    }
});

test('one field without the other is incomplete, including on the age patch', () => {
    const half = rejection(() => {
        parseAgeAttestation({ dateOfBirth: '1991-03-17' }, today);
    });
    assert.equal(half.code, AGE_FIELDS_INCOMPLETE);

    const required = rejection(() => {
        parseAgeAttestation({}, today, { required: true });
    });
    assert.equal(required.status, HttpStatus.BAD_REQUEST);
    assert.equal(required.code, AGE_FIELDS_INCOMPLETE);
});
