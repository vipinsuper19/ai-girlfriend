import { HttpException, HttpStatus } from '@nestjs/common';

/** Completed years required to register or keep using the API. */
export const MINIMUM_AGE_YEARS = 18;

export const AGE_UNDER_18 = 'UNDER_18';
export const AGE_INVALID_DATE_OF_BIRTH = 'INVALID_DATE_OF_BIRTH';
export const AGE_INVALID_CONFIRMED_AT = 'INVALID_AGE_CONFIRMED_AT';
export const AGE_FIELDS_INCOMPLETE = 'AGE_FIELDS_INCOMPLETE';

/** Clock skew allowed when the client stamps "confirmed just now". */
const CONFIRMATION_SKEW_MS = 5 * 60 * 1000;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

export type AgeInput = {
    dateOfBirth?: string | null;
    ageConfirmedAt?: string | null;
};

export type StoredAge = {
    dateOfBirth: string;
    ageConfirmedAt: string;
};

type CalendarDate = {
    y: number;
    m: number;
    d: number;
};

export class AgeRejectedException extends HttpException {
    constructor(code: string, message: string, status: HttpStatus) {
        super({ code, message }, status);
    }
}

/**
 * Reads an optional age attestation.
 * Both fields may be omitted. Sending one without the other is rejected.
 * A date of birth under 18, in the future, or not a real ISO calendar date is rejected.
 * The year count matches the Android gate: completed years, with a Feb 29 birthday
 * landing on March 1 in a non-leap year. "Today" is the UTC calendar date of `now`.
 */
export function parseAgeAttestation(
    input: AgeInput,
    now: Date,
    options: { required: true },
): StoredAge;
export function parseAgeAttestation(
    input: AgeInput,
    now: Date,
    options?: { required?: boolean },
): StoredAge | null;
export function parseAgeAttestation(
    input: AgeInput,
    now: Date,
    options?: { required?: boolean },
): StoredAge | null {
    const dateOfBirth = present(input.dateOfBirth);
    const ageConfirmedAt = present(input.ageConfirmedAt);

    if (dateOfBirth === undefined && ageConfirmedAt === undefined) {
        if (options?.required) {
            throw incomplete();
        }
        return null;
    }

    if (dateOfBirth === undefined || ageConfirmedAt === undefined) {
        throw incomplete();
    }

    const birth = calendarDate(dateOfBirth);
    if (!birth) {
        throw invalidDate('Enter a valid date of birth.');
    }

    const today = utcCalendarDate(now);
    if (compareDate(birth, today) > 0) {
        throw invalidDate('Enter a date of birth in the past.');
    }

    if (completedYears(birth, today) < MINIMUM_AGE_YEARS) {
        throw new AgeRejectedException(
            AGE_UNDER_18,
            'You must be 18 or older.',
            HttpStatus.FORBIDDEN,
        );
    }

    const confirmed = instant(ageConfirmedAt);
    if (!confirmed) {
        throw invalidConfirmation('Enter a valid confirmation time.');
    }

    const birthStart = Date.UTC(birth.y, birth.m - 1, birth.d);
    if (confirmed.getTime() < birthStart) {
        throw invalidConfirmation('Confirmation time is before the date of birth.');
    }

    if (confirmed.getTime() > now.getTime() + CONFIRMATION_SKEW_MS) {
        throw invalidConfirmation('Confirmation time is in the future.');
    }

    return {
        dateOfBirth: formatDate(birth),
        ageConfirmedAt: confirmed.toISOString(),
    };
}

/** Completed years from `birth` to `today`, using the same anniversary rule as java.time.Period. */
export function completedYears(birth: CalendarDate, today: CalendarDate): number {
    let years = today.y - birth.y;
    if (today.m < birth.m || (today.m === birth.m && today.d < birth.d)) {
        years -= 1;
    }
    return years;
}

function present(value: string | null | undefined): string | undefined {
    if (value == null) return undefined;
    return value;
}

function incomplete(): AgeRejectedException {
    return new AgeRejectedException(
        AGE_FIELDS_INCOMPLETE,
        'Date of birth and confirmation time are both required.',
        HttpStatus.BAD_REQUEST,
    );
}

function invalidDate(message: string): AgeRejectedException {
    return new AgeRejectedException(
        AGE_INVALID_DATE_OF_BIRTH,
        message,
        HttpStatus.BAD_REQUEST,
    );
}

function invalidConfirmation(message: string): AgeRejectedException {
    return new AgeRejectedException(
        AGE_INVALID_CONFIRMED_AT,
        message,
        HttpStatus.BAD_REQUEST,
    );
}

function calendarDate(value: string): CalendarDate | null {
    const match = ISO_DATE.exec(value);
    if (!match) return null;
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    const utc = new Date(Date.UTC(y, m - 1, d));
    if (
        utc.getUTCFullYear() !== y
        || utc.getUTCMonth() !== m - 1
        || utc.getUTCDate() !== d
    ) {
        return null;
    }
    return { y, m, d };
}

function utcCalendarDate(now: Date): CalendarDate {
    return {
        y: now.getUTCFullYear(),
        m: now.getUTCMonth() + 1,
        d: now.getUTCDate(),
    };
}

function compareDate(left: CalendarDate, right: CalendarDate): number {
    if (left.y !== right.y) return left.y - right.y;
    if (left.m !== right.m) return left.m - right.m;
    return left.d - right.d;
}

function formatDate(date: CalendarDate): string {
    const month = String(date.m).padStart(2, '0');
    const day = String(date.d).padStart(2, '0');
    return `${String(date.y).padStart(4, '0')}-${month}-${day}`;
}

function instant(value: string): Date | null {
    const match = ISO_INSTANT.exec(value);
    if (!match) return null;
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6]);
    if (hour > 23 || minute > 59 || second > 59) return null;
    const utc = new Date(Date.UTC(y, m - 1, d));
    if (
        utc.getUTCFullYear() !== y
        || utc.getUTCMonth() !== m - 1
        || utc.getUTCDate() !== d
    ) {
        return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
}
