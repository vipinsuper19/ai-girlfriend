import { Transform, Type } from 'class-transformer';
import {
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
} from 'class-validator';

/**
 * Reason codes sent by the Android report picker (PR #9).
 * The picker labels are separate; these strings are the `reason` field.
 */
export const REPORT_REASONS = [
    'HARMFUL',
    'SEXUAL',
    'HATE',
    'INACCURATE',
    'OTHER',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_NOTE_MAX = 500;

const INT4_MAX = 2_147_483_647;

/**
 * Body for `POST /reports`.
 *
 * The Android client sends `messageId` and `conversationId` as JSON
 * integers (the server row ids). Numeric strings are accepted as well.
 * A blank `note` is omitted by the client and stored as null here.
 */
export class CreateReportDto {
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(INT4_MAX)
    messageId!: number;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(INT4_MAX)
    conversationId!: number;

    @IsIn(REPORT_REASONS)
    reason!: ReportReason;

    @IsOptional()
    @Transform(({ value }) => {
        if (typeof value !== 'string') return value;
        const trimmed = value.trim();
        return trimmed.length === 0 ? undefined : trimmed;
    })
    @IsString()
    @MaxLength(REPORT_NOTE_MAX)
    note?: string;
}
