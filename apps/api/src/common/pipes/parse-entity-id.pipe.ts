import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';

/** Postgres `integer` primary keys. Larger values overflow the column and 500. */
export const ENTITY_ID_MAX = 2_147_483_647;

/**
 * A canonical positive id: digits only, no sign, no leading zero, inside int4.
 * Returns null for anything that must not be sent to the database.
 */
export function parseEntityId(value: unknown): number | null {
    if (typeof value === 'number') {
        if (!Number.isSafeInteger(value) || value < 1 || value > ENTITY_ID_MAX) return null;
        return value;
    }
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed > ENTITY_ID_MAX) return null;
    return parsed;
}

@Injectable()
export class ParseEntityIdPipe implements PipeTransform<unknown, number> {
    transform(value: unknown): number {
        const id = parseEntityId(value);
        if (id == null) {
            throw new BadRequestException('Validation failed (numeric id is expected)');
        }
        return id;
    }
}
