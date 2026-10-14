/**
 * Clock time stored when the client attests they are 18 or older.
 * The server never reads or stores a date of birth.
 */
export function attestedAt(ageConfirmed: unknown, now: Date): string | null {
    return ageConfirmed === true ? now.toISOString() : null;
}
